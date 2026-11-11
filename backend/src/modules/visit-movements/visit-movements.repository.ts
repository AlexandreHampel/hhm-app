
import { PROFESSIONAL_SUMMARY_FIELDS } from '../visits/visits.model.js';
import { MOVEMENT_LATEST_FIRST_SORT, MOVEMENT_TIMELINE_SORT, VisitMovement, VisitMovementModel } from './visit-movements.model.js';

const MOVEMENT_REFERENCES = [
  { path: 'responsibleProfessional', select: PROFESSIONAL_SUMMARY_FIELDS }
];

// Append-only repository: intentionally exposes no update or delete operations.
export class VisitMovementsRepository {
  async create(data: Partial<VisitMovement>) {
    return VisitMovementModel.create(data);
  }

  async findByVisit(visitId: string) {
    return VisitMovementModel.find({ visitId })
      .sort(MOVEMENT_TIMELINE_SORT)
      .populate(MOVEMENT_REFERENCES);
  }

  async findById(id: string) {
    return VisitMovementModel.findById(id).populate(MOVEMENT_REFERENCES);
  }

  async findLatestByVisit(visitId: string) {
    return VisitMovementModel.findOne({ visitId }).sort(MOVEMENT_LATEST_FIRST_SORT);
  }

  // Latest movement that recorded a destination department, i.e. where the
  // patient currently is.
  async findLatestWithDepartment(visitId: string) {
    return VisitMovementModel.findOne({
      visitId,
      departmentTo: { $exists: true, $nin: [null, ''] }
    }).sort(MOVEMENT_LATEST_FIRST_SORT);
  }

  async existsByProfessional(personId: string) {
    const movement = await VisitMovementModel.exists({
      responsibleProfessionalId: personId
    });

    return movement !== null;
  }
}
