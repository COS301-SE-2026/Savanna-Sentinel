# SIGILL Functional Requirements Document

---

# Table of Contents

1. [User Access and Security Management](#r1-user-access-and-security-management)
2. [Data Ingestion and Validation](#r2-data-ingestion-and-validation)
3. [Geospatial Risk Engine and Visualization](#r3-geospatial-risk-engine-and-visualization)
4. [Risk Engine Explainability](#r4-risk-engine-explainability)
5. [Patrol Route Planning](#r5-patrol-route-planning)
6. [Field Reporting and Offline Sync](#r6-field-reporting-and-offline-sync)
7. [Community Tip-off Submission](#r7-community-tip-off-submission)
8. [Dashboards and System Analytics](#r8-dashboards-and-system-analytics)
9. [Account and Identity Management](#r9-account-and-identity-management)
10. [Data Entry and Validation](#r10-general-application-features)

# Functional Requirements
The Functional Requirements provided below ensure that the Savanna Sentinel system meets users needs. The requirements are organized by feature area and align with the user stories

---
# R1: User Access and Security Management
*Subsystem: Auth Identity System*

## R1.1: Role Based Access Control (RBAC)
- **R.1.1.1:** The system will support role-based access control with predefined roles including Ranger, Analyst, Community Liaison and Admin.
- **R1.1.12:** The system will enforce server-side authentication using stateless sessions (JWT).
- **R1.1.3:** The system will restrict access to specific views, features, and map layers based on the authenticated user’s assigned role.

## R1.2: Audit and Security
- **R1.2.1:** The system will maintain an audit log of all administrator-level actions, recording the actor’s user ID, action performed, target record type and ID, and a timestamp
- **R1.2.2:** The audit log shall be readable only by Admins.
- **R1.2.3:** The audit log shall be immutable, no user, including Admins, shall be able to edit or delete an existing audit log entry.
- **R1.2.4:** The system will ensure all data in transit is encrypted via HTTPS.

---
# R2: Data Ingestion and Validation
*Subsystem: Data Ingestion Subsystem*

## R2.1: File Upload and Parsing
- **R2.1.1:** The system will allow Analysts to upload CSV files containing historical data.
- **R2.1.2:** The system will provide a data upload wizard that displays a preview of the uploaded data prior to commit.
- **R2.1.3:** The data upload wizard will display human-readable validation errors for any row that fails validation, without committing any data until the Analyst confirms the import.
- **R2.1.4:** The system will parse and translate uploaded data into core entities including: Incidents, Patrol Tracks, Sightings, and Tip-offs.

## R2.2: Geospatial Storage
- **R2.2.1:** The system will persist validated geospatial data with spatial indexing to support efficient location-based querying.
---
# R3: Geospatial Risk Engine and Visualization
*Subsystem: Geospatial Risk Engine Subsystem*

## R3.1: Risk Engine Processing
- **R3.1.1:** The AI Risk Engine will process historical data via asynchronous background jobs to compute risk scores, such that the requesting user is not blocked while scores are calculated.
- **R3.1.2:** The Risk Engine will calculate risk hotspots gridded into geographic cells.
- **R3.1.3:** The Risk Engine will compute a distinct risk score per geographic cell for each defined time interval.

## R3.2: Interactive Map
- **R3.2.1:** The system will display a heatmap layer on the map indicating high-risk areas based on the calculated risk scores.
- **R3.2.2:** The system will provide an interactive time range slider allowing users to select a time interval and view its corresponding risk hotspots
- **R3.2.3:** The system will provide interactive map controls including a legend describing the heatmap scale.
- **R3.2.4:** The system will provide interactive data filters allowing users to filter map layers by record type (e.g Incidents, Sightings, Tip-offs)
- **R3.2.5:** The system will enforce role-based access control on all map data API endpoints, such that each role receives only the data it is authorised to access as defined by the RBAC policy.
---
# R4: Risk Engine Explainability
*Subsystem: Risk Explainability Subsystem*

## R4.1: Explainability Metrics
- **R4.1.1:** The Risk Engine will generate explainability metrics using SHAP for each computed risk score.
- **R4.1.2:** The generated explainability metrics will detail the contribution of each input feature to the resulting risk score.

## R4.2: Explainability Panel
- **R4.2.1:** The system will provide an explainability UI panel that communicates the specific reasons a geographic cell is designated as high risk.
- **R4.2.2:** The explainability UI will display a confidence level for each risk score.
- **R4.2.3:** The explainability UI’s confidence level display must not overclaim model certainty (e.g. must not present a score as a guarantee of an event occurring)
---
# R5: Patrol Route Planning
*Subsystem: Patrol Planning Subsystem*

## R5.1: Constraint-Based Route Generation
- **R5.1.1:** The Patrol Planner will accept custom user parameters, including starting point, maximum time allowed and fuel usage constraints.
- **R5.1.2:** The Patrol Planner will consume the current Risk Heatmap and the supplied resource constraints to generate multiple alternative patrol routes per planning request.
- **R5.1.3:** All route alternatives generated from a single planning request will share a common request ID and will be returned together to the requesting user.

## R5.2: Route Retrieval
- **R5.2.1:** The system will allow authenticated Rangers and Analysts to retrieve their previously generated patrol route requests.
- **R5.2.2:** Retrieved route alternatives will be grouped by their shared request ID.

## R5.3: Route Evaluation
- **R5.3.1:** The system will provide a side-by-side route comparison interface allowing rangers to evaluate proposed routes.
- **R5.3.2:** The route comparison interface will display, for each route option, the estimated risk coverage, estimated time and estimated fuel consumption.
---
# R6: Field Reporting and Offline Sync
*Subsystem: Field Reporting Subsystem*

## R6.1: Mobile Offline Capture
- **R6.1.1:** The system will provide a Progressive Web App (PWA) interface for rangers to capture Field Reports.
- **R6.1.2:** The system will allow Rangers to input field report data locally on the device when operating without network connectivity.
- **R6.1.3:** A Ranger may submit multiple field reports during a single patrol.
- **R6.1.4:** Each field report shall be classified as either an incident report or a sighting report.
- **R6.1.5:** An incident report shall capture an incident type and a severity level, in addition to the common fields.
- **R6.1.6:** A sighting report shall capture a species name and an optional animal count, in addition to the common fields.
- **R6.1.7:** Each submitted field report will create a corresponding geospatial event of the matching type (Incident or Sighting).
- **R6.1.8:** Offline field report data shall be persisted to the device using IndexedDB until synchronisation occurs.
- **R6.1.9:** The system will optionally support capturing photo evidence associated with a field report.
- **R6.1.10:** The system will upload captured photo evidence to S3-compatible storage (MinIO) via pre-signed URLs.

## R6.2: Field Report Management
- **R6.2.1:** The system will allow Rangers to edit their own previously submitted field reports, both online and offline.
- **R6.2.2:** For all field reports, the editable common fields are description, location, occurred_at and associated photos.
- **R6.2.3:** For incident reports specifically, incident type and severity shall additionally be editable.
- **R6.2.4:** For sighting reports specifically, species and count shall additionally be editable.
- **R6.2.5:** The system will allow Rangers to delete their own previously submitted field reports.
- **R6.2.6:** Deleted field reports will be soft-deleted and retained in the database for audit purposes.
- **R6.2.7:** The system will allow Admins to edit any field report regardless of the submitting Ranger, with the same field-level permissions defined in R6.2.2–R6.2.4.
- **R6.2.8:** The system will allow Admins to delete any field report regardless of the submitting Ranger.

## R6.3: Synchronisation and Conflict Handling
- **R6.3.1:** The system will allow Admins to delete any field report regardless of the submitting Ranger.
- **R6.3.2:** The Sync Service will detect database conflicts arising from offline data uploads and offline deletions.
- **R6.3.3:** The Sync Service will resolve detected conflicts deterministically, such that no record is silently overwritten.
- **R6.3.4:** Soft-deleted records created offline shall be correctly propagated to the central database upon sync.
---
# R7: Community Tip-off Submission
*Subsystem: Community Tip-off Subsystem*

## R7.1: Tip-off Capture
- **R7.1.1:** The system will allow Community Liaisons to submit tip-offs describing an observed incident or sighting.
- **R7.1.2:** Every tip-off shall capture report type, location, occurred_at and description.
- **R7.1.3:** The system will optionally allow photo evidence to be attached to a tip-off.
- **R7.1.4:** An incident tip-off shall additionally capture an incident type and a severity level.
- **R7.1.5:** A sighting tip-off shall additionally capture a species name and an optional animal count.
- **R7.1.6:** The system will reject a tip-off submission if the occurred_at field is set to a future date or time.
- **R7.1.7:** The system will associate each submitted tip-off with the submitting Community Liaison’s user account.
---

# R8: Dashboards and System Analytics
*Subsystem: Analytics & Dashboard Subsystem*

## R8.1: Operational Dashboards
- **R8.1.1:** The system will display dashboard cards summarising patrol coverage
- **R8.1.2:** The system will display dashboard cards summarising Field Report findings.
- **R8.1.3:** The system will display dashboard cards summarising operational trends over time.
- **R8.1.4:** The system will display basic model performance metrics to Analysts.
- **R8.1.5:** Displayed model performance metrics shall be clearly labelled and must not overclaim model certainty.
---
# R9: Account and Identity Management
*Subsystem: Account & Identity Management Subsystem*

## R9.1: Authentication Flow
- **R9.1.1:** The system will allow only activated user accounts to log in.
- **R9.1.2:** The system will deny login access to accounts pending Admin activation.
- **R9.1.3:** The system will return a deliberately vague error response for any failed login attempt, such that the response does not reveal whether the email address exists, the password is incorrect or the account is inactive.
- **R9.1.4:** The system will allow users to log out, securely invalidating their current active session.
- **R9.1.5:** The system will allow clients to obtain a new access token using a valid, non-revoked refresh token without requiring the user to log in again.
- **R9.1.6:** The system will return a 401 Unauthorised response if a client attempts to use an invalid or revoked refresh token.
- **R9.1.7:** The system will provide a password recovery mechanism whereby a user submits their registered email address and the system sends a time-limited, single-use password reset link to that address.
- **R9.1.8:** Following a valid password reset link will allow the user to set a new password without providing their current one.
- **R9.1.9:** The system will invalidate a password reset token after its first use or after its expiry, whichever occurs first.

## R9.2: User Registration
- **R9.2.1:** The system will allow prospective users to register for an account by providing a username, email address, password, first name and last name.
- **R9.2.2:** At registration, the system will require the prospective user to select their intended role from the available options: Ranger, Analyst, or Community Liaison.
- **R9.2.3:** All newly registered accounts will be created in an inactive state.
- **R9.2.4:** The system will require explicit activation by an Admin before a newly registered user can log in.

## R9.3: User Account Administration
- **R9.3.1:** The system will allow an Admin to view a comprehensive list of all system users and their current statuses, including pending activation requests.
- **R9.3.2:** The system will allow an Admin to activate a user account.
- **R9.3.3:** The system will allow an Admin to deactivate a user account.
- **R9.3.4:** The system will allow an Admin to modify the role of any non-Admin user account.
- **R9.3.5:** The system will prevent any Admin from activating, deactivating, or modifying the role of an account that holds the Admin role.
- **R9.3.6:** The system will allow an Admin to permanently delete a user account that is in an inactive (pending) state.
- **R9.3.7:** The system will prevent the deletion of any user account that is in an active state, an Admin must first deactivate an account before deletion is permitted.
- **R9.3.8:** Upon deletion, the system will permanently remove the user record and all associated tokens (refresh tokens, password reset tokens) from the database, with no soft-delete applied.
- **R9.3.9:** The system will prevent any Admin from deleting an account that holds the Admin role.
- **R9.3.10:** The system will record a user account deletion in the audit log, including actor ID, action, target user ID, and timestamp, before the record is removed.

## R9.4: Profile Management
- **R9.4.1:** The system will allow users to view their own basic profile information.
- **R9.4.2:** The system will allow users to update their own basic profile information.
- **R9.4.3:** The system will allow users to securely update their own password.
- **R9.4.4:** A password change request shall require the user’s current password for verification before the change is accepted.
- **R9.4.5:** On a successful password change, the system will revoke all existing refresh tokens associated with that account.
---
# R10: General Application Features
*Subsystem: Core Application Services Subsystem*

## R10.1: Data Entry and Validation
- **R10.1.1:** The system will enforce client-side form validation on all user inputs.
- **R10.1.2:** The system will enforce server-side form validation on all user inputs, independent of client-side validation, to prevent malformed data
- **R10.1.3:** The system will require user passwords to be a minimum of 8 characters in length.
- **R10.1.4:** The system will display clear, human-readable error messages when form validation fails.

# Changelog
## [Latest] - 2026-06-26
### Added
- Final touches and formatting improvements to the Functional Requirements document.
### Changed
- Enhanced document formatting for improved readability and presentation.
- Standardised requirement structure and layout across all sections, including explicit subsystem assignment per requirement group.
- Improved visual hierarchy and organisation of requirements.
### Improved
- Overall document polish and professional presentation.
- Consistency in requirement numbering and hierarchy.
- Clarity and accessibility of functional requirement specifications.