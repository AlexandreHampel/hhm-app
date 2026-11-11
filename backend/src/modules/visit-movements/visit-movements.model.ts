
import mongoose, { Schema, Document, Types } from 'mongoose';

export const VISIT_MOVEMENT_TYPES = [
  'TRIAGE',
  'CARE_STARTED',
  'DEPARTMENT_TRANSFER',
  'DISCHARGE',
  'CANCELLATION',
  'OTHER'
] as const;

export type VisitMovementType = typeof VISIT_MOVEMENT_TYPES[number];

// Deterministic chronological order: occurredAt, then createdAt and _id as tie-breakers.
export const MOVEMENT_TIMELINE_SORT = { occurredAt: 1, createdAt: 1, _id: 1 } as const;
export const MOVEMENT_LATEST_FIRST_SORT = { occurredAt: -1, createdAt: -1, _id: -1 } as const;

export interface VisitMovement extends Document {
  visitId: Types.ObjectId;
  type: VisitMovementType;
  occurredAt: Date;
  departmentFrom?: string;
  departmentTo?: string;
  responsibleProfessionalId?: Types.ObjectId | null;
  description?: string;
  createdAt: Date;
}

const visitMovementsSchema = new Schema<VisitMovement>(
  {
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'Visit',
      required: true,
      immutable: true
    },
    type: {
      type: String,
      enum: VISIT_MOVEMENT_TYPES,
      required: true,
      immutable: true
    },
    occurredAt: {
      type: Date,
      required: true,
      immutable: true,
      default: () => new Date()
    },
    departmentFrom: {
      type: String,
      trim: true,
      immutable: true
    },
    departmentTo: {
      type: String,
      trim: true,
      immutable: true
    },
    responsibleProfessionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
      immutable: true
    },
    description: {
      type: String,
      trim: true,
      immutable: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'visit_movements',
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

visitMovementsSchema.virtual('responsibleProfessional', {
  ref: 'Person',
  localField: 'responsibleProfessionalId',
  foreignField: '_id',
  justOne: true
});

// Timeline retrieval for a visit, in the documented chronological order.
visitMovementsSchema.index({ visitId: 1, occurredAt: 1, createdAt: 1, _id: 1 });
visitMovementsSchema.index({ responsibleProfessionalId: 1 });

// Movements are append-only: block every update and delete path at model level.
visitMovementsSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Visit movements are append-only and cannot be modified');
  }
});

visitMovementsSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete'
  ],
  function () {
    throw new Error('Visit movements are append-only and cannot be modified or deleted');
  }
);

export const VisitMovementModel = mongoose.model<VisitMovement>(
  'VisitMovement',
  visitMovementsSchema
);
