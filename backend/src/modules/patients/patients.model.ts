
import mongoose, { Schema, Document } from 'mongoose';

export interface Patient extends Document {
  name: string;
  cpf: string;
  birthDate: Date;
  email?: string;
  phone?: string;
}

const patientsSchema = new Schema<Patient>(
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
    }
  },
  {
    timestamps: true,
    collection: 'patients'
  }
);

export const PatientModel = mongoose.model<Patient>(
  'Patient',
  patientsSchema
);
