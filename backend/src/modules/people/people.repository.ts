
import { UpdateQuery } from 'mongoose';
import { PersonModel, Person, PersonRole } from './people.model.js';

export class PeopleRepository {
  async create(data: Partial<Person>) {
    return PersonModel.create(data);
  }

  async update(id: string, data: UpdateQuery<Person>) {
    return PersonModel.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      runValidators: true
    });
  }

  async delete(id: string) {
    return PersonModel.findByIdAndDelete(id);
  }

  async findAll() {
    return PersonModel.find().sort({ name: 1 });
  }

  async findById(id: string) {
    return PersonModel.findById(id);
  }

  async findByCpf(cpf: string) {
    return PersonModel.findOne({ cpf });
  }

  async findByRole(role: PersonRole) {
    return PersonModel.find({ roles: role }).sort({ name: 1 });
  }
}
