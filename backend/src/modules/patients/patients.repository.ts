
import { PatientModel, Patient } from './patients.model.js';

export class PatientsRepository {
  async create(data: Partial<Patient>) {
    return PatientModel.create(data);
  }

  async update(id: string, data: Partial<Patient>) {
    return PatientModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true
    });
  }

  async delete(id: string) {
    return PatientModel.findByIdAndDelete(id);
  }

  async findAll() {
    return PatientModel.find();
  }

  async findById(id: string) {
    return PatientModel.findById(id);
  }

  async findByCpf(cpf: string) {
    return PatientModel.findOne({ cpf });
  }
}
