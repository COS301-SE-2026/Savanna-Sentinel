# Savanna Sentinel - Software Requirements Specification

**Version:** 1.0
**Date:** 16 May 2026
**Project:** COS 301 Capstone - University of Pretoria
**Client:** EPI-USE
**Status:** Demo 1 

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Classes and Characteristics](#3-user-classes-and-characteristics)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [System Architecture](#6-system-architecture)
7. [Data Model](#7-data-model)
8. [API Overview](#8-api-overview)
9. [Technology Stack](#9-technology-stack)
10. [Constraints](#10-constraints)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for **Savanna Sentinel**, a wildlife conservation anti-poaching intelligence platform. It serves as the authoritative requirements reference for the development team, the industry client EPI-USE, and university evaluators.

### 1.2 Scope

Savanna Sentinel enables game reserve rangers, analysts, and community liaisons to:

- Detect poaching hotspots through an AI-driven geospatial risk heatmap
- Plan optimal, constraint-based patrol routes
- Capture and sync field reports offline via a Progressive Web App (PWA)
- Submit community tip-offs about observed incidents or sightings
- Administer user accounts and monitor system activity via an audit log

The system is a multi-role web application with offline-first field capabilities, backed by a versioned REST API, a PostgreSQL/PostGIS database, and an asynchronous ML processing pipeline.

### 1.3 Definitions and Acronyms

| Term | Definition |
|---|---|
| **RBAC** | Role-Based Access Control - access governed by the user's assigned role |
| **JWT** | JSON Web Token - stateless, signed authentication token |
| **PWA** | Progressive Web App - web application with offline and installable capabilities |
| **PostGIS** | PostgreSQL extension for geospatial data types and spatial indexing |
| **SHAP** | SHapley Additive exPlanations - ML model explainability framework |
| **MinIO** | S3-compatible open-source object storage |
| **IndexedDB** | Browser-native structured storage API used for offline data |
| **Workbox** | Google library for service worker and offline caching management |
| **Field Report** | A ranger-submitted record of an observed incident or sighting |
| **Tip-off** | A community liaison–submitted record of a suspected incident or sighting |
| **Geospatial Event** | A database entity with a geographic location and timestamp (Incident, Sighting, PatrolTrack) |
| **Soft-delete** | Marking a record as deleted without physically removing it from the database |
| **JTI** | JWT ID - a unique identifier embedded in a token used for revocation tracking |
| **ASGI** | Asynchronous Server Gateway Interface - Python async web server standard |
| **TLS** | Transport Layer Security - protocol for encrypted network communication |

### 1.4 References

| Document | Location |
|---|---|
| User Stories | `docs/requirements/User_Story.md` |
| Functional Requirements | `docs/requirements/Functional_Requirements.md` |
| API Service Contract | `docs/requirements/API_Service_Contract.md` |
| Domain Model | `docs/architecture/Domain_Model.md` |
| Quality Requirements | `docs/non-functional/Quality_Requirements.md` |
| Architecture | `docs/architecture/Architecture.md` |
| Technology Requirements | `docs/non-functional/Technology_Requirements.md` |
| Constraints | `docs/non-functional/Constraints.md` |
| Brand Style Guide | `docs/design/brand_style_guide.html` |
| Database Schema | `backend/init-db/01_schema.sql` |

### 1.5 Document Overview

Section 2 provides overall product context. Section 3 defines user roles. Section 4 states all functional requirements with their covering user stories. Section 5 states non-functional requirements. Sections 6–10 cover architecture, data model, API, technology stack, and constraints.

### 1.6 Demo 1 Scope (22 May 2026)

This SRS defines the **full system** requirements. Not all features are delivered in Demo 1. The following table distinguishes what is implemented and demonstrable at Demo 1 from what is planned for subsequent demos.

| Scope | Features |
|---|---|
| **Demo 1 (implemented)** | Full authentication and session management (register, login, logout, token refresh, password recovery, password reset); user account administration (list users, activate/deactivate, change role, delete pending account); audit logging; CI pipeline (GitHub Actions, pytest, Vitest, SonarCloud, Coveralls) passing on `main` |
| **Planned - later demos** | Risk heatmap and explainability panel; patrol route generation and comparison; field report capture and offline sync; CSV data ingestion pipeline; community tip-offs; operational dashboard and model performance metrics |

All requirements in sections 4 and 5 remain valid system-level requirements. The Demo 1 column above indicates implementation readiness, not reduced scope.

---

## 2. Overall Description

### 2.1 Product Perspective

Savanna Sentinel is a standalone web-based platform. It exposes a versioned REST API (`/v1/...`) consumed by a React PWA client. The system is containerised using Docker Compose and deployable to any Linux host via a single `docker compose up` command. An asynchronous Celery worker pipeline handles ML workloads independently of the API request cycle. All external traffic passes through a Caddy reverse proxy for automatic TLS termination.

### 2.2 Operating Environment

- **Frontend:** Any modern browser supporting service workers and IndexedDB (Chrome 90+, Firefox 88+, Safari 15.4+)
- **Backend:** Linux host running Docker; Python 3.11+ ASGI runtime
- **Database:** PostgreSQL 15+ with PostGIS 3.3+
- **Object Storage:** MinIO (S3-compatible)
- **Message Broker:** Redis 7+
- **Reverse Proxy:** Caddy 2+
- **Offline Mode:** Any device with service worker support; offline data stored in IndexedDB

### 2.3 Assumptions and Dependencies

- Admin accounts are provisioned directly at the database level. No API endpoint creates an Admin.
- The Resend SMTP relay (free tier, 100 emails/day) is sufficient for password reset email volume in the demo environment.
- A computed heatmap must exist before patrol route generation can proceed.

---

## 3. User Classes and Characteristics

The system enforces Role-Based Access Control (RBAC). All access control is enforced server-side; client-side role checks are UI hints only.

| Role | Description | Key Capabilities |
|---|---|---|
| **Ranger** | Field operative operating within the reserve | View heatmap, generate and retrieve patrol routes, submit / edit / delete own field reports online and offline |
| **Analyst** | Data analyst monitoring conservation effectiveness | Upload CSV historical data, view heatmap with explainability panel, view operational dashboard and model performance metrics |
| **Community Liaison** | Community member providing intelligence from the field | Submit tip-offs describing observed incidents or sightings |
| **Admin** | System administrator | Activate / deactivate user accounts, change user roles, view all users, permanently delete inactive (pending) user accounts, edit or soft-delete any field report, view audit log |

All newly registered accounts are created **inactive** (`is_active: false`) and require explicit Admin activation before login is permitted.

Admin accounts cannot be created, modified, or deactivated via the API. Admin provisioning is a database-level operation only.

---

## 4. Functional Requirements

Requirements are grouped by feature domain. Each entry references its covering user story (US) and requirement ID (R).

---

### 4.1 Identity & Access Management

#### 4.1.1 User Registration

**US1.1** - As a prospective user, I want to register for an account and select my intended role so that I can request the appropriate level of access once approved.

- **R9.2.1** The system shall allow prospective users to register by providing: username, email address, password, first name, last name, and an intended role selected from: `ranger`, `analyst`, `community_liaison`.
- **R9.2.2** All newly registered accounts shall be created in an inactive state and shall require explicit Admin activation before the user can log in.
- **R10.1.1** Passwords must be a minimum of 8 characters in length.
- **R10.1.2** The system shall display clear, human-readable validation error messages on all failed inputs. No raw exception text or HTTP status codes shall be shown.

#### 4.1.2 Authentication

**US1.3** - As a registered user, I want to log in with my credentials so that I receive a secure JWT session.

- **R9.1.1** The system shall only permit login for accounts where `is_active` is `true`.
- **R9.1.2** All login failure cases (incorrect username, incorrect password, inactive account) shall return an identical `401` response that does not reveal which condition caused the failure.
- **R1.1.2** The system shall use stateless JWT sessions (HS256) for authentication. Access tokens expire after 3600 seconds. Refresh tokens are stored in the database and tracked by JTI for revocation.

**US1.4** - As an authenticated user, I want to refresh my session so that I am not logged out while actively using the system.

- **R9.1.4** The system shall allow clients to obtain a new access token by presenting a valid, non-revoked refresh token. An invalid or revoked refresh token shall return `401 Unauthorised`.

**US1.6** - As an authenticated user, I want to log out so that my session is securely invalidated.

- **R9.1.3** On logout, the presented refresh token shall be revoked (`revoked_at` set in the database). Any subsequent use of that token shall return `401 Unauthorised`. The access token is discarded client-side.

#### 4.1.3 Password Recovery

**US1.7** - As a registered user, I want to reset my password via email so that I can regain access if I forget my credentials.

- **R9.1.5** The system shall provide a password recovery flow: the user submits their registered email address; if an active account exists, a time-limited (900 seconds), single-use reset link is dispatched to that address. Following the link allows the user to set a new password without knowing the current one. The reset token is invalidated after first use or after expiry. The endpoint returns `200 OK` regardless of whether the email matches an account, preventing user enumeration.

#### 4.1.4 Profile Management

**US1.5** - As a user, I want to update my profile and password so that my account information remains current and secure.

- **R9.4.1** The system shall allow authenticated users to view and update their own first name and last name.
- **R9.4.2** Password changes shall require the user's current password for verification. On success, all existing refresh tokens for that account are revoked.

#### 4.1.5 User Account Administration

**US1.2** - As an Admin, I want to review and activate or deactivate user accounts so that I can control who has access to the system.

- **R9.3.1** The system shall allow an Admin to view a comprehensive list of all system users and their current statuses, including accounts pending activation.
- **R9.3.2** The system shall allow an Admin to activate or deactivate user accounts.
- **R9.3.3** The system shall allow an Admin to modify the role of any non-Admin user account.
- **R9.3.4** The system shall prevent Admins from activating, deactivating, or modifying the role of any account that holds the Admin role.

**US1.9** - As an Admin, I want to reject and permanently delete a pending user application so that unauthorised or unwanted registrations are removed from the system.

- **R9.3.5** The system shall allow an Admin to permanently delete a user account that is in an inactive (pending) state, representing a rejected application. Active user accounts shall not be deletable via this endpoint; an Admin must first deactivate an account before deletion.
- **R9.3.6** On deletion, the system shall permanently remove the user record and all associated tokens (refresh tokens, password reset tokens) from the database. No soft-delete is applied; the record is irrecoverably removed.
- **R9.3.7** The system shall prevent Admins from deleting any account that holds the Admin role.
- **R9.3.8** User account deletion shall be recorded in the audit log (actor ID, action, target user ID, timestamp) before the record is removed.

#### 4.1.6 Audit Logging

**US1.8** - As an Admin, I want to view an audit log of administrator-level actions so that I can monitor system access and detect unauthorised activity.

- **R1.2.1** The system shall maintain an audit log recording: actor user ID, action performed, target record type and ID, and timestamp. The audit log shall be readable by Admins only and shall be immutable - no modification or deletion of entries is permitted.

#### 4.1.7 Role-Based Access Control

- **R1.1.1** The system shall support RBAC with the following predefined roles: `ranger`, `analyst`, `community_liaison`, `admin`.
- **R1.1.3** The system shall restrict access to views, features, map layers, and API data based on the authenticated user's assigned role. All access control is enforced server-side regardless of client state.
- **R1.2.2** All data in transit between client and server shall be encrypted via TLS. No endpoint shall be accessible over unencrypted HTTP.

---

### 4.2 Data Ingestion & Geospatial Management

**US2.1** - As an Analyst, I want to upload CSV files of historical data so that the risk engine has data to process.

- **R2.1.1** The system shall allow Analysts to upload CSV files of historical data for the following types: `incidents`, `patrol_tracks`, `sightings`, `tipoffs`.
- **R2.2.1** Validated data shall be persisted to a PostgreSQL database with PostGIS spatial indexing for efficient geospatial querying.
- **R2.1.4** On upload, the raw file shall be stored in object storage and a background processing job shall be queued for parsing and ingestion. The endpoint shall return a job ID immediately.

**US2.2** - As an Analyst, I want a data upload wizard with previews and validation errors so that I can fix data issues before committing.

- **R2.1.2** The system shall provide a validation endpoint that parses and validates an uploaded CSV without persisting any data, returning a total row count and per-row, human-readable error messages.
- **R2.1.3** The system shall parse and translate uploaded data into core geospatial entities: Incidents, Patrol Tracks, Sightings, and Tip-offs.
- **R2.1.5** Final upload shall only be triggered after the user has reviewed the validation results and explicitly confirmed the data is correct.

---

### 4.3 Risk Engine & Visualization

**US3.1** - As a Ranger or Analyst, I want to view a heatmap of high-risk areas so that I can identify poaching hotspots.

- **R3.1.1** The AI Risk Engine shall process historical geospatial event data via asynchronous background jobs to compute risk scores.
- **R3.1.2** The system shall calculate risk hotspots gridded by distinct time intervals.
- **R3.2.1** The system shall display a heatmap layer indicating high-risk areas based on computed risk scores.
- **R3.2.2** The system shall provide an interactive time range slider; the displayed heatmap shall update within 1 second of each new slider position.
- **R3.2.3** The system shall provide interactive map controls including legends and data filters.

**US3.2** - As a Ranger or Analyst, I want to see the reasoning behind a risk score so that I can understand why an area is marked high-risk.

- **R4.1.1** The Risk Engine shall generate explainability metrics using SHAP, detailing the contribution of each feature to each cell's computed risk score.
- **R4.2.1** The system shall provide an explainability panel that communicates the specific reasons a geographic cell is designated as high risk.
- **R4.2.2** The explainability panel shall present confidence levels without overclaiming model certainty.

**US3.3** - As a Ranger or Analyst, I want the map to display only data my role is authorised to access.

- **R3.2.4** The system shall enforce RBAC on all map data API endpoints such that each role receives only the data it is authorised to access, regardless of client state.

---

### 4.4 Field Operations & Offline PWA

**US4.1** - As a Ranger, I want to submit field reports offline via the PWA so that I can capture data in areas without connectivity.

- **R6.1.1** The system shall provide a Progressive Web App (PWA) interface for Rangers to capture Field Reports.
- **R6.1.2** Each field report is classified as either `incident` or `sighting`. A Ranger may submit multiple field reports during a single patrol. All reports capture: report type, location (lat/lon), `occurred_at`, and description. Incident reports additionally capture incident type and severity level (`low`, `medium`, `high`). Sighting reports additionally capture species name and an optional animal count. Each submitted report creates a corresponding geospatial event of the matching type. Offline data is persisted to the device using IndexedDB.
- **R6.1.3** The system shall optionally support photo capture associated with field reports, uploaded to MinIO via pre-signed URL.
- **R6.3.1** Reports shall sync automatically to the server within 60 seconds of connectivity being restored, without requiring any user action.

**US4.2** - As a Ranger, I want to edit and delete my field reports so that I can correct mistakes and manage my submissions.

- **R6.2.1** The system shall allow Rangers to edit their own previously submitted field reports, both online and offline. Editable common fields: description, location, `occurred_at`, and associated photos. For incident reports, incident type and severity are additionally editable. For sighting reports, species name and animal count are additionally editable.
- **R6.2.2** The system shall allow Rangers to soft-delete their own previously submitted field reports. Deleted records are retained in the database for audit purposes but excluded from all UI queries.
- **R6.2.4** A Ranger shall not be permitted to edit or delete field reports submitted by another Ranger. All ownership enforcement is server-side.

**US4.3** - As a Ranger, I want to generate optimal patrol routes based on risk and resource constraints so that I can patrol safely and efficiently.

- **R5.1.1** The Patrol Planner shall accept the following inputs: starting point (lat/lon), maximum patrol time, and fuel constraint.
- **R5.1.2** The Patrol Planner shall consume the generated Risk Heatmap and resource constraints to generate multiple alternative patrol routes per planning request. All alternatives share a common `request_id` and prioritise coverage of high-risk areas.
- **R5.3.1** The system shall provide a side-by-side route comparison interface displaying risk coverage, estimated time, and estimated fuel consumption for each alternative.

**US4.4** - As a Ranger or Analyst, I want to view my previously generated patrol routes so that I can review past plans without regenerating them.

- **R5.2.1** The system shall allow authenticated Rangers and Analysts to retrieve their previously generated patrol route requests, with alternatives grouped by their shared `request_id`. Each route record displays its start point, resource constraints, suggested path, risk coverage, estimated time, and estimated fuel consumption.

**US4.5** - As a Ranger, I want my offline field reports to sync without silent data loss so that I can trust that what I captured in the field is accurately reflected in the system.

- **R6.3.2** The Sync Service shall detect and resolve conflicts arising from concurrent offline edits and offline deletions deterministically. No record shall be silently overwritten and soft-deleted records shall be correctly propagated to the central database on sync.

**US4.6** - As an Admin, I want to edit or delete any field report so that I can correct data quality issues and manage submissions across all rangers.

- **R6.2.3** The system shall allow Admins to edit or soft-delete any field report regardless of the submitting Ranger. Admins may edit the same fields as the submitting Ranger, including type-specific fields (incident type and severity for incident reports; species name and count for sighting reports).

---

### 4.5 Community Tip-off

**US5.1** - As a Community Liaison, I want to submit a tip-off about a suspected incident or sighting so that rangers can be informed of potential threats.

- **R7.1.1** The system shall allow Community Liaisons to submit tip-offs. All tip-offs capture: report type (`incident` or `sighting`), location, `occurred_at` (must not be in the future), description, and optional photo evidence. Incident tip-offs additionally capture incident type and severity level. Sighting tip-offs additionally capture species name and optional animal count.
- **R7.1.2** Each tip-off shall be associated with the submitting Community Liaison user account.

---

### 4.6 Dashboards & Analytics

**US6.1** - As an Analyst or Admin, I want to view operational dashboard cards so that I can monitor patrol coverage, field report trends, and system activity at a glance.

- **R8.1.1** The system shall display dashboard cards summarising key operational metrics including patrol coverage (area covered vs. total), field report counts by type, and recent trends.

**US6.2** - As an Analyst, I want to view basic model performance metrics so that I can assess the reliability of the AI Risk Engine.

- **R8.1.2** The system shall display model performance metrics. Metrics shall be clearly labelled and must not overclaim model certainty.

---

### 4.7 General Application

- **R10.1.1** The system shall enforce client-side and server-side validation on all user inputs to prevent malformed data. Passwords must be a minimum of 8 characters in length.
- **R10.1.2** The system shall display clear, human-readable error messages when validation fails. No raw exception text or HTTP status codes shall be displayed to the user.

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement |
|---|---|
| QR1.1 | The interactive risk heatmap shall render within **2 seconds** for a grid of up to 10,000 cells on a standard desktop browser. |
| QR1.2 | Patrol route suggestions shall be returned within **5 seconds** for a reserve area of up to 500 km² under default resource constraints. |
| QR1.3 | CSV ingestion of files containing up to 100,000 rows shall complete within **30 seconds** without blocking the user interface. |
| QR1.4 | Standard authenticated API endpoints shall respond within **500 ms** at the 95th percentile under normal concurrent load. |
| QR1.5 | The time range slider shall update the displayed heatmap within **1 second** of each new slider position. |

### 5.2 Reliability

| ID | Requirement |
|---|---|
| QR2.1 | Zero field report records shall be dropped during an offline-to-online synchronisation cycle. |
| QR2.2 | The AI Risk Engine shall produce consistent, reproducible risk scores given the same historical input dataset. |
| QR2.3 | The data ingestion pipeline shall reject malformed CSV rows without corrupting or discarding valid rows in the same upload, and shall report each invalid row with a human-readable error message. |
| QR2.4 | The Sync Service shall resolve conflicts deterministically; no records shall be silently overwritten and soft-deleted records shall propagate correctly on sync. |

### 5.3 Availability

| ID | Requirement |
|---|---|
| QR3.1 | The PWA shall remain fully functional for offline field data capture (incident and sighting entry) with zero network connectivity. |
| QR3.2 | Offline data shall synchronise automatically within **60 seconds** of network connectivity being restored, without requiring user action. |
| QR3.3 | The production deployment shall maintain **99% uptime** over any 30-day window, as measured by UptimeRobot and NodePing. |

### 5.4 Scalability

| ID | Requirement |
|---|---|
| QR4.1 | The database shall support at least **10 million** historical records (incidents, sightings, patrol tracks) without degradation in spatial query response times. |
| QR4.2 | The system shall sustain at least **50 concurrent authenticated sessions** without a measurable increase in API response time compared to a single-user baseline. |
| QR4.3 | Additional background processing workers shall be addable via deployment-level configuration only, without modifying application code. |

### 5.5 Security

| ID | Requirement |
|---|---|
| QR5.1 | All data transmitted between client and server shall be encrypted via TLS. No endpoint shall be accessible over unencrypted HTTP. |
| QR5.2 | RBAC shall be enforced server-side on every API request such that a Ranger cannot access Analyst-only or Admin-only resources regardless of client-side state. |
| QR5.3 | RBAC shall be enforced per endpoint such that each role receives only the data it is authorised to access, as defined in the API Service Contract. |
| QR5.4 | Passwords shall be stored using salted bcrypt hashing with a minimum cost factor of 12. No plaintext or reversibly encrypted passwords shall exist in the database. |
| QR5.5 | An immutable audit log of all administrator-level actions shall be maintained, recording actor, action, and timestamp. |
| QR5.6 | The login endpoint shall return an identical error response for all failure cases (wrong username, wrong password, inactive account), preventing user enumeration. |
| QR5.7 | Only login, registration, password recovery, password reset, and token refresh endpoints shall be publicly accessible. All other endpoints require a valid JWT Bearer token. |

### 5.6 Maintainability

| ID | Requirement |
|---|---|
| QR6.1 | All backend modules shall maintain a minimum of **70% unit test line coverage**, measured by Coveralls on every push to `main`. |
| QR6.2 | The CI pipeline shall block merges to `main` if any automated test, SonarCloud quality gate, or build step fails. |
| QR6.3 | All REST API endpoints shall be described in the auto-generated OpenAPI specification, including request parameters, response schemas, and authentication requirements. |

### 5.7 Usability

| ID | Requirement |
|---|---|
| QR7.1 | All validation error messages shall be written in plain, human-readable language. No raw exception text or HTTP status codes shall be displayed. |
| QR7.2 | The explainability panel shall present AI confidence levels with clear uncertainty language such that users do not interpret output as a definitive or certain prediction. |
| QR7.3 | The patrol route comparison interface shall display all route alternatives simultaneously on a single screen, with risk coverage, estimated time, and estimated fuel consumption for each route. |

### 5.8 Accessibility

| ID | Requirement |
|---|---|
| QR8.1 | All text and interactive element colour combinations shall achieve a contrast ratio of at least **4.5:1**, conforming to WCAG Level AA. |
| QR8.2 | All interactive map controls, navigation menus, and form elements shall be fully operable using only a keyboard. |
| QR8.3 | Dynamic content regions shall use semantic HTML elements and ARIA roles such that they are correctly announced by modern screen readers. |

---

## 6. System Architecture

Savanna Sentinel is structured across four logical tiers:

```
[ React PWA Client ]
         │  HTTPS / REST API
[ Caddy Reverse Proxy ]  ──  TLS termination
         │
[ FastAPI Backend (ASGI) ]
    ├── Auth & RBAC Service
    ├── Data Ingestion Controller
    ├── Sync Service
    └── Domain Services (reports, routes, tipoffs, dashboard)
         │
   [ Redis ]  ──  Message broker + API-level cache
         │
[ Celery Workers ]
    ├── AI Risk Engine  (scikit-learn · GeoPandas · SHAP)
    ├── Patrol Route Planner
    └── CSV Ingestion Worker
         │
[ PostgreSQL + PostGIS ]        [ MinIO Object Storage ]
  Structured & geospatial         CSV files, photos
```

### 6.1 Key Architectural Patterns

**Client–Server (RESTful):** All communication is over HTTPS via versioned REST endpoints (`/v1/...`). The server is stateless; authentication state is carried in JWTs on every request.

**Offline-First:** The PWA caches the application shell via Workbox service workers. Field reports are written to IndexedDB (Dexie.js) when offline. The Workbox Background Sync API automatically replays queued mutations within 60 seconds of reconnection.

**Asynchronous Task Queue:** ML computation (risk scoring, route planning) and CSV ingestion run in Celery workers. The API returns a job ID immediately (`202 Accepted`); the client polls for completion. Workers never block the API.

**Layered Backend:** The FastAPI backend enforces strict three-layer separation - Router (HTTP parsing only) → Service (business logic) → Repository (all database queries). No layer may be skipped.

**Soft Deletes:** Field reports are never hard-deleted. The `deleted_at` timestamp is set on deletion; deleted records are excluded from all queries but retained in the database for audit purposes.

**Photo Upload:** The client requests a pre-signed MinIO URL from the backend, uploads the file directly to MinIO, and includes the resulting object URL in the report or tip-off submission body. Large files never traverse the FastAPI process.

### 6.2 Backend Layer Responsibilities

| Layer | Responsibility |
|---|---|
| Router (`api/v1/`) | Parse HTTP request, validate body shape, raise `HTTPException`, return response model |
| Service (`services/`) | Business logic, role checks, orchestration. No FastAPI or HTTP knowledge. |
| Repository (`repositories/`) | All database queries via SQLAlchemy async sessions. No business logic. |

### 6.3 Frontend State Management

- **Zustand** store (`authStore.ts`) holds `accessToken`, `refreshToken`, and `user`, persisted to `localStorage`.
- **Axios** instance (`api.ts`) attaches `Authorization: Bearer <token>` to every request. On `401`, it silently calls `refreshSession()` and retries. On refresh failure it calls `logout()`.
- **ProtectedRoute** wraps all non-public routes; redirects to `/login` if no access token is present.

---

## 7. Data Model

The authoritative schema is in `backend/init-db/01_schema.sql`. The entity-relationship diagram is in `docs/architecture/Domain_Model.md`. The following describes the core entities and their relationships.

### 7.1 User & Auth Entities

**users** - id (UUID), username, email, password_hash, first_name, last_name, role, is_active, created_at.

**refresh_tokens** - jti (UUID, PK), user_id (FK → users), issued_at, expires_at, revoked_at. Multiple tokens per user (one per device/session).

**password_reset_tokens** - id, user_id (FK → users), token_hash, expires_at, used_at, created_at.

**audit_logs** - id, actor_id (FK → users), action, target_type, target_id, details (JSONB), created_at.

### 7.2 Geospatial Entities

**geospatial_events** - id, event_type (`incident` | `sighting` | `patrol_track`), location (Geography Point, SRID 4326), occurred_at. Parent table for the specialised types below.

**incidents** - id (PK → geospatial_events), field_report_id (FK, unique), tipoff_id (FK, unique), incident_type, description, severity. Exactly one of field_report_id or tipoff_id is set; both null indicates CSV ingestion.

**sightings** - id (PK → geospatial_events), field_report_id (FK, unique), tipoff_id (FK, unique), species, count. Same constraint as incidents.

**patrol_tracks** - id (PK → geospatial_events), route_line (Geography LineString), distance_covered.

**photos** - id, geospatial_event_id (FK → geospatial_events), image_url, uploaded_at.

### 7.3 Field Operations Entities

**field_reports** - id, submitted_by (FK → users), route_id (FK → patrol_routes, nullable), report_type (`incident` | `sighting`), description, location, occurred_at, created_at, updated_at, deleted_at. A report creates exactly one incident or one sighting based on report_type.

**tipoffs** - id, submitted_by (FK → users), report_type, description, location, occurred_at, created_at, deleted_at. Creates exactly one incident or one sighting based on report_type.

### 7.4 Patrol Planning Entities

**patrol_routes** - id, request_id (UUID, groups alternatives from one planning request), requested_by (FK → users), start_point, max_time, max_fuel, suggested_path (Geography LineString), estimated_time, estimated_fuel, risk_coverage, created_at.

### 7.5 Risk Engine Entities

**risk_heatmaps** - id, grid_resolution, time_interval, computed_at.

**grid_cells** - id, heatmap_id (FK → risk_heatmaps), polygon_bounds (Geography Polygon), risk_score.

**explainability_metrics** - id, cell_id (FK → grid_cells), key_reason, confidence_level.

---

## 8. API Overview

The full API Service Contract - including request/response bodies, preconditions, postconditions, and all error codes - is in `docs/requirements/API_Service_Contract.md`. All endpoints use the base path `/v1`. All endpoints except those marked *Public* require a valid `Authorization: Bearer <access_token>` header.

### 8.1 Authentication (Public)

| SC | Method | Path | Description |
|---|---|---|---|
| SC-01 | POST | `/v1/auth/register` | Register a new inactive user account |
| SC-02 | POST | `/v1/auth/login` | Authenticate and receive JWT access + refresh tokens |
| SC-03 | POST | `/v1/auth/logout` | Revoke the current refresh token |
| SC-04 | POST | `/v1/auth/refresh` | Exchange a valid refresh token for a new access token |
| SC-17 | POST | `/v1/auth/forgot-password` | Trigger a password reset email |
| SC-18 | POST | `/v1/auth/reset-password` | Set a new password using a reset token |

### 8.2 User Management

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-05 | GET | `/v1/users/me` | All | Retrieve own profile |
| SC-06 | PATCH | `/v1/users/me` | All | Update own profile or password |
| SC-19 | GET | `/v1/users` | Admin | List all users with filtering and pagination |
| SC-15 | PATCH | `/v1/users/{id}/role` | Admin | Change a non-Admin user's role |
| SC-16 | PATCH | `/v1/users/{id}/status` | Admin | Activate or deactivate a non-Admin user account |
| SC-30 | DELETE | `/v1/users/{id}` | Admin | Permanently delete an inactive (pending) user account |

### 8.3 Data Ingestion

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-07 | POST | `/v1/ingestion/validate` | Analyst, Admin | Validate a CSV without persisting |
| SC-08 | POST | `/v1/ingestion/upload` | Analyst, Admin | Upload a CSV and queue a processing job |
| SC-09 | GET | `/v1/ingestion/uploads/{id}` | Analyst, Admin | Poll upload job status |
| SC-10 | POST | `/v1/media/upload-url` | Ranger, Community Liaison, Admin | Get a pre-signed MinIO upload URL |

### 8.4 Field Reports

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-11 | POST | `/v1/reports` | Ranger, Admin | Submit a new field report |
| SC-12 | PATCH | `/v1/reports/{id}` | Ranger, Admin | Edit an existing field report |
| SC-13 | DELETE | `/v1/reports/{id}` | Ranger, Admin | Soft-delete a field report |
| SC-20 | GET | `/v1/reports` | Ranger, Admin | List field reports (Ranger sees own; Admin sees all) |
| SC-21 | GET | `/v1/reports/{id}` | Ranger, Admin | Retrieve a single field report |
| SC-28 | POST | `/v1/reports/sync` | Ranger, Admin | Batch sync offline-queued reports |

### 8.5 Community Tip-offs

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-14 | POST | `/v1/tipoffs` | Community Liaison, Admin | Submit a tip-off |
| SC-27 | GET | `/v1/tipoffs` | Community Liaison, Analyst, Admin | List tip-offs |

### 8.6 Risk Heatmap

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-22 | GET | `/v1/risk/heatmap` | Ranger, Analyst, Admin | Retrieve the current risk heatmap with per-cell explainability |

### 8.7 Patrol Routes

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-23 | POST | `/v1/routes` | Ranger, Analyst, Admin | Generate patrol route alternatives (async; returns job_id and request_id) |
| SC-24 | GET | `/v1/routes` | Ranger, Analyst, Admin | List patrol routes; filter by request_id to retrieve alternatives |
| SC-25 | GET | `/v1/routes/{id}` | Ranger, Analyst, Admin | Retrieve a single patrol route |

### 8.8 Dashboard & Audit

| SC | Method | Path | Access | Description |
|---|---|---|---|---|
| SC-26 | GET | `/v1/dashboard` | Analyst, Admin | Get operational dashboard metrics |
| SC-29 | GET | `/v1/audit-logs` | Admin | List audit log entries with filtering and pagination |

---

## 9. Technology Stack

| Layer | Technology | Key Rationale |
|---|---|---|
| Frontend | React 19 (TypeScript) | Client recommendation; native PWA and Workbox integration; type-safe geospatial API integration |
| UI Components | shadcn/ui + Tailwind CSS v4 | Components owned in-project (not a black-box); Radix UI primitives for built-in keyboard nav and ARIA; matches Brand Style |
| Mapping | MapLibre GL | GPU-accelerated WebGL rendering supports 10,000+ heatmap cells without frame rate degradation; open-source; vector tile RBAC layer toggling |
| PWA / Offline | Workbox + Dexie.js (IndexedDB) | Service worker shell caching + Background Sync API; typed IndexedDB wrapper for structured offline report storage |
| Backend API | Python FastAPI (ASGI) | Client recommendation; auto-generated OpenAPI spec; async I/O for concurrent requests; co-located with ML libraries |
| Background Jobs | Celery + Redis | Decouples ML workloads from API request cycle; Redis broker reused for caching; Celery Beat for periodic model retraining |
| Database | PostgreSQL 15 + PostGIS 3 | Client mandate; GiST/BRIN spatial indexes for ST_Within and ST_DWithin at scale; ACID compliance for sync integrity |
| Object Storage | MinIO (S3-compatible, boto3) | Self-hosted within Docker Compose; no per-GB fees; pre-signed URL support; S3-compatible for future provider migration |
| AI / ML | scikit-learn + GeoPandas + pandas + SHAP | Ensemble risk scoring on tabular spatio-temporal data; spatial feature engineering; per-cell SHAP explainability metrics |
| Auth | JWT HS256 (PyJWT) | Stateless sessions; HS256 symmetric signing appropriate for monolithic deployment; role claim drives RBAC; JTI enables refresh token revocation |
| Reverse Proxy | Caddy | Automatic TLS certificate provisioning; declarative Caddyfile; no separate certbot process |
| Email | Resend SDK | Transactional password reset emails; free tier sufficient for demo; standard SMTP - provider-swappable via env var |
| DevOps | Docker Compose + GitHub Actions | Single-command environment parity across all developers; CI blocks merges on failing tests, SonarCloud gates, or build failures |

---

## 10. Constraints

**C1 - Open-Source Stack**
All libraries, frameworks, and infrastructure components must be open-source. No proprietary SaaS services may be introduced beyond Resend (transactional email).

**C2 - Docker Deployment**
The entire system - backend, frontend, database, object storage, message broker, and reverse proxy - must be deployable via a single `docker compose up` command with no manual configuration steps.

**C3 - Progressive Web App**
The frontend must function as an installable PWA with offline data capture capability for Rangers. Service workers (Workbox) and IndexedDB (Dexie.js) are mandatory components.

**C4 - Data Sensitivity and HTTPS**
All conservation and user data must be encrypted in transit via TLS. No data may be transmitted over unencrypted HTTP under any circumstances.

**C5 - Budget Cap**
Total infrastructure and tooling costs must not exceed R5,000 for the duration of the project. The Docker Compose self-hosted stack incurs no per-use fees for MinIO, Redis, or PostgreSQL.