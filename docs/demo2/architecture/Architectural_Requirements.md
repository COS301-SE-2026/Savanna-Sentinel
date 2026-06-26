# ARCHITECTURAL SPECIFICATIONS - SAVANNA SENTINEL

**Team:** SIGILL **Project:** Savanna Sentinel **Demo:** Demo 2

---

## ARCHITECTURAL DIAGRAM

_[Insert architectural diagram here - Demo 2, Version 2 diagram]_

---

## ARCHITECTURAL PATTERNS

LAYERED PATTERN (N-TIER ARCHITECTURE)

The Layered architectural pattern organizes the system into horizontal layers, with each layer interacting only with the one immediately adjacent to it, promoting separation of concerns and modularity.

The architecture diagram is divided into distinct layers: Presentation Layer, Reverse Proxy, Application Layer, Async Processing Layer and Data Layer with each layer having specific responsibilities. The user interacts only with the Presentation Layer which forwards all requests over HTTPS through the Reverse Proxy into the Application Layer.

MICROSERVICES-STYLE PATTERN

The Application Layer is broken into five independently grouped services - Auth & Access Control, Field Operations, Sync Service, Analytics & Intelligence and Data Ingestion - each handling a distinct area of system functionality and communicating with the Async Processing and Data layers as needed, rather than through one another.

This grouping allows each service area to be developed and tested largely in isolation, consistent with the project's single-responsibility ownership per developer.

EVENT-DRIVEN / ASYNC PROCESSING PATTERN

The system offloads long running or compute heavy work - Risk Scoring, Route Planning, CSV Ingestion and Explainability generation - to a Worker Pool that consumes tasks from a Message Broker rather than processing them inline within a request.

Application Layer services enqueue tasks to the Message Broker (for example, Data Ingestion enqueues a task with a file reference rather than the file itself) and the Worker Pool processes these asynchronously, reading and writing the Data Layer directly.

---

## ARCHITECTURAL CONSTRAINTS

TECHNICAL CONSTRAINTS

The backend is built with FastAPI (Python), structured around a stub-first repository pattern to permit parallel frontend/backend development before the database is fully wired up.

The database is PostgreSQL, run in Docker for local development, all access goes through the Data Layer rather than being called directly from Application Layer services.

The frontend is React + TypeScript + Vite, styled exclusively via Tailwind utility classes mapped to CSS custom properties, with no hardcoded hex values in components.

Authentication is JWT-based. JWT issuance and verification is owned by a separate team member and is marked at integration points with `JWT NOTE` comments rather than being re-implemented elsewhere.

All long running or compute heavy operations (risk scoring, route planning, CSV ingestion, explainability generation) must be processed via the Message Broker and Worker Pool rather than synchronously within a request handler, to keep the Application Layer responsive.

ORGANISATIONAL CONSTRAINTS

Each core feature area (e.g login, risk engine, patrol planning) is owned by one team member, which constrains the architecture toward clearly bounded services that can be developed and tested in isolation, reflected in the Application Layer's service grouping.

Backend services must function without a live database connection during early development, with explicit `DB NOTE` comments marking the points where stub data is swapped for real PostgreSQL queries. This constrains the Data Layer's interfaces to be defined and stable before their implementations are finalised.

LEGAL / DATA CONSTRAINTS

Field reports and tip-offs may include user-submitted photo evidence, which constrains Object Storage to handle file uploads with appropriate access control, separate from the Primary Database.

Audit log entries must be immutable once written, which constrains the Primary Database schema and the Application Layer's audit-logging logic to be append-only for that data.

---

## DESIGN PATTERNS

ADAPTER DESIGN PATTERN

The Adapter Design Pattern can be found in `security.py`, which defines a `_JWTAdapter` wrapping the custom JWT encode/decode behaviour behind a simple, stable interface.

Purpose: The Adapter pattern allows the rest of the codebase to depend on a consistent internal interface for JWT operations, rather than depending directly on the underlying JWT library's API. This means the underlying JWT library could be swapped without changing any calling code.