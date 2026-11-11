
import { Types } from 'mongoose';
import { VisitMovementsRepository } from './visit-movements.repository.js';
import { VISIT_MOVEMENT_TYPES, VisitMovement } from './visit-movements.model.js';
import { VisitsError, VisitsService } from '../visits/visits.service.js';
import { VisitsRepository } from '../visits/visits.repository.js';
import { ACTIVE_VISIT_STATUSES } from '../visits/visits.model.js';
import { ActiveVisitsRepository } from '../active-visits/active-visits.repository.js';
import { ACTIVE_VISIT_LOCK_TIMEOUT_MS } from '../active-visits/active-visits.model.js';

type MovementRequest = Pick<
  VisitMovement,
  'type' | 'departmentFrom' | 'departmentTo' | 'description'
> & {
  occurredAt?: Date;
  responsibleProfessionalId?: string;
};

const CLOSED_VISIT_CONSEQUENCE = 'cannot receive new movements';
const DEPARTMENT_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;

export class VisitMovementsService {
  private repository = new VisitMovementsRepository();
  private visitsRepository = new VisitsRepository();
  private activeVisitsRepository = new ActiveVisitsRepository();
  private visitsService = new VisitsService();

  async create(visitId: string, data: unknown) {
    const request = this.normalizePayload(this.visitsService.toInput(data));
    const visit = await this.visitsService.findById(visitId);

    this.visitsService.ensureActive(visit, CLOSED_VISIT_CONSEQUENCE);

    if (request.responsibleProfessionalId) {
      await this.visitsService.ensureProfessional(
        request.responsibleProfessionalId,
        String(visit.patientId),
        'Responsible professional'
      );
    }

    // Movements of a visit are recorded one at a time, under the visit lock
    // kept in active_visits. This keeps the timeline rules and the status
    // transition consistent without multi-document transactions.
    const lockId = new Types.ObjectId();
    await this.acquireVisitLock(visitId, lockId);

    let movement: VisitMovement;

    try {
      movement = await this.recordMovement(visitId, lockId, request);
    } catch (error) {
      // If the movement was written despite the error, the lock is kept so the
      // next operation on this visit completes the status transition.
      if (!(await this.repository.findById(String(lockId)))) {
        await this.activeVisitsRepository.releaseLock(visitId, lockId);
      }

      throw error;
    }

    if (await this.applyStatusTransition(visitId, movement)) {
      // The visit is closed: remove it from active_visits, freeing the patient.
      await this.activeVisitsRepository.delete(visitId);
    } else {
      await this.activeVisitsRepository.releaseLock(visitId, lockId);
    }

    return this.repository.findById(String(lockId));
  }

  async findByVisit(visitId: string) {
    await this.visitsService.findById(visitId);

    return this.repository.findByVisit(visitId);
  }

  private normalizePayload(input: Record<string, unknown>): MovementRequest {
    const type = this.visitsService.normalizeOption(input.type, VISIT_MOVEMENT_TYPES, 'Movement type');
    const departmentFrom = this.visitsService.normalizeText(
      input.departmentFrom,
      'Origin department',
      DEPARTMENT_MAX_LENGTH
    );
    const departmentTo = this.visitsService.normalizeText(
      input.departmentTo,
      'Destination department',
      DEPARTMENT_MAX_LENGTH
    );
    const description = this.visitsService.normalizeText(
      input.description,
      'Description',
      DESCRIPTION_MAX_LENGTH
    );

    if (type === 'OTHER' && !description) {
      throw new VisitsError('Description is required for movements of type OTHER', 400);
    }

    if (type === 'DEPARTMENT_TRANSFER') {
      if (!departmentTo) {
        throw new VisitsError('Destination department is required for a department transfer', 400);
      }

      if (departmentFrom && this.isSameDepartment(departmentFrom, departmentTo)) {
        throw new VisitsError(
          'Destination department must be different from the origin department',
          400
        );
      }
    }

    return {
      type,
      occurredAt: input.occurredAt === undefined || input.occurredAt === null || input.occurredAt === ''
        ? undefined
        : this.visitsService.parseDateTime(input.occurredAt, 'Movement date/time'),
      departmentFrom,
      departmentTo,
      description,
      responsibleProfessionalId: this.visitsService.normalizeOptionalReference(
        input.responsibleProfessionalId,
        'Responsible professional'
      )
    };
  }

  // Takes the visit lock. A lock left by an interrupted operation is taken
  // over after ACTIVE_VISIT_LOCK_TIMEOUT_MS, and the visit status is first
  // reconciled with its recorded movements.
  private async acquireVisitLock(visitId: string, lockId: Types.ObjectId) {
    const abandonedBefore = new Date(Date.now() - ACTIVE_VISIT_LOCK_TIMEOUT_MS);
    const previous = await this.activeVisitsRepository.acquireLock(visitId, lockId, abandonedBefore);

    if (!previous) {
      if (await this.activeVisitsRepository.findByVisit(visitId)) {
        throw new VisitsError(
          'Another movement is being recorded for this visit. Please try again in a moment',
          409
        );
      }

      // No longer registered as active: the visit was closed meanwhile.
      this.visitsService.ensureActive(
        await this.visitsService.findById(visitId),
        CLOSED_VISIT_CONSEQUENCE
      );

      throw new VisitsError('The visit was updated by another request. Please reload and try again', 409);
    }

    if (previous.lockId && await this.reconcileVisitStatus(visitId)) {
      await this.activeVisitsRepository.delete(visitId);

      this.visitsService.ensureActive(
        await this.visitsService.findById(visitId),
        CLOSED_VISIT_CONSEQUENCE
      );
    }
  }

  // Runs under the visit lock, so the checks below cannot race with another
  // movement of the same visit.
  private async recordMovement(visitId: string, movementId: Types.ObjectId, request: MovementRequest) {
    const visit = await this.visitsService.findById(visitId);

    this.visitsService.ensureActive(visit, CLOSED_VISIT_CONSEQUENCE);

    if (request.type === 'CARE_STARTED' && visit.status !== 'OPEN') {
      throw new VisitsError('Care has already started for this visit', 409);
    }

    const now = new Date();
    const occurredAt = request.occurredAt ?? now;

    if (occurredAt.getTime() > now.getTime()) {
      throw new VisitsError('Movement date/time cannot be in the future', 400);
    }

    if (occurredAt.getTime() < visit.admissionDate.getTime()) {
      throw new VisitsError(
        `Movement date/time cannot be earlier than the visit admission (${visit.admissionDate.toISOString()})`,
        400
      );
    }

    const latestMovement = await this.repository.findLatestByVisit(visitId);

    if (latestMovement && occurredAt.getTime() < latestMovement.occurredAt.getTime()) {
      throw new VisitsError(
        `Movement date/time cannot be earlier than the latest recorded movement (${latestMovement.occurredAt.toISOString()})`,
        400
      );
    }

    const departmentFrom = request.type === 'DEPARTMENT_TRANSFER'
      ? await this.resolveTransferOrigin(visitId, request.departmentFrom, request.departmentTo!)
      : request.departmentFrom;

    return this.repository.create({
      _id: movementId,
      visitId: new Types.ObjectId(visitId),
      type: request.type,
      occurredAt,
      departmentFrom,
      departmentTo: request.departmentTo,
      responsibleProfessionalId: request.responsibleProfessionalId
        ? new Types.ObjectId(request.responsibleProfessionalId)
        : null,
      description: request.description
    });
  }

  // Applies the status change caused by a movement. Idempotent: the update only
  // matches a visit still in the source status. Returns true when it closes the visit.
  private async applyStatusTransition(
    visitId: string,
    movement: Pick<VisitMovement, 'type' | 'occurredAt'>
  ): Promise<boolean> {
    switch (movement.type) {
      case 'CARE_STARTED':
        await this.visitsRepository.update(visitId, ['OPEN'], {
          $set: { status: 'IN_PROGRESS' }
        });
        return false;

      case 'DISCHARGE':
      case 'CANCELLATION':
        await this.visitsRepository.update(visitId, ACTIVE_VISIT_STATUSES, {
          $set: {
            status: movement.type === 'DISCHARGE' ? 'COMPLETED' : 'CANCELLED',
            closedAt: movement.occurredAt
          }
        });
        return true;

      default:
        // TRIAGE, DEPARTMENT_TRANSFER and OTHER never change the visit status.
        return false;
    }
  }

  // Brings the visit status in line with its movement history after an
  // interrupted operation. Returns true when the visit is closed.
  private async reconcileVisitStatus(visitId: string): Promise<boolean> {
    const movements = await this.repository.findByVisit(visitId);
    const closingMovement = movements.find(
      (movement) => movement.type === 'DISCHARGE' || movement.type === 'CANCELLATION'
    );

    if (closingMovement) {
      return this.applyStatusTransition(visitId, closingMovement);
    }

    const careStarted = movements.find((movement) => movement.type === 'CARE_STARTED');

    if (careStarted) {
      await this.applyStatusTransition(visitId, careStarted);
    }

    return false;
  }

  // The origin of a transfer is the department where the patient currently is,
  // when known (destination of the latest movement that recorded one).
  private async resolveTransferOrigin(
    visitId: string,
    requestedDepartmentFrom: string | undefined,
    departmentTo: string
  ): Promise<string | undefined> {
    const located = await this.repository.findLatestWithDepartment(visitId);
    const currentDepartment = located?.departmentTo;

    if (!currentDepartment) {
      return requestedDepartmentFrom;
    }

    if (requestedDepartmentFrom && !this.isSameDepartment(requestedDepartmentFrom, currentDepartment)) {
      throw new VisitsError(
        `Origin department must match the visit's current department (${currentDepartment})`,
        400
      );
    }

    if (this.isSameDepartment(departmentTo, currentDepartment)) {
      throw new VisitsError(
        `The patient is already in the ${currentDepartment} department`,
        400
      );
    }

    return requestedDepartmentFrom ?? currentDepartment;
  }

  private isSameDepartment(first: string, second: string): boolean {
    return first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
  }
}
