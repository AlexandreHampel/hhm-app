
import { Types } from 'mongoose';
import { ActiveVisitModel } from './active-visits.model.js';

export class ActiveVisitsRepository {
  // Fails with a duplicate key error (11000) when the patient already has an
  // active visit registered.
  async create(patientId: Types.ObjectId, visitId: Types.ObjectId) {
    return ActiveVisitModel.create({ patientId, visitId });
  }

  async delete(visitId: string) {
    return ActiveVisitModel.findOneAndDelete({ visitId });
  }

  async deleteById(id: string) {
    return ActiveVisitModel.findByIdAndDelete(id);
  }

  async findByPatient(patientId: string) {
    return ActiveVisitModel.findOne({ patientId });
  }

  async findByVisit(visitId: string) {
    return ActiveVisitModel.findOne({ visitId });
  }

  // Atomically takes the visit lock when it is free or abandoned. Returns the
  // document as it was before locking (null when the lock was not acquired),
  // so the caller can see an abandoned operation to complete.
  async acquireLock(visitId: string, lockId: Types.ObjectId, abandonedBefore: Date) {
    return ActiveVisitModel.findOneAndUpdate(
      {
        visitId,
        $or: [
          { lockId: null },
          { lockedAt: { $lt: abandonedBefore } }
        ]
      },
      { $set: { lockId, lockedAt: new Date() } },
      { returnDocument: 'before' }
    );
  }

  async releaseLock(visitId: string, lockId: Types.ObjectId) {
    return ActiveVisitModel.updateOne(
      { visitId, lockId },
      { $set: { lockId: null, lockedAt: null } }
    );
  }
}
