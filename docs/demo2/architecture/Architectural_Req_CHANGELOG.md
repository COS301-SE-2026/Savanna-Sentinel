# Changelog - Architectural Requirements

## [Latest] - 2026-06-27 (2)

### Changed
- Added constraints items (Open-Source, Deployment, PWA, Data Sensitivity, Budget) into the Architectural Constraints section, rewriting each as a restriction on the solution space rather than the tool/technology chosen to satisfy it (e.g "offline capability is required because rangers operate without guaranteed connectivity" rather than "must be a PWA")
- Retained the specific technology choices (Docker/Compose/GitHub Actions, PWA, HTTPS+RBAC) as parenthetical notes on the relevant constraint, rather than as the constraint itself
- Folded the R5000 budget cap into Organisational Constraints rather than keeping it as a standalone category
- constraints is now superseded by this document's Architectural Constraints section as the single source of truth

## [2026-06-27]

### Changed
- Removed Microservices-style pattern: incorrectly applied, as services are not independently deployable/runnable containers, reframed the five service areas as internal module boundaries within the Layered pattern
- Renamed Event-Driven/Async Processing pattern to Asynchronous Task Processing pattern: system offloads tasks to a worker pool but has no event-driven state model that changes request-handling behaviour
- Rewrote all Technical, Organisational and Legal/Data constraints to describe actual restrictions on the solution space, rather than the specific technology choices (FastAPI, PostgreSQL, React/TypeScript) made within that space
- Removed Adapter Design Pattern entry: pattern not confirmed in the actual implementation, replaced with a placeholder pending investigation


## [2026-06-26]

### Added
- Created new Architectural Requirements document for Demo 2
- Documented architectural patterns: Layered (N-Tier), Microservices-style, and Event-Driven/Async Processing patterns
- Defined technical constraints for backend (FastAPI/Python), frontend (React/TypeScript/Vite), and authentication (JWT)
- Documented organizational constraints around team ownership and feature area boundaries
- Added legal/data constraints for object storage and audit log immutability
- Included Design Patterns section with Adapter Pattern implementation details