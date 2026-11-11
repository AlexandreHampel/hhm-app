
import { UpdateQuery } from 'mongoose';
import { PeopleRepository } from './people.repository.js';
import { PERSON_ROLES, Person, PersonRole } from './people.model.js';
import { VisitsRepository } from '../visits/visits.repository.js';
import { VisitMovementsRepository } from '../visit-movements/visit-movements.repository.js';

export class PeopleError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'PeopleError';
  }
}

type PersonInput = Record<string, unknown>;

const EDITABLE_FIELDS = [
  'name',
  'cpf',
  'birthDate',
  'email',
  'phone',
  'roles',
  'custom_roles'
] as const;

export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;

export class PeopleService {
  private repository = new PeopleRepository();
  private visitsRepository = new VisitsRepository();
  private visitMovementsRepository = new VisitMovementsRepository();

  async create(data: unknown) {
    const payload = this.normalizePayload(this.toInput(data));

    await this.ensureCpfIsAvailable(payload.cpf);

    return this.repository.create(payload);
  }

  async update(id: string, data: unknown) {
    this.validateId(id);

    const input = this.toInput(data);
    const existingPerson = await this.findById(id);

    const mergedInput: PersonInput = {
      name: existingPerson.name,
      cpf: existingPerson.cpf,
      birthDate: existingPerson.birthDate,
      email: existingPerson.email,
      phone: existingPerson.phone,
      roles: existingPerson.roles,
      custom_roles: existingPerson.custom_roles
    };

    for (const field of EDITABLE_FIELDS) {
      if (input[field] !== undefined) {
        mergedInput[field] = input[field];
      }
    }

    const payload = this.normalizePayload(mergedInput);

    if (payload.cpf !== existingPerson.cpf) {
      await this.ensureCpfIsAvailable(payload.cpf, id);
    }

    const update: UpdateQuery<Person> = {
      $set: {
        name: payload.name,
        cpf: payload.cpf,
        birthDate: payload.birthDate,
        roles: payload.roles,
        custom_roles: payload.custom_roles
      },
      $unset: {}
    };

    for (const field of ['email', 'phone'] as const) {
      if (payload[field] === undefined) {
        update.$unset![field] = '';
      } else {
        update.$set![field] = payload[field];
      }
    }

    const person = await this.repository.update(id, update);

    if (!person) {
      throw new PeopleError('Person not found', 404);
    }

    return person;
  }

  async delete(id: string) {
    this.validateId(id);

    // Referential integrity: people referenced by patient visits or visit
    // movements must be kept so that the visit history remains available.
    const [referencedByVisits, referencedByMovements] = await Promise.all([
      this.visitsRepository.existsByPerson(id),
      this.visitMovementsRepository.existsByProfessional(id)
    ]);

    if (referencedByVisits || referencedByMovements) {
      throw new PeopleError(
        'This person is referenced by patient visits and cannot be deleted',
        409
      );
    }

    const person = await this.repository.delete(id);

    if (!person) {
      throw new PeopleError('Person not found', 404);
    }

    return person;
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: string) {
    this.validateId(id);

    const person = await this.repository.findById(id);

    if (!person) {
      throw new PeopleError('Person not found', 404);
    }

    return person;
  }

  async findByCpf(cpf: string) {
    const person = await this.repository.findByCpf(this.normalizeCpf(cpf));

    if (!person) {
      throw new PeopleError('Person not found', 404);
    }

    return person;
  }

  async findByRole(role: string) {
    if (!this.isSupportedRole(role)) {
      throw new PeopleError(this.unsupportedRoleMessage(role), 400);
    }

    return this.repository.findByRole(role);
  }

  private toInput(data: unknown): PersonInput {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new PeopleError('Request body must be a JSON object', 400);
    }

    return data as PersonInput;
  }

  private normalizePayload(input: PersonInput): Partial<Person> {
    const roles = this.normalizeRoles(input.roles);

    return {
      name: this.normalizeName(input.name),
      cpf: this.normalizeCpf(input.cpf),
      birthDate: this.normalizeBirthDate(input.birthDate),
      email: this.normalizeEmail(input.email),
      phone: this.normalizePhone(input.phone),
      roles,
      custom_roles: roles.includes('OTHER')
        ? this.normalizeCustomRoles(input.custom_roles)
        : []
    };
  }

  private normalizeName(value: unknown): string {
    if (value === undefined || value === null) {
      throw new PeopleError('Name is required', 400);
    }

    if (typeof value !== 'string') {
      throw new PeopleError('Name must be a string', 400);
    }

    const name = value.trim();

    if (!name) {
      throw new PeopleError('Name is required', 400);
    }

    return name;
  }

  private normalizeCpf(value: unknown): string {
    if (value === undefined || value === null) {
      throw new PeopleError('CPF is required', 400);
    }

    if (typeof value !== 'string') {
      throw new PeopleError('CPF must be a string', 400);
    }

    const cpf = value.trim();

    if (!cpf) {
      throw new PeopleError('CPF is required', 400);
    }

    if (!CPF_PATTERN.test(cpf)) {
      throw new PeopleError('CPF must contain exactly 11 digits', 400);
    }

    const digits = cpf.replace(/\D/g, '');

    if (!this.hasValidCpfCheckDigits(digits)) {
      throw new PeopleError('CPF is invalid', 400);
    }

    return digits;
  }

  private hasValidCpfCheckDigits(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) {
      return false;
    }

    const numbers = cpf.split('').map(Number);

    for (const length of [9, 10]) {
      let sum = 0;

      for (let index = 0; index < length; index++) {
        sum += numbers[index] * (length + 1 - index);
      }

      const remainder = (sum * 10) % 11 % 10;

      if (remainder !== numbers[length]) {
        return false;
      }
    }

    return true;
  }

  private normalizeBirthDate(value: unknown): Date {
    if (value === undefined || value === null || value === '') {
      throw new PeopleError('Birth date is required', 400);
    }

    let birthDate: Date;

    if (value instanceof Date) {
      birthDate = value;
    } else if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value.trim())) {
      const dateOnly = value.trim();
      birthDate = new Date(`${dateOnly}T00:00:00.000Z`);

      if (Number.isNaN(birthDate.getTime()) ||
          birthDate.toISOString().slice(0, 10) !== dateOnly) {
        throw new PeopleError('Birth date must be a valid date', 400);
      }
    } else if (typeof value === 'string' && ISO_DATE_TIME_PATTERN.test(value.trim())) {
      birthDate = new Date(value.trim());
    } else {
      throw new PeopleError('Birth date must be a valid date in YYYY-MM-DD format', 400);
    }

    if (Number.isNaN(birthDate.getTime())) {
      throw new PeopleError('Birth date must be a valid date', 400);
    }

    if (birthDate.getTime() > Date.now()) {
      throw new PeopleError('Birth date cannot be in the future', 400);
    }

    return birthDate;
  }

  private normalizeEmail(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new PeopleError('Email must be a string', 400);
    }

    const email = value.trim().toLowerCase();

    if (!email) {
      return undefined;
    }

    if (!EMAIL_PATTERN.test(email)) {
      throw new PeopleError('Email must be a valid email address', 400);
    }

    return email;
  }

  private normalizePhone(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new PeopleError('Phone must be a string', 400);
    }

    const phone = value.trim();

    if (!phone) {
      return undefined;
    }

    const digitCount = phone.replace(/\D/g, '').length;

    if (!PHONE_PATTERN.test(phone) || digitCount < 8 || digitCount > 15) {
      throw new PeopleError('Phone must be a valid phone number with 8 to 15 digits', 400);
    }

    return phone;
  }

  private normalizeRoles(value: unknown): PersonRole[] {
    if (value === undefined || value === null) {
      throw new PeopleError('At least one role is required', 400);
    }

    if (!Array.isArray(value)) {
      throw new PeopleError('Roles must be an array', 400);
    }

    if (value.length === 0) {
      throw new PeopleError('At least one role is required', 400);
    }

    const roles: PersonRole[] = [];

    for (const role of value) {
      if (!this.isSupportedRole(role)) {
        throw new PeopleError(this.unsupportedRoleMessage(role), 400);
      }

      if (!roles.includes(role)) {
        roles.push(role);
      }
    }

    return roles;
  }

  private normalizeCustomRoles(value: unknown): string[] {
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      throw new PeopleError('Custom roles must be an array of strings', 400);
    }

    const entries: unknown[] = value ?? [];

    if (entries.length === 0) {
      throw new PeopleError(
        'At least one custom role is required when the OTHER role is assigned',
        400
      );
    }

    const customRoles: string[] = [];
    const normalizedNames = new Set<string>();

    for (const entry of entries) {
      if (typeof entry !== 'string') {
        throw new PeopleError('Custom roles must be an array of strings', 400);
      }

      const customRole = entry.trim();

      if (!customRole) {
        throw new PeopleError('Custom roles cannot be blank', 400);
      }

      const normalizedName = customRole.toLocaleLowerCase();

      if (normalizedNames.has(normalizedName)) {
        throw new PeopleError(`Duplicate custom role: ${customRole}`, 400);
      }

      normalizedNames.add(normalizedName);
      customRoles.push(customRole);
    }

    return customRoles;
  }

  private async ensureCpfIsAvailable(cpf: string | undefined, currentId?: string) {
    if (!cpf) {
      throw new PeopleError('CPF is required', 400);
    }

    const existingPerson = await this.repository.findByCpf(cpf);

    if (existingPerson && String(existingPerson._id) !== currentId) {
      throw new PeopleError('A person with this CPF already exists', 409);
    }
  }

  private validateId(id: string) {
    if (!OBJECT_ID_PATTERN.test(id)) {
      throw new PeopleError('Invalid person ID', 400);
    }
  }

  private isSupportedRole(role: unknown): role is PersonRole {
    return typeof role === 'string' &&
      (PERSON_ROLES as readonly string[]).includes(role);
  }

  private unsupportedRoleMessage(role: unknown): string {
    return `Unsupported role: ${String(role)}. Supported roles: ${PERSON_ROLES.join(', ')}`;
  }
}
