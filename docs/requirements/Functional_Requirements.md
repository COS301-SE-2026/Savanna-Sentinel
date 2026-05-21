# Functional Requirements

- R1: User Access and Security Management
  - R1.1: Role-Based Access Control (RBAC)
    - R1.1.1: The system will support role based access control with predefined roles including Ranger, Analyst, Community Liaison, and Admin.
    - R1.1.2: The system will enforce server side authentication using stateless sessions (JWT).
    - R1.1.3: The system will restrict access to specific views, features, and map layers based on the authenticated user's assigned role.
  - R1.2: Audit and Security
    - R1.2.1: The system will maintain an audit log of all administrator-level actions, recording the actor's user ID, action performed, target record type and ID, and a timestamp. The audit log shall be readable by Admins and shall be immutable.
    - R1.2.2: The system will ensure data in transit is encrypted via HTTPS.

- R2: Data Ingestion and Validation
  - R2.1: File Upload and Parsing
    - R2.1.1: The system will allow Analysts to upload CSV files containing historical data.
    - R2.1.2: The system will provide a data upload wizard that displays data previews and friendly validation errors before committing data.
    - R2.1.3: The system will parse and translate uploaded data into core entities: Incidents, Patrol Tracks, Sightings, and Tip-offs.
  - R2.2: Geospatial Storage
    - R2.2.1: The system will persist validated data into a PostgreSQL database utilising PostGIS spatial indexing for efficient querying.

- R3: Geospatial Risk Engine and Visualization
  - R3.1: Risk Scoring Processing
    - R3.1.1: The AI Risk Engine will process historical data via asynchronous background jobs to compute risk scores.
    - R3.1.2: The system will calculate risk hotspots gridded by distinct time intervals.
  - R3.2: Interactive Map
    - R3.2.1: The system will display a heatmap layer indicating high risk areas based on the calculated risk scores.
    - R3.2.2: The system will provide an interactive time range slider allowing users to observe how risk hotspots change across time intervals.
    - R3.2.3: The system will provide interactive map controls including legends and data filters.
    - R3.2.4: The system will enforce role based access control on all map data API endpoints, such that each role receives only the data it is authorised to access as defined by the RBAC policy.

- R4: Risk Engine Explainability
  - R4.1: Explainability Metrics
    - R4.1.1: The Risk Engine will generate explainability metrics using SHAP, detailing the contribution of each feature to the reasoning and confidence behind generated risk scores.
  - R4.2: Explainability Panel
    - R4.2.1: The system will provide an explainability UI panel that communicates the specific reasons a geographic cell is designated as high risk.
    - R4.2.2: The explainability UI will clearly present confidence levels without overclaiming model certainty.

- R5: Patrol Route Planning
  - R5.1: Constraint-Based Route Generation
    - R5.1.1: The Patrol Planner will accept custom user parameters, including starting points, maximum time allowed, and fuel usage constraints.
    - R5.1.2: The Patrol Planner will consume the generated Risk Heatmap and resource constraints to generate multiple alternative patrol routes per planning request. All alternatives share a common request ID and are returned together so the ranger can compare them.
  - R5.2: Route Retrieval
    - R5.2.1: The system will allow authenticated Rangers and Analysts to retrieve their previously generated patrol route requests, with alternatives grouped by their shared request ID.
  - R5.3: Route Evaluation
    - R5.3.1: The system will provide a side by side route comparison interface allowing rangers to evaluate proposed routes, displaying risk coverage, estimated time, and estimated fuel consumption for each option.

- R6: Field Reporting and Offline Sync
  - R6.1: Mobile Offline Capture
    - R6.1.1: The system will provide a Progressive Web App (PWA) interface for rangers to capture Field Reports.
    - R6.1.2: The system will allow Rangers to input data locally on the device when operating without network connectivity. A Ranger may submit multiple field reports during a single patrol. Each field report is classified as either an incident or a sighting - an incident report captures incident type and severity level; a sighting report captures species name and optional animal count. Each submitted report creates a corresponding geospatial event of the matching type. Offline data shall be persisted to the device using IndexedDB.
    - R6.1.3: The system will optionally support capturing and uploading photo evidence associated with field reports to S3 compatible storage (MinIO) via pre-signed URLs.
  - R6.2: Field Report Management
    - R6.2.1: The system will allow Rangers to edit their own previously submitted field reports, both online and offline. Editable common fields are description, location, occurred_at, and associated photos. For incident reports, incident type and severity are additionally editable. For sighting reports, species and count are additionally editable.
    - R6.2.2: The system will allow Rangers to delete their own previously submitted field reports. Deleted records will be soft-deleted and retained for audit purposes.
    - R6.2.3: The system will allow Admins to edit or delete any field report regardless of the submitting Ranger. Admins may edit the same fields as the submitting Ranger, including type-specific fields (incident type and severity for incident reports; species and count for sighting reports).
  - R6.3: Synchronization and Conflict Handling
    - R6.3.1: The system will automatically trigger data synchronisation with the central database once network connection is restored.
    - R6.3.2: The Sync Service will detect and resolve database conflicts arising from offline data uploads and offline deletions deterministically, such that no records are silently overwritten, and soft-deleted records are correctly propagated to the central database on sync.

- R7: Community Tip-off Submission
  - R7.1: Tip-off Capture
    - R7.1.1: The system will allow Community Liaisons to submit tip-offs describing observed incidents or sightings. All tip-offs capture report type, location, occurred_at, description, and optional photo evidence. Incident tip-offs additionally capture incident type and severity level. Sighting tip-offs additionally capture species name and optional animal count. The occurred_at field must not be set to a future date or time.
    - R7.1.2: The system will associate each tip-off with the submitting Community Liaison user account.

- R8: Dashboards and System Analytics
  - R8.1: Operational Dashboards
    - R8.1.1: The system will display dashboard cards summarising key operational metrics, including patrol coverage, Field Report findings, and trends.
    - R8.1.2: The system will display basic model performance metrics to Analysts. Metrics shall be clearly labelled and must not overclaim model certainty.

- R9: Account and Identity Management
  - R9.1: Authentication Flow
    - R9.1.1: The system will allow only activated user accounts to log in. Accounts pending admin activation will be denied access.
    - R9.1.2: The system will return a deliberately vague error response for any failed login attempt, such that the response does not reveal whether the email address exists, the password is incorrect, or the account is inactive.
    - R9.1.3: The system will allow users to log out, securely invalidating their current active session.
    - R9.1.4: The system will allow clients to obtain a new access token using a valid, non-revoked refresh token, without requiring the user to log in again. An invalid or revoked refresh token shall return a 401 Unauthorised response.
    - R9.1.5: The system will provide a password recovery mechanism for users who have lost or forgotten their credentials. A user submits their registered email address; the system sends a time-limited, single-use password reset link to that address. Following the link allows the user to set a new password without knowing their current one. The reset token is invalidated after first use or after expiry.
  - R9.2: User Registration
    - R9.2.1: The system will allow prospective users to register for an account by providing a username, email address, password, first name, and last name, and by selecting their intended role from the available options: Ranger, Analyst, or Community Liaison.
    - R9.2.2: All newly registered accounts will be created in an inactive state and will require explicit activation by an Admin before the user can log in.
  - R9.3: User Account Administration
    - R9.3.1: The system will allow an Admin to view a comprehensive list of all system users and their current statuses, including pending activation requests.
    - R9.3.2: The system will allow an Admin to activate or deactivate user accounts.
    - R9.3.3: The system will allow an Admin to modify the role of any non-Admin user account.
    - R9.3.4: The system will prevent Admins from activating, deactivating, or modifying the role of any account that holds the Admin role.
    - R9.3.5: The system will allow an Admin to permanently delete a user account that is in an inactive (pending) state, representing a rejected application. Active user accounts shall not be deletable; an Admin must first deactivate an account before deletion is permitted.
    - R9.3.6: On deletion, the system will permanently remove the user record and all associated tokens (refresh tokens, password reset tokens) from the database. No soft-delete is applied; the record is irrecoverably removed.
    - R9.3.7: The system will prevent Admins from deleting any account that holds the Admin role.
    - R9.3.8: User account deletion will be recorded in the audit log (actor ID, action, target user ID, timestamp) before the record is removed.
  - R9.4: Profile Management
    - R9.4.1: The system will allow users to view and update their own basic profile information.
    - R9.4.2: The system will allow users to securely update their own passwords. A password change shall require the user's current password for verification and, on success, shall revoke all existing refresh tokens associated with that account.

- R10: General Application Features
  - R10.1: Data Entry and Validation
    - R10.1.1: The system will enforce comprehensive client side and server side form validation on all user inputs to prevent malformed data. User passwords must be a minimum of 8 characters in length.
    - R10.1.2: The system will display clear, human readable error messages when form validation fails.