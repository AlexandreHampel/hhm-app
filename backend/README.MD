# HHM — Backend API

## Project Structure

```text
src/
├── config/
│   ├── app.ts
│   ├── server.ts
│   └── database.ts
│
└── modules/
    ├── people/
    │   ├── people.model.ts
    │   ├── people.repository.ts
    │   ├── people.service.ts
    │   ├── people.controller.ts
    │   └── people.routes.ts
    │
    ├── active-visits/              # internal registry, no HTTP routes
    │   ├── active-visits.model.ts
    │   └── active-visits.repository.ts
    │
    ├── visits/
    │   ├── visits.model.ts
    │   ├── visits.repository.ts
    │   ├── visits.service.ts
    │   ├── visits.controller.ts
    │   └── visits.routes.ts
    │
    └── visit-movements/
        ├── visit-movements.model.ts
        ├── visit-movements.repository.ts
        ├── visit-movements.service.ts
        ├── visit-movements.controller.ts
        └── visit-movements.routes.ts
```

## File Responsibilities

### Configuration

| File | Responsibility |
|---|---|
| `app.ts` | Configures Express, middleware, and API routes. |
| `server.ts` | Initializes the database connection and starts the HTTP server. |
| `database.ts` | Manages the MongoDB connection through Mongoose and builds collections and indexes before the API starts. |

### Modules

Each module follows the same layered structure. `active-visits` is internal: the visits and movements services use it, so it only has the model and repository layers.

| File | Responsibility |
|---|---|
| `*.model.ts` | Defines the entity interface, Mongoose schema, and database model. |
| `*.repository.ts` | Handles database operations and queries using Mongoose models. |
| `*.service.ts` | Implements business logic, validations, and application rules. |
| `*.controller.ts` | Handles HTTP requests, invokes services, and returns HTTP responses. |
| `*.routes.ts` | Defines API endpoints and maps them to controller methods. |

## Request Execution Flow

All API requests follow the same execution order:

```text
HTTP Request
     │
     ▼
   Routes
     │
     ▼
 Controller
     │
     ▼
   Service
     │
     ▼
 Repository
     │
     ▼
    Model
     │
     ▼
   MongoDB
```

Responses travel back through the application layers to the client.

## Database Requirements

- No special deployment is needed: a standalone MongoDB server works, and no replica set or multi-document transactions are used.
- On startup the API creates the collections and indexes of every model before accepting requests. If an index can't be built, the API stops with an explicit error.

### Collections

| Collection | Purpose |
|---|---|
| `people` | General Registration |
| `visits` | Patient visits |
| `visit_movements` | Append-only movement history of each visit |
| `active_visits` | Internal registry with one document per active (`OPEN`/`IN_PROGRESS`) visit, used for the consistency guarantees described below |

## API Endpoints

All errors use the same JSON structure:

```json
{ "message": "Human-readable description of the problem" }
```

Unknown API routes and unsupported methods return `404` with this structure.

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check API availability |

### People (General Registration)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/people` | Create a person |
| GET | `/api/people` | List people ordered by name |
| GET | `/api/people/id/:id` | Get a person by ID |
| GET | `/api/people/cpf/:cpf` | Get a person by CPF |
| GET | `/api/people/role/:role` | List people with a role (`DOCTOR`, `NURSE`, `NURSING_TECHNICIAN`, `PATIENT`, `OTHER`) |
| PUT | `/api/people/id/:id` | Update a person |
| DELETE | `/api/people/id/:id` | Delete a person. Returns `409` if the person is referenced by a visit (as patient or attending professional) or by a visit movement (as responsible professional). |

### Patient Visits

Collection: `visits`. Every visit references exactly one `people` record with the `PATIENT` role. Patient data is referenced by ID and never copied into the visit.

| Method | Endpoint | Description | Success |
|---|---|---|---|
| POST | `/api/visits` | Create a visit (always starts as `OPEN`) | `201` |
| GET | `/api/visits` | List visits with filters and pagination | `200` |
| GET | `/api/visits/id/:id` | Get a visit by ID | `200` |
| GET | `/api/visits/patient/:patientId` | List all visits of a patient, newest admission first | `200` |
| GET | `/api/visits/active-patients` | List patients that currently have an active visit. The New Visit screen uses it to mark patients as unavailable. | `200` |
| PUT | `/api/visits/id/:id` | Update the editable fields of an active visit | `200` |

No `DELETE` endpoint is exposed. Visits are historical records, and the model also blocks deletes.

**Create payload**

| Field | Required | Rules |
|---|---|---|
| `patientId` | Yes | ID of an existing person with the `PATIENT` role. Other roles may also be present. |
| `type` | Yes | `OUTPATIENT`, `EMERGENCY` or `INPATIENT` |
| `chiefComplaint` | Yes | Non-blank, up to 500 characters |
| `admissionDate` | No | ISO 8601 date-time with timezone. Defaults to the server time and cannot be in the future. |
| `attendingProfessionalId` | No | ID of a person with a professional role, meaning any role other than `PATIENT`. Cannot be the visit patient. |
| `notes` | No | Up to 2000 characters |

**Update payload:** partial. Only `type`, `attendingProfessionalId` (`null` or `""` clears it), `chiefComplaint` and `notes` (`null` or `""` clears them) can change. The visit must be active. Requests that try to change `patientId`, `admissionDate`, `status` or `closedAt` are rejected with `400`. Unknown fields are ignored.

**List query parameters**

| Parameter | Description |
|---|---|
| `status` | One or more statuses, comma-separated (for example, `OPEN,IN_PROGRESS`) |
| `type` | One or more visit types, comma-separated |
| `patientId` | Visits of one patient |
| `patientName` | Patient name contains the text (case-insensitive) |
| `patientCpf` | Patient CPF contains the digits (formatting is ignored) |
| `professionalName` | Attending professional name contains the text (case-insensitive) |
| `chiefComplaint` | Chief complaint contains the text (case-insensitive) |
| `admissionFrom` / `admissionTo` | Inclusive admission date range. Accepts an ISO 8601 date-time with timezone, or `YYYY-MM-DD`, which is interpreted as the whole UTC day. |
| `page` | Page number, starting at 1 (default `1`) |
| `limit` | Page size, 1–100 (default `10`) |
| `order` | `desc` (default, newest admission first) or `asc`. `_id` in the same direction breaks ties, so the order is deterministic. |

List response:

```json
{ "items": [ /* visits */ ], "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
```

Visit responses include the stored references (`patientId`, `attendingProfessionalId`). They also include summaries resolved from `people`: `patient` (`_id`, `name`, `cpf`) and `attendingProfessional` (`_id`, `name`, `roles`).

### Visit Movements

Collection: `visit_movements`. This collection is append-only.

| Method | Endpoint | Description | Success |
|---|---|---|---|
| POST | `/api/visits/id/:id/movements` | Append a movement and apply its status transition | `201` |
| GET | `/api/visits/id/:id/movements` | Chronological movement history of a visit | `200` |

Movements cannot be changed or removed: there are no `PUT`, `PATCH` or `DELETE` endpoints, and the model blocks updates and deletes.

**Create payload**

| Field | Required | Rules |
|---|---|---|
| `type` | Yes | `TRIAGE`, `CARE_STARTED`, `DEPARTMENT_TRANSFER`, `DISCHARGE`, `CANCELLATION`, `OTHER` |
| `occurredAt` | No | ISO 8601 date-time with timezone. Defaults to the server time. Must not be in the future, earlier than the visit admission, or earlier than the latest recorded movement. |
| `departmentTo` | For `DEPARTMENT_TRANSFER` | Destination department, up to 100 characters. Optional for other types. |
| `departmentFrom` | No | Origin department. For a transfer, if the current department is known, it must match it and is filled in automatically when omitted. |
| `responsibleProfessionalId` | No | ID of a person with a professional role, meaning any role other than `PATIENT`. Cannot be the visit patient. |
| `description` | For `OTHER` | Up to 1000 characters |

The *current department* is the `departmentTo` of the latest movement that recorded one. A transfer to the department the patient is already in is rejected.

**Status transitions**

| Movement | Effect on the visit |
|---|---|
| `CARE_STARTED` | `OPEN` → `IN_PROGRESS`. Returns `409` if care has already started. |
| `DISCHARGE` | Active → `COMPLETED`. `closedAt` is set to the movement's `occurredAt`. |
| `CANCELLATION` | Active → `CANCELLED`. `closedAt` is set to the movement's `occurredAt`. |
| `TRIAGE`, `DEPARTMENT_TRANSFER`, `OTHER` | No status change |

Closed visits (`COMPLETED`, `CANCELLED`) cannot receive movements or edits (`409`).

**Timeline order:** ascending `occurredAt`, then `createdAt`, then `_id`. Each movement response includes the `responsibleProfessional` summary (`_id`, `name`, `roles`).

### Status Codes

| Status | Meaning |
|---|---|
| `200` | Successful read or update |
| `201` | Resource created |
| `400` | Invalid payload, ID, query parameter or date. Also invalid references: a person without the required role, an attempt to change an immutable field, or a timestamp that would break the timeline. |
| `404` | Visit, patient or professional not found, or unknown route |
| `409` | The patient already has an active visit, the visit is already closed, care has already started, another movement is being recorded for the same visit, or a person referenced by visits is being deleted |
| `500` | Unexpected error |

### Consistency Guarantees

Consistency is guaranteed through the `active_visits` collection and single-document atomic operations. No multi-document transactions are used.

- **One active visit per patient.** Creating a visit first reserves the patient in `active_visits`, which has a unique index on `patientId`, and only then writes the visit. Of several simultaneous creation requests for the same patient, one succeeds and the others get `409 Conflict`. The reservation is removed when a `DISCHARGE` or `CANCELLATION` closes the visit, which makes the patient available again.
- **Movements are recorded one at a time per visit.** Recording a movement atomically takes the visit's lock in `active_visits`. A simultaneous movement on the same visit gets `409` ("Another movement is being recorded for this visit"). Under the lock, the API checks the timeline rules against the latest movement, inserts the movement, applies the status transition, and releases the lock. If a movement is rejected, nothing is written.
- **Recovery from interrupted operations.** If the API stops between the movement insert and the status update, the lock stays held. After 30 seconds (`ACTIVE_VISIT_LOCK_TIMEOUT_MS`) the next movement request takes the lock over and first reconciles the visit status with its recorded movements: a `DISCHARGE`/`CANCELLATION` closes the visit, and `CARE_STARTED` moves it to `IN_PROGRESS`. A reservation whose visit was never written, or whose visit is already closed, is released the same way when the patient's next visit is created.

### Method Order

Controllers, services, and repositories must follow this exact method declaration order:

1. `create`
2. `update`
3. `delete`
4. `findAll`
5. Additional methods
