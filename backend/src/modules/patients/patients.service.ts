
import { PatientsRepository } from './patients.repository.js';
import { Patient } from './patients.model.js';

export class PatientsService {
  private repository = new PatientsRepository();

  async create(data: Partial<Patient>) {
    if (!data.cpf) {
      throw new Error('CPF is required');
    }

    const existingPatient = await this.repository.findByCpf(data.cpf);

    if (existingPatient) {
      throw new Error('Patient with this CPF already exists');
    }

    return this.repository.create(data);
  }

  async update(id: string, data: Partial<Patient>) {
    const patient = await this.repository.update(id, data);

    if (!patient) {
      throw new Error('Patient not found');
    }

    return patient;
  }

  async delete(id: string) {
    const patient = await this.repository.delete(id);

    if (!patient) {
      throw new Error('Patient not found');
    }

    return patient;
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: string) {
    const patient = await this.repository.findById(id);

    if (!patient) {
      throw new Error('Patient not found');
    }

    return patient;
  }

  async findByCpf(cpf: string) {
    const patient = await this.repository.findByCpf(cpf);

    if (!patient) {
      throw new Error('Patient not found');
    }

    return patient;
  }
}