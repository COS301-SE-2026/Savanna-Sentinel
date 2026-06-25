### 1. Preliminary Architecture Overview

Savanna Sentinel employs a modern, decoupled four-tier architecture designed to support high-performance geospatial querying, asynchronous machine learning processing, and offline-first field operations. The system is divided into four primary logical tiers: the Presentation Layer (PWA Client), the Application Layer (REST API Server), the Asynchronous Processing Layer (Worker Queue), and the Data Layer.

The entire system is containerised to ensure environment parity across local development, testing, and production deployments. All external traffic is routed through a reverse proxy that handles TLS termination and HTTPS enforcement automatically.

---

### 2. Architectural Patterns

The system combines four complementary patterns to satisfy its functional and non-functional requirements.

#### 2.1 Client-Server (RESTful API)

The Presentation Layer (PWA Client) is entirely decoupled from the Application Layer (REST API Server).

- **Communication:** All communication occurs over HTTPS via a versioned REST API (`/v1/...`). The server is stateless; session state is carried in signed bearer tokens attached to every request.
- **Documentation:** API contracts are formally defined in an auto-generated OpenAPI specification, ensuring unambiguous integration between the frontend and backend.
- **Statelessness:** No client session is stored on the server. The bearer token is the sole source of identity and role information on each request.

#### 2.2 Offline-First

Rangers operate in game reserve areas with no reliable network connectivity. Offline capability is a first-class architectural concern, not an afterthought.

- **Application Shell Caching:** A service worker caches the application shell so the PWA loads and renders without any network connection.
- **Local Data Persistence:** Field reports captured offline are written to a client-side structured database on the device before any attempt to reach the server.
- **Background Synchronisation:** When connectivity is restored, a background sync process automatically replays queued write operations against the REST API without requiring any user action. The server resolves conflicts deterministically - no record is silently overwritten.

#### 2.3 Asynchronous Task Queue

Risk score computation, patrol route generation, and bulk CSV ingestion are computationally expensive and must not block the synchronous API request cycle.

- **Message Broker:** The API enqueues these tasks via a message broker and returns a job ID to the client immediately, keeping API response times within the required p95 < 500 ms threshold.
- **Worker Processes:** Dedicated worker processes subscribe to the queue, execute tasks independently of the API, and write results to the primary database on completion.
- **Polling:** The client polls the API for job completion status until results are available.

#### 2.4 Layered Backend (N-Layer)

The REST API server enforces strict three-layer separation of concerns, ensuring no layer is bypassed.

- **Controller Layer:** Parses HTTP requests, validates request shape, enforces role-based access control via token inspection, and returns response models. Contains no business logic.
- **Service Layer:** Implements all business rules including patrol planning constraints, conflict resolution, and data validation. Has no knowledge of HTTP or the database.
- **Repository Layer:** Executes all database queries via an async session. Contains no business logic.

---

### 3. System Components (Logical View)

#### Email Service
Invoked by the Auth & Access Control Service to dispatch transactional password reset emails to users. Communicates outbound to an external email relay over HTTPS. No inbound path; no additional worker process required.

#### Reverse Proxy
- Single entry point for all external HTTPS traffic.
- Handles automatic TLS certificate provisioning and HTTPS enforcement.
- Forwards requests to the REST API server.

#### Presentation Layer (PWA Client)
- **Map UI Module:** Renders base map tiles and overlay layers (risk heatmap, patrol routes) using GPU-accelerated rendering. Supports role-based layer visibility, an interactive time range slider, and an explainability panel.
- **PWA Core:** Manages offline states via a service worker and a client-side structured database. Runs the background sync engine that automatically replays queued mutations when connectivity is restored.
- **Dashboard Module:** Renders operational analytics cards, model performance metrics, and the AI explainability panel for authorised roles.

#### Application Layer (REST API Server)
- **Auth & Access Control Service:** Validates signed bearer tokens on every request and enforces role-based access controls at both the route level and the data query level.
- **Data Ingestion Controller:** Receives uploaded data files, performs initial format validation, stores raw files in object storage, and enqueues a background parsing task.
- **Sync Service:** Receives offline-queued report batches from the PWA, resolves conflicts deterministically by comparing timestamps, and returns per-record sync outcomes to the client.

#### Asynchronous Processing Layer (Worker Queue)
- **Risk Scoring Module:** Consumes historical geospatial event data and computes a risk score grid across configurable time intervals.
- **Explainability Module:** Generates per-cell feature contribution metrics that communicate the reasoning and confidence behind each risk score without overclaiming model certainty.
- **Route Planning Module:** Calculates multiple constraint-based patrol route alternatives against the generated risk grid, grouped by a shared planning request ID.
- **CSV Ingestion Worker:** Parses, validates, and persists uploaded historical data files row by row, reporting per-row errors without discarding valid rows.

#### Data Layer
- **Primary Database (Relational + Spatial Extension):** Stores all structured data including users, field reports, tip-offs, patrol routes, and risk grid data. Spatial indexing supports the high-speed geospatial bounding-box and proximity queries required by the risk engine.
- **Object Storage:** Stores unstructured binary data including uploaded CSV files, and photographic evidence submitted with field reports and tip-offs.
- **In-Memory Store:** Acts as the message broker for the worker queue and as a short-lived cache for high-frequency map data API responses, reducing repeated primary database query load.

---

### 4. Transactional Email Delivery

Password recovery requires the system to dispatch a time-limited reset link to the requesting user's registered email address.

**Component:** Email Service  
**Location:** Application Layer - invoked directly from the Auth & Access Control Service during the password recovery request handler. No additional worker process or container is introduced; the operation is lightweight and synchronous at the service layer.

**Flow:**

1. The client submits a password recovery request containing the user's registered email address.
2. The Auth Service checks whether an active account exists for that address.
3. If a match is found, a time-limited reset token (TTL: 900 seconds) is persisted to the primary database against the user record.
4. The Auth Service calls the Email Service to dispatch a reset email containing the token link to the user's address.
5. The endpoint returns a success response regardless of whether a match was found, preventing account enumeration.
6. The client submits the token and new password to the password reset endpoint to complete the flow.

**Environment variables required:**

| Variable | Description |
|---|---|
| `EMAIL_API_KEY` | API key issued by the transactional email provider |
| `EMAIL_FROM_ADDRESS` | Verified sender address (e.g. `noreply@savanna-sentinel.app`) |
| `FRONTEND_BASE_URL` | Base URL prepended to the reset token path in the emailed link |

---

### 5. Architecture Diagram

```mermaid
flowchart TD
    User

    subgraph Proxy["Reverse Proxy - TLS / HTTPS Enforcement"]
    end

    subgraph PL["Presentation Layer - PWA Client"]
        MapUI["Map UI Module\nHeatmap - Routes - Time Slider - Filters"]
        Core["PWA Core\nService Worker - Local Database - Background Sync"]
        Dash["Dashboard Module\nAnalytics - Explainability Panel"]
    end

    subgraph AL["Application Layer]
        Auth["Auth & Access Control Service"]
        Ingest["Data Ingestion Controller"]
        Sync["Sync Service"]
    end

    subgraph APL["Asynchronous Processing Layer - Worker Queue"]
        MQ["Message Broker"]
        Risk["Risk Scoring Module"]
        Expl["Explainability Module"]
        Route["Route Planning Module"]
        CSV["CSV Ingestion Worker"]
    end

    subgraph DL["Data Layer"]
        DB[("Primary Database\nRelational + Spatial Extension")]
        Obj[("Object Storage")]
        Mem[("In Memory Store\nCache + Queue Broker")]
    end

    Email["Email Service\n(External Relay)"]

    User -->|HTTPS| Proxy
    Proxy <-->|Forwards requests| AL
    PL <-->|REST API calls via Proxy| Proxy
    Auth & Ingest -->|Enqueue tasks| MQ
    MQ --> Risk & Expl & Route & CSV
    AL <-->|Read / Write| DB
    Ingest -->|Store files| Obj
    Risk & Expl & Route & CSV -->|Read / Write| DB
    CSV -->|Read files| Obj
    AL <-->|Cache reads / writes| Mem
    MQ -.->|Backed by| Mem
    Auth -->|Dispatch reset email| Email
```
