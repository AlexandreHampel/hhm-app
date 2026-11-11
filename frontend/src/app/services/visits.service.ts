
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActivePatient, Visit, VisitFilters, VisitMovement, VisitMovementPayload, VisitPage, VisitPayload, VisitUpdatePayload } from '../models/visits.model';

@Injectable({
  providedIn: 'root'
})
export class VisitsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/visits';

  create(visit: VisitPayload): Observable<Visit> {
    return this.http.post<Visit>(this.apiUrl, visit);
  }

  update(id: string, visit: VisitUpdatePayload): Observable<Visit> {
    return this.http.put<Visit>(`${this.apiUrl}/id/${id}`, visit);
  }

  findAll(filters: VisitFilters): Observable<VisitPage> {
    let params = new HttpParams();

    for (const [name, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') {
        params = params.set(name, String(value));
      }
    }

    return this.http.get<VisitPage>(this.apiUrl, { params });
  }

  findById(id: string): Observable<Visit> {
    return this.http.get<Visit>(`${this.apiUrl}/id/${id}`);
  }

  findByPatient(patientId: string): Observable<Visit[]> {
    return this.http.get<Visit[]>(`${this.apiUrl}/patient/${patientId}`);
  }

  findActivePatients(): Observable<ActivePatient[]> {
    return this.http.get<ActivePatient[]>(`${this.apiUrl}/active-patients`);
  }

  createMovement(visitId: string, movement: VisitMovementPayload): Observable<VisitMovement> {
    return this.http.post<VisitMovement>(`${this.apiUrl}/id/${visitId}/movements`, movement);
  }

  findMovements(visitId: string): Observable<VisitMovement[]> {
    return this.http.get<VisitMovement[]>(`${this.apiUrl}/id/${visitId}/movements`);
  }
}
