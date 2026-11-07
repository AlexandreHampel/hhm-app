# 🏥 HHM — Hampel Hospital Management

**Hospital Management System | Full Stack Application**

A modern, modular hospital management system built with Angular, Node.js, TypeScript, and MongoDB.

HHM (Hampel Hospital Management) aims to centralize hospital operations through a scalable, maintainable, and user-friendly web application.

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

**Project Status:** 🚧 Under Development

---

## 📋 Overview

HHM is a full-stack hospital ERP project designed to streamline administrative and clinical workflows.

The application follows a layered architecture, separating the frontend, backend, and database to support modular development and long-term maintainability.

### Key Objectives

- Centralize hospital information and operations.
- Implement CRUD operations for hospital entities.
- Provide a RESTful API for frontend and backend communication.
- Maintain a modular and extensible codebase.
- Support future integrations and new features.

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Angular | Web user interface |
| Language | TypeScript | Type-safe development |
| Backend | Node.js | Server-side runtime |
| API | Express | HTTP routing and middleware |
| Database | MongoDB | Data persistence |
| ODM | Mongoose | MongoDB object modeling |
| Development | tsx | TypeScript development runtime |

## 🏗️ Architecture

```text
                     ┌────────────────────┐
                     │   Angular Client   │
                     │     Frontend       │
                     └─────────┬──────────┘
                               │
                           HTTP / JSON
                               │
                     ┌─────────▼──────────┐
                     │    Express API     │
                     │      Backend       │
                     └─────────┬──────────┘
                               │
                            Mongoose
                               │
                     ┌─────────▼──────────┐
                     │      MongoDB       │
                     │    Database HHM    │
                     └────────────────────┘
```

### Project Structure

```text
hhm/
├── frontend/
│   └── ...                  # Angular application
│
├── backend/
│   ├── src/
│   │   └── config/
│   │       ├── app.ts       # Express configuration
│   │       ├── server.ts    # Application entry point
│   │       └── database.ts  # MongoDB connection
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
├── LICENSE
└── README.md
```

## 🚀 Getting Started

### Prerequisites

Make sure the following tools are installed:

- Node.js and npm
- Angular CLI
- MongoDB Community Server
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd hhm
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Configure the local environment before starting the application.

### 3. Database Configuration

HHM uses MongoDB as its primary database, with Mongoose handling database connections and data modeling.

The database connection is managed through `backend/src/config/database.ts`.

Before running the backend, ensure that:

- MongoDB is installed and running.
- A database user with the required permissions is available.
- The local database connection is properly configured.
- Sensitive configuration files are excluded from version control.

The application establishes the database connection during server startup.

### 4. Run the Backend

**Development mode**

```bash
npm run dev
```

**Production build**

```bash
npm run build
npm start
```

By default, the API runs at:

`http://localhost:3000`

### 5. Frontend Setup

Open another terminal from the repository root:

```bash
cd frontend
npm install
npm start
```

Alternatively, use:

```bash
npx ng serve
```

By default, the frontend runs at:

`http://localhost:4200`

## 🔌 API Reference

### Health Check

Checks whether the API is responding.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Returns the API status |

**Example Response**

```json
{
  "status": "ok",
  "application": "HHM API"
}
```

The health check verifies API availability but does not independently validate database health.

## 🔒 Security

HHM is designed with security and maintainability in mind.

Sensitive configuration is managed outside the source code and must not be committed to version control.

Before processing real patient information, the application will require additional safeguards, including access control, data protection, secure authentication, and compliance with applicable privacy regulations such as Brazil's LGPD.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2026 Alexandre Hampel.