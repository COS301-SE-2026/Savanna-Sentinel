# Architecture Diagram Changelog

## Demo 2 - Version 2

Changes made from the initial diagram based on feedback.

---

### Fixed: User actor flow

The User stick figure connects only to the Presentation Layer. The Presentation Layer connects to the Reverse Proxy.

---

### Fixed: Application Layer was a passthrough

The Application Layer contains four grouped service boxes - Auth & Access Control, Field Operations, Analytics & Intelligence, and Data Ingestion, covering all system functionality.

---

### Changed: User shape

User represented as a stick figure actor.

---

### Fixed: Ingestion task payload carried no file reference

The arrow from Data Ingestion Service to the Message Broker is now labeled "enqueue task + file reference".

### Changed: Diagram look

Changed and SImplified the overall look of the diagram to be easier to follow.
