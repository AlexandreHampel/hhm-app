
import { QueryFilter, SortOrder, Types, UpdateQuery } from 'mongoose';
import { VisitsRepository } from './visits.repository.js';
import { PeopleRepository } from '../people/people.repository.js';
import { ActiveVisitsRepository } from '../active-visits/active-visits.repository.js';
import { ACTIVE_VISIT_LOCK_TIMEOUT_MS } from '../active-visits/active-visits.model.js';
import { DATE_ONLY_PATTERN, ISO_DATE_TIME_PATTERN, OBJECT_ID_PATTERN } from '../people/people.service.js';
import { ACTIVE_VISIT_STATUSES, VISIT_STATUSES, VISIT_TYPES, Visit, VisitStatus, VisitType } from './visits.model.js';

export class VisitsError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'VisitsError';
  }
}

type VisitInput = Record<string, unknown>;
type VisitQuery = Record<string, unknown>;

export const ACTIVE_VISIT_CONFLICT_MESSAGE =
  'This patient already has an active visit (OPEN or IN_PROGRESS). ' +
  'Complete or cancel it before opening a new one';

const CHIEF_COMPLAINT_MAX_LENGTH = 500;
const NOTES_MAX_LENGTH = 2000;
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export class VisitsService {
  private repository = new VisitsRepository();
  private peopleRepository = new PeopleRepository();
  private activeVisitsRepository = new ActiveVisitsRepository();

  async create(data: unknown) {
    const input = this.toInput(data);

    if (input.status !== undefined && input.status !== null && input.status !== 'OPEN') {
      throw new VisitsError(
        'New visits always start with OPEN status. Status changes are made by recording movements',
        400
      );
    }

    const patientId = this.normalizeRequiredReference(input.patientId, 'Patient');
    const type = this.normalizeOption(input.type, VISIT_TYPES, 'Visit type');
    const admissionDate = this.normalizeAdmissionDate(input.admissionDate);
    const chiefComplaint = this.normalizeChiefComplaint(input.chiefComplaint);
    const notes = this.normalizeText(input.notes, 'Notes', NOTES_MAX_LENGTH);
    const attendingProfessionalId = this.normalizeOptionalReference(
      input.attendingProfessionalId,
      'Attending professional'
    );

    await this.ensurePatient(patientId);

    if (attendingProfessionalId) {
      await this.ensureProfessional(attendingProfessionalId, patientId, 'Attending professional');
    }

    // The patient is reserved in active_visits before the visit is written, so
    // simultaneous requests cannot open two active visits for the same patient.
    const visitId = new Types.ObjectId();
    await this.reserveActiveVisit(patientId, visitId);

    try {
      return await this.repository.create({
        _id: visitId,
        patientId: new Types.ObjectId(patientId),
        type,
        status: 'OPEN',
        admissionDate,
        attendingProfessionalId: attendingProfessionalId
          ? new Types.ObjectId(attendingProfessionalId)
          : null,
        chiefComplaint,
        notes,
        closedAt: null
      });
    } catch (error) {
      // Release the reservation unless the visit was written despite the error.
      if (!(await this.repository.findById(String(visitId)))) {
        await this.activeVisitsRepository.delete(String(visitId));
      }

      throw error;
    }
  }

  async update(id: string, data: unknown) {
    const visit = await this.findById(id);
    const input = this.toInput(data);

    this.ensureActive(visit, 'can no longer be edited');
    this.ensureImmutableFieldsUnchanged(input, visit);

    const update: UpdateQuery<Visit> = { $set: {}, $unset: {} };

    if (input.type !== undefined) {
      update.$set!.type = this.normalizeOption(input.type, VISIT_TYPES, 'Visit type');
    }

    if (input.chiefComplaint !== undefined) {
      update.$set!.chiefComplaint = this.normalizeChiefComplaint(input.chiefComplaint);
    }

    if (input.notes !== undefined) {
      const notes = this.normalizeText(input.notes, 'Notes', NOTES_MAX_LENGTH);

      if (notes === undefined) {
        update.$unset!.notes = '';
      } else {
        update.$set!.notes = notes;
      }
    }

    if (input.attendingProfessionalId !== undefined) {
      const professionalId = this.normalizeOptionalReference(
        input.attendingProfessionalId,
        'Attending professional'
      );
      const currentProfessionalId = visit.attendingProfessionalId
        ? String(visit.attendingProfessionalId)
        : undefined;

      if (professionalId && professionalId !== currentProfessionalId) {
        await this.ensureProfessional(professionalId, String(visit.patientId), 'Attending professional');
      }

      update.$set!.attendingProfessionalId = professionalId ?? null;
    }

    const updatedVisit = await this.repository.update(id, ACTIVE_VISIT_STATUSES, update);

    if (!updatedVisit) {
      // The visit was closed between the read and the update.
      this.ensureActive(await this.findById(id), 'can no longer be edited');
      throw new VisitsError('Visit could not be updated. Please reload and try again', 409);
    }

    return updatedVisit;
  }

  async findAll(query: unknown) {
    const params = (typeof query === 'object' && query !== null ? query : {}) as VisitQuery;
    const filter: QueryFilter<Visit> = {};

    const statuses = this.parseListParam<VisitStatus>(params.status, VISIT_STATUSES, 'status');
    const types = this.parseListParam<VisitType>(params.type, VISIT_TYPES, 'type');

    if (statuses.length > 0) {
      filter.status = { $in: statuses };
    }

    if (types.length > 0) {
      filter.type = { $in: types };
    }

    const patientId = this.singleQueryValue(params.patientId, 'patientId');

    if (patientId !== undefined) {
      if (!OBJECT_ID_PATTERN.test(patientId)) {
        throw new VisitsError('Invalid patient ID', 400);
      }

      filter.patientId = patientId;
    }

    const conditions: QueryFilter<Visit>[] = [];
    const patientName = this.singleQueryValue(params.patientName, 'patientName');
    const patientCpf = this.parseDigitsParam(params.patientCpf, 'patientCpf');

    if (patientName || patientCpf) {
      const patientIds = await this.peopleRepository.findIds({
        roles: 'PATIENT',
        ...(patientName ? { name: this.containsPattern(patientName) } : {}),
        ...(patientCpf ? { cpf: this.containsPattern(patientCpf) } : {})
      });

      conditions.push({ patientId: { $in: patientIds } });
    }

    const professionalName = this.singleQueryValue(params.professionalName, 'professionalName');

    if (professionalName) {
      const professionalIds = await this.peopleRepository.findIds({ name: this.containsPattern(professionalName) });
      conditions.push({ attendingProfessionalId: { $in: professionalIds } });
    }

    const chiefComplaint = this.singleQueryValue(params.chiefComplaint, 'chiefComplaint');

    if (chiefComplaint) {
      filter.chiefComplaint = this.containsPattern(chiefComplaint);
    }

    if (conditions.length > 0) {
      filter.$and = conditions;
    }

    const admissionFrom = this.parseDateParam(params.admissionFrom, 'admissionFrom', 'start');
    const admissionTo = this.parseDateParam(params.admissionTo, 'admissionTo', 'end');

    if (admissionFrom && admissionTo && admissionFrom.getTime() > admissionTo.getTime()) {
      throw new VisitsError('admissionFrom must be earlier than or equal to admissionTo', 400);
    }

    if (admissionFrom || admissionTo) {
      filter.admissionDate = {
        ...(admissionFrom ? { $gte: admissionFrom } : {}),
        ...(admissionTo ? { $lte: admissionTo } : {})
      };
    }

    const page = this.parsePositiveIntegerParam(params.page, 'page', 1);
    const limit = this.parsePositiveIntegerParam(params.limit, 'limit', DEFAULT_PAGE_SIZE);

    if (limit > MAX_PAGE_SIZE) {
      throw new VisitsError(`limit must not exceed ${MAX_PAGE_SIZE}`, 400);
    }

    const order = this.singleQueryValue(params.order, 'order') ?? 'desc';

    if (order !== 'asc' && order !== 'desc') {
      throw new VisitsError('order must be either asc or desc', 400);
    }

    const sortDirection: SortOrder = order === 'asc' ? 1 : -1;
    const { items, total } = await this.repository.findAll(filter, {
      skip: (page - 1) * limit,
      limit,
      sortDirection
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string) {
    if (!OBJECT_ID_PATTERN.test(id)) {
      throw new VisitsError('Invalid visit ID', 400);
    }

    const visit = await this.repository.findById(id);

    if (!visit) {
      throw new VisitsError('Visit not found', 404);
    }

    return visit;
  }

  async findByPatient(patientId: string) {
    if (!OBJECT_ID_PATTERN.test(patientId)) {
      throw new VisitsError('Invalid patient ID', 400);
    }

    const person = await this.peopleRepository.findById(patientId);

    if (!person) {
      throw new VisitsError('Patient not found', 404);
    }

    return this.repository.findByPatient(patientId);
  }

  async findActivePatients() {
    const visits = await this.repository.findActivePatients();

    return visits.map((visit) => ({
      patientId: String(visit.patientId),
      visitId: String(visit._id),
      status: visit.status
    }));
  }

  // Shared visit-domain checks, also used by the visit movements module.

  toInput(data: unknown): VisitInput {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new VisitsError('Request body must be a JSON object', 400);
    }

    return data as VisitInput;
  }

  ensureActive(visit: Visit, consequence: string) {
    if (!ACTIVE_VISIT_STATUSES.includes(visit.status)) {
      throw new VisitsError(`Visit is ${visit.status} and ${consequence}`, 409);
    }
  }

  // Eligible professionals are people holding any role other than PATIENT,
  // and never the visit's own patient.
  async ensureProfessional(professionalId: string, patientId: string, label: string) {
    if (professionalId === patientId) {
      throw new VisitsError(`The ${label.toLowerCase()} cannot be the visit patient`, 400);
    }

    const person = await this.peopleRepository.findById(professionalId);

    if (!person) {
      throw new VisitsError(`${label} not found`, 404);
    }

    if (!person.roles.some((role) => role !== 'PATIENT')) {
      throw new VisitsError(
        `The ${label.toLowerCase()} must have a professional role (a role other than PATIENT)`,
        400
      );
    }
  }

  normalizeOptionalReference(value: unknown, label: string): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return this.normalizeRequiredReference(value, label);
  }

  parseDateTime(value: unknown, label: string): Date {
    const text = typeof value === 'string' ? value.trim() : '';

    if (!ISO_DATE_TIME_PATTERN.test(text)) {
      throw new VisitsError(
        `${label} must be an ISO 8601 date-time with timezone (e.g. 2026-01-31T14:30:00Z)`,
        400
      );
    }

    const date = new Date(text);

    if (Number.isNaN(date.getTime()) || !this.isCalendarDate(text)) {
      throw new VisitsError(`${label} must be a valid date-time`, 400);
    }

    return date;
  }

  normalizeOption<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
    if (value === undefined || value === null || value === '') {
      throw new VisitsError(`${label} is required`, 400);
    }

    if (!this.isOneOf(value, allowed)) {
      throw new VisitsError(
        `Unsupported ${label.toLowerCase()}: ${String(value)}. Supported values: ${allowed.join(', ')}`,
        400
      );
    }

    return value;
  }

  // Optional free text: trimmed, blank treated as absent, limited in length.
  normalizeText(value: unknown, label: string, maxLength: number): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new VisitsError(`${label} must be a string`, 400);
    }

    const text = value.trim();

    if (text.length > maxLength) {
      throw new VisitsError(`${label} must have at most ${maxLength} characters`, 400);
    }

    return text || undefined;
  }

  private async reserveActiveVisit(patientId: string, visitId: Types.ObjectId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.activeVisitsRepository.create(new Types.ObjectId(patientId), visitId);
        return;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) {
          throw error;
        }
      }

      if (!(await this.releaseAbandonedReservation(patientId))) {
        break;
      }
    }

    throw new VisitsError(ACTIVE_VISIT_CONFLICT_MESSAGE, 409);
  }

  // A reservation is abandoned when its visit is already closed (closing was
  // interrupted) or was never written (creation was interrupted).
  private async releaseAbandonedReservation(patientId: string): Promise<boolean> {
    const reservation = await this.activeVisitsRepository.findByPatient(patientId);

    if (!reservation) {
      return true;
    }

    const visit = await this.repository.findById(String(reservation.visitId));
    const isAbandoned = visit
      ? !ACTIVE_VISIT_STATUSES.includes(visit.status)
      : reservation.createdAt.getTime() < Date.now() - ACTIVE_VISIT_LOCK_TIMEOUT_MS;

    if (!isAbandoned) {
      return false;
    }

    await this.activeVisitsRepository.deleteById(String(reservation._id));
    return true;
  }

  private ensureImmutableFieldsUnchanged(input: VisitInput, visit: Visit) {
    if (input.patientId !== undefined &&
        String(input.patientId).trim().toLowerCase() !== String(visit.patientId)) {
      throw new VisitsError('Patient association cannot be changed after visit creation', 400);
    }

    if (input.admissionDate !== undefined) {
      const requested = typeof input.admissionDate === 'string'
        ? new Date(input.admissionDate).getTime()
        : Number.NaN;

      if (requested !== visit.admissionDate.getTime()) {
        throw new VisitsError('Admission date cannot be changed after visit creation', 400);
      }
    }

    if ((input.status !== undefined && input.status !== visit.status) ||
        (input.closedAt !== undefined && input.closedAt !== null)) {
      throw new VisitsError(
        'Visit status can only be changed by recording movements',
        400
      );
    }
  }

  private normalizeRequiredReference(value: unknown, label: string): string {
    if (value === undefined || value === null || value === '') {
      throw new VisitsError(`${label} is required`, 400);
    }

    if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value.trim())) {
      throw new VisitsError(`Invalid ${label.toLowerCase()} ID`, 400);
    }

    return value.trim().toLowerCase();
  }

  private normalizeAdmissionDate(value: unknown): Date {
    if (value === undefined || value === null || value === '') {
      return new Date();
    }

    const admissionDate = this.parseDateTime(value, 'Admission date');

    if (admissionDate.getTime() > Date.now()) {
      throw new VisitsError('Admission date cannot be in the future', 400);
    }

    return admissionDate;
  }

  private normalizeChiefComplaint(value: unknown): string {
    const chiefComplaint = this.normalizeText(value, 'Chief complaint', CHIEF_COMPLAINT_MAX_LENGTH);

    if (!chiefComplaint) {
      throw new VisitsError('Chief complaint is required', 400);
    }

    return chiefComplaint;
  }

  private async ensurePatient(patientId: string) {
    const person = await this.peopleRepository.findById(patientId);

    if (!person) {
      throw new VisitsError('Patient not found', 404);
    }

    if (!person.roles.includes('PATIENT')) {
      throw new VisitsError(
        'Only people with the PATIENT role can be registered as visit patients',
        400
      );
    }
  }

  private parseDateParam(value: unknown, name: string, boundary: 'start' | 'end'): Date | undefined {
    const text = this.singleQueryValue(value, name);

    if (text === undefined) {
      return undefined;
    }

    if (DATE_ONLY_PATTERN.test(text)) {
      if (!this.isCalendarDate(text)) {
        throw new VisitsError(`${name} must be a valid date`, 400);
      }

      // Date-only values are interpreted as whole UTC days (inclusive).
      const time = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
      return new Date(`${text}${time}`);
    }

    if (!ISO_DATE_TIME_PATTERN.test(text)) {
      throw new VisitsError(
        `${name} must be a date (YYYY-MM-DD) or an ISO 8601 date-time with timezone`,
        400
      );
    }

    return this.parseDateTime(text, name);
  }

  // Rejects dates such as 2026-02-30, which JavaScript would silently roll over.
  private isCalendarDate(text: string): boolean {
    const [year, month, day] = text.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  private parseListParam<T extends string>(
    value: unknown,
    allowed: readonly T[],
    name: string
  ): T[] {
    if (value === undefined || value === '') {
      return [];
    }

    const rawValues = (Array.isArray(value) ? value : [value])
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const values: T[] = [];

    for (const entry of rawValues) {
      if (!this.isOneOf(entry, allowed)) {
        throw new VisitsError(
          `Unsupported ${name}: ${entry}. Supported values: ${allowed.join(', ')}`,
          400
        );
      }

      if (!values.includes(entry)) {
        values.push(entry);
      }
    }

    return values;
  }

  private parseDigitsParam(value: unknown, name: string): string | undefined {
    const text = this.singleQueryValue(value, name);

    if (text === undefined) {
      return undefined;
    }

    const digits = text.replace(/\D/g, '');

    if (!digits) {
      throw new VisitsError(`${name} must contain digits`, 400);
    }

    return digits;
  }

  // Case-insensitive "contains" match for user-provided text.
  private containsPattern(text: string): RegExp {
    return new RegExp(text.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'), 'i');
  }

  private parsePositiveIntegerParam(value: unknown, name: string, fallback: number): number {
    const text = this.singleQueryValue(value, name);

    if (text === undefined) {
      return fallback;
    }

    if (!/^\d+$/.test(text) || Number(text) < 1) {
      throw new VisitsError(`${name} must be a positive integer`, 400);
    }

    return Number(text);
  }

  private singleQueryValue(value: unknown, name: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new VisitsError(`${name} must be provided once as a single value`, 400);
    }

    const text = value.trim();
    return text === '' ? undefined : text;
  }

  private isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
  }
}
