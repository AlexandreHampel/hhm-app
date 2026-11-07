# HHM — Backend API

## Project Structure

```text
src/
├── config/
│   ├── app.ts
│   ├── server.ts
│   ├── database.ts
│   └── ...
│
├── modules/
│   ├── patients/
│   │   ├── patients.model.ts
│   │   ├── patients.repository.ts
│   │   ├── patients.service.ts
│   │   ├── patients.controller.ts
│   │   └── patients.routes.ts
│   └── ...
│
└── ...
```

## File Responsibilities

### Configuration

| File | Responsibility |
|---|---|
| `app.ts` | Configures Express, middleware, and API routes. |
| `server.ts` | Initializes the database connection and starts the HTTP server. |
| `database.ts` | Manages the MongoDB connection through Mongoose. |

### Modules

Each module follows the same layered structure.

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

## API Endpoints

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check API availability |

### Method Order

Controllers, services, and repositories must follow this exact method declaration order:

1. `create`
2. `update`
3. `delete`
4. `findAll`
5. Additional methods