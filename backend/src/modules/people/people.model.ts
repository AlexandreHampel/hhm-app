
import mongoose, { Schema, Document } from 'mongoose';

export const PERSON_ROLES = [
  'DOCTOR',
  'NURSE',
  'NURSING_TECHNICIAN',
  'PATIENT',
  'OTHER'
] as const;

export type PersonRole = typeof PERSON_ROLES[number];

export interface Person extends Document {
  name: string;
  cpf: string;
  birthDate: Date;
  email?: string;
  phone?: string;
  roles: PersonRole[];
  custom_roles: string[];
}

const peopleSchema = new Schema<Person>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    cpf: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    birthDate: {
      type: Date,
      required: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    roles: {
      type: [{
        type: String,
        enum: PERSON_ROLES
      }],
      required: true,
      validate: {
        validator: (roles: string[]) => roles.length > 0,
        message: 'At least one role is required'
      }
    },
    custom_roles: {
      type: [{
        type: String,
        trim: true
      }],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'people'
  }
);

peopleSchema.index({ roles: 1 });

export const PersonModel = mongoose.model<Person>(
  'Person',
  peopleSchema
);
