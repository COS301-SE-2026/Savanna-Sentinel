# ARCHITECTURAL SPECIFICATIONS - SAVANNA SENTINEL

**Team:** SIGILL **Project:** Savanna Sentinel **Demo:** Demo 2

---

## ARCHITECTURAL DIAGRAM

[Insert architectural diagram here]

---

## ARCHITECTURAL PATTERNS

LAYERED PATTERN (N-TIER ARCHITECTURE)

The Layered architectural pattern organizes the system into horizontal layers, with each layer interacting only with the one immediately adjacent to it, promoting separation of concerns and modularity.

The architecture diagram is divided into distinct layers: Presentation Layer, Reverse Proxy, Application Layer, Async Processing Layer and Data Layer, with each layer having specific responsibilities. The user interacts only with the Presentation Layer which forwards all requests over HTTPS through the Reverse Proxy into the Application Layer.

Within the Application Layer, responsibilities are further organized into five distinct module groupings - Auth & Access Control, Field Operations, Sync Service, Analytics & Intelligence and Data Ingestion - each owning a clearly bounded area of functionality. These are internal divisions of a single deployable backend, not independently deployable services: they run in one process/container and do not start, scale or fail independently of one another. This grouping supports the project's single-responsibility ownership per developer while keeping the system within one application layer.

ASYNCHRONOUS TASK PROCESSING PATTERN

The system offloads long running or compute heavy work - Risk Scoring, Route Planning, CSV Ingestion and Explainability generation - to a Worker Pool that consumes tasks from a Message Broker rather than processing them inline within a request.

Application Layer services enqueue tasks to the Message Broker (for example, Data Ingestion enqueues a task with a file reference rather than the file itself) and the Worker Pool processes these asynchronously reading and writing the Data Layer directly. This is a task-offloading pattern rather than an event-driven one: there is no broader set of system states that changes how a request is handled. The only state-like condition is the queue/buffer being full, in which case a task is queued or rejected - the request-handling behaviour itself does not change based on internal system state.

---

## ARCHITECTURAL CONSTRAINTS

A constraint restricts the space of possible solutions, it is not itself the solution chosen within that space. The items below describe restrictions the team had to design around, separate from the specific technologies picked to satisfy them.

TECHNICAL CONSTRAINTS

- The system must remain usable by rangers in the field with little or no connectivity, which constrains the frontend to support offline data capture and deferred sync rather than assuming a constant network connection. (Addressed via a Progressive Web App implementation.)
- Frontend styling must be maintainable and consistent across a five-person team working in parallel which constrains the styling approach to a single shared design-token system rather than per-component hardcoded values.
- Authentication and authorization logic must be implemented once and reused everywhere it's needed which constrains the system to a single, centrally owned auth mechanism rather than allowing each feature area to handle identity independently.
- Long running or compute heavy operations (risk scoring, route planning, CSV ingestion, explainability generation) must not block request handling, which constrains these operations to be processed outside the synchronous request/response cycle.
- The application layer must remain testable and runnable before the database is fully available, which constrains backend interfaces to be defined and stable ahead of their underlying implementations.
- The system must be deployable and verifiable with minimal manual setup, and every change must be validated before it reaches the main branch, which constrains the deployment process to be fully automatable and the build/test cycle to run unattended. (Addressed via Docker, Docker Compose, and GitHub Actions CI/CD.)

ORGANISATIONAL CONSTRAINTS

- Each core feature area (e.g login, risk engine, patrol planning) must be ownable and deliverable by a single team member working largely independently which constrains the system's internal boundaries to be clearly separated, low-coupling areas of responsibility.
- Development must be able to proceed without every team member waiting on a live, fully populated database, which constrains backend components to function against stub data during early development, with the points where stub data is replaced by real queries explicitly marked.
- Total spend across cloud services, third-party integrations and tooling is capped at R5000 which is provided by EPI-USE, which constrains all infrastructure and service choices to fit within that budget.

LEGAL / DATA CONSTRAINTS

- Field reports and tip-offs may include user-submitted photo evidence of a sensitive nature, which constrains file storage to enforce access control separate from and stricter than general application data.
- Audit log entries must be legally defensible and tamper-evident once written, which constrains the audit-logging data and logic to be append-only, with no update or delete path for existing entries.
- The system handles sensitive conservation data, including poaching incident locations, patrol routes, and informant tip-offs, the exposure of which could cause real-world harm, which constrains all data in transit to be encrypted and constrains sensitive map layers to be restricted by authenticated user role. (Addressed via HTTPS and role-based access control.)

---

## DESIGN PATTERNS

No design patterns yet