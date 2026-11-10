
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Person, PersonPayload, PersonRole } from '../models/people.model';

@Injectable({
  providedIn: 'root'
})
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/people';

  create(person: PersonPayload): Observable<Person> {
    return this.http.post<Person>(this.apiUrl, person);
  }

  update(id: string, person: PersonPayload): Observable<Person> {
    return this.http.put<Person>(`${this.apiUrl}/id/${id}`, person);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/id/${id}`);
  }

  findAll(): Observable<Person[]> {
    return this.http.get<Person[]>(this.apiUrl);
  }

  findById(id: string): Observable<Person> {
    return this.http.get<Person>(`${this.apiUrl}/id/${id}`);
  }

  findByCpf(cpf: string): Observable<Person> {
    return this.http.get<Person>(`${this.apiUrl}/cpf/${encodeURIComponent(cpf)}`);
  }

  findByRole(role: PersonRole): Observable<Person[]> {
    return this.http.get<Person[]>(`${this.apiUrl}/role/${encodeURIComponent(role)}`);
  }
}
