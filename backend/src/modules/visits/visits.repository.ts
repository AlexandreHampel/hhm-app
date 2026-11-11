
import { QueryFilter, SortOrder, UpdateQuery } from 'mongoose';
import { ACTIVE_VISIT_STATUSES, PATIENT_SUMMARY_FIELDS, PROFESSIONAL_SUMMARY_FIELDS, Visit, VisitModel, VisitStatus } from './visits.model.js';

export interface VisitPage {
  skip: number;
  limit: number;
  sortDirection: SortOrder;
}

const VISIT_REFERENCES = [
  { path: 'patient', select: PATIENT_SUMMARY_FIELDS },
  { path: 'attendingProfessional', select: PROFESSIONAL_SUMMARY_FIELDS }
];

export class VisitsRepository {
  async create(data: Partial<Visit>) {
    const visit = await VisitModel.create(data);
    return visit.populate(VISIT_REFERENCES);
  }

  // Updates only while the visit is in one of the expected statuses, so a
  // visit closed concurrently is never modified.
  async update(id: string, expectedStatuses: readonly VisitStatus[], data: UpdateQuery<Visit>) {
    return VisitModel.findOneAndUpdate(
      { _id: id, status: { $in: [...expectedStatuses] } },
      data,
      {
        returnDocument: 'after',
        runValidators: true
      }
    ).populate(VISIT_REFERENCES);
  }

  async findAll(filter: QueryFilter<Visit>, page: VisitPage) {
    const [items, total] = await Promise.all([
      VisitModel.find(filter)
        .sort({ admissionDate: page.sortDirection, _id: page.sortDirection })
        .skip(page.skip)
        .limit(page.limit)
        .populate(VISIT_REFERENCES),
      VisitModel.countDocuments(filter)
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return VisitModel.findById(id).populate(VISIT_REFERENCES);
  }

  async findByPatient(patientId: string) {
    return VisitModel.find({ patientId })
      .sort({ admissionDate: -1, _id: -1 })
      .populate(VISIT_REFERENCES);
  }

  async findActivePatients() {
    return VisitModel.find(
      { status: { $in: [...ACTIVE_VISIT_STATUSES] } },
      { patientId: 1, status: 1 }
    ).lean();
  }

  async existsByPerson(personId: string) {
    const visit = await VisitModel.exists({
      $or: [
        { patientId: personId },
        { attendingProfessionalId: personId }
      ]
    });

    return visit !== null;
  }
}
