
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Patient, PatientPayload } from '../models/patients.model';

@Injectable({
  providedIn: 'root'
})
export class PatientsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/patients';

  create(patient: PatientPayload): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, patient);
  }

  update(id: string, patient: PatientPayload): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/id/${id}`, patient);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/id/${id}`);
  }

  findAll(): Observable<Patient[]> {
    return this.http.get<Patient[]>(this.apiUrl);
  }

  findById(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/id/${id}`);
  }

  findByCpf(cpf: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/cpf/${encodeURIComponent(cpf)}`);
  }
}
