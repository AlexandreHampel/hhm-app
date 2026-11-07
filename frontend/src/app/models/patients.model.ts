export interface Patient {
  _id: string;
  name: string;
  cpf: string;
  birthDate: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PatientPayload = Pick<
  Patient,
  'name' | 'cpf' | 'birthDate' | 'email' | 'phone'
>;