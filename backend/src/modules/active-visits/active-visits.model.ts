
import mongoose, { Schema, Document, Types } from 'mongoose';

// Time after which an unreleased lock or reservation is considered abandoned
// (for example, the API stopped in the middle of an operation).
export const ACTIVE_VISIT_LOCK_TIMEOUT_MS = 30_000;

// Registry with one document per active (OPEN or IN_PROGRESS) visit.
// - The unique index on patientId enforces, at database level, that a patient
//   has at most one active visit, including under simultaneous requests.
// - lockId/lockedAt serialize movement recording per visit (lockId is the ID
//   of the movement being recorded). A lock left by an interrupted operation
//   is taken over after the timeout, and the visit status is reconciled with
//   its movements, so no partial state remains.
export interface ActiveVisit extends Document {
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  lockId: Types.ObjectId | null;
  lockedAt: Date | null;
  createdAt: Date;
}

const activeVisitsSchema = new Schema<ActiveVisit>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      unique: true
    },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'Visit',
      required: true,
      unique: true
    },
    lockId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    lockedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'active_visits'
  }
);

export const ActiveVisitModel = mongoose.model<ActiveVisit>(
  'ActiveVisit',
  activeVisitsSchema
);
