
import mongoose, { Schema, Document, Types } from 'mongoose';

export const VISIT_TYPES = [
  'OUTPATIENT',
  'EMERGENCY',
  'INPATIENT'
] as const;

export const VISIT_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
] as const;

export type VisitType = typeof VISIT_TYPES[number];
export type VisitStatus = typeof VISIT_STATUSES[number];

// A patient may have at most one visit in one of these statuses at any time
// (enforced through the active_visits collection).
export const ACTIVE_VISIT_STATUSES: readonly VisitStatus[] = ['OPEN', 'IN_PROGRESS'];

// Fields returned when a person reference is populated. Only what the visit
// screens need is exposed; personal data stays in the people collection.
export const PATIENT_SUMMARY_FIELDS = 'name cpf';
export const PROFESSIONAL_SUMMARY_FIELDS = 'name roles';

export interface Visit extends Document {
  patientId: Types.ObjectId;
  type: VisitType;
  status: VisitStatus;
  admissionDate: Date;
  attendingProfessionalId?: Types.ObjectId | null;
  chiefComplaint: string;
  notes?: string;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const visitsSchema = new Schema<Visit>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      immutable: true
    },
    type: {
      type: String,
      enum: VISIT_TYPES,
      required: true
    },
    status: {
      type: String,
      enum: VISIT_STATUSES,
      required: true,
      default: 'OPEN'
    },
    admissionDate: {
      type: Date,
      required: true,
      immutable: true,
      default: () => new Date()
    },
    attendingProfessionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      default: null
    },
    chiefComplaint: {
      type: String,
      required: true,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'visits',
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

visitsSchema.virtual('patient', {
  ref: 'Person',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true
});

visitsSchema.virtual('attendingProfessional', {
  ref: 'Person',
  localField: 'attendingProfessionalId',
  foreignField: '_id',
  justOne: true
});

// Patient history lookup and default listing order (newest admission first).
visitsSchema.index({ patientId: 1, admissionDate: -1, _id: -1 });
visitsSchema.index({ admissionDate: -1, _id: -1 });
visitsSchema.index({ status: 1, admissionDate: -1, _id: -1 });
visitsSchema.index({ attendingProfessionalId: 1 });

// Visits are historical records: physical deletion is not supported.
visitsSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Visits are historical records and cannot be deleted');
});

export const VisitModel = mongoose.model<Visit>(
  'Visit',
  visitsSchema
);
