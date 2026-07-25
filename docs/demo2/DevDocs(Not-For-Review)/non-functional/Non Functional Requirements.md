# SIGILL Non-Functional Requirements document

---

# Core Non-Functional Requirements

The core non-functional requirements of the system are detailed as follows

- **Security:** All sensitive user data should be encrypted using AES-256 encryption, and the system should enforce multi-factor authentication for administrative accounts.
- **Reliability:** The system should achieve 99.9% uptime and recover from critical failures within 5 minutes.
- **Performance:** The system should respond to user requests within 2 seconds for 95% of requests under normal operating conditions and support at least 60 concurrent users.
- **Availability:** The system should be available 24/7, excluding scheduled maintenance periods not exceeding 2 hours per month.
- **Maintainability:** New features or bug fixes should be deployable within 2 hours, and the codebase should maintain at least 80% automated test coverage
