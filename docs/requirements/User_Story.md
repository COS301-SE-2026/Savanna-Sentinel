# User Stories

---

## 1. Identity & Access Management

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US1.1 | **As a** prospective user, **I want to** register for an account and select my intended role **so that** I can request the appropriate level of access once approved. | * Form includes username, email, password, first name, last name, and a role selector.<br>* Available roles to select are: Ranger, Analyst, Community Liaison.<br>* Password must be at least 8 characters.<br>* Account is created with `is_active: false` and cannot be used to log in until an Admin activates it.<br>* Returns `201 Created` on success. |
| US1.2 | **As an** Admin, **I want to** review and activate or deactivate user accounts **so that** I can control who has access to the system. | * Admin can view a comprehensive list of all system users including those pending activation.<br>* Admin can activate, deactivate, or update the role of any user account (excluding other admins). |
| US1.3 | **As a** registered user, **I want to** log in with my credentials **so that** I receive a secure JWT session. | * System validates email and password.<br>* Issues a signed JWT access token and refresh token on success.<br>* Access token expires after 3600 seconds.<br>* System restricts login to users where `is_active` is true.<br>* Any failed login attempt returns a single vague `401` response that does not reveal whether the email exists, the password is wrong, or the account is inactive. |
| US1.4 | **As an** authenticated user, **I want to** refresh my session **so that** I am not logged out while actively using the system. | * Client can exchange a valid refresh token for a new access token.<br>* Returns `401` if the refresh token is invalid or revoked. |
| US1.5 | **As a** user, **I want to** update my profile and password **so that** my account information remains current and secure. | * User can update first name and last name.<br>* Password change requires `current_password` and `new_password`.<br>* `new_password` must be at least 8 characters.<br>* Password change revokes all existing refresh tokens. |
| US1.6 | **As an** authenticated user, **I want to** log out of the system **so that** my session is securely invalidated. | * The current refresh token is revoked (`revoked_at` is set in the database).<br>* Any subsequent request using the revoked token is rejected with `401 Unauthorised`.<br>* The access token is discarded client-side on logout. |
| US1.7 | **As a** registered user, **I want to** reset my password via email **so that** I can regain access to my account if I forget my credentials. | * User submits their registered email address to initiate a reset.<br>* A time-limited, single-use password reset link is sent to the provided address.<br>* Following the link allows the user to set a new password without knowing the current one.<br>* The reset token is invalidated after use or after expiry. |
| US1.8 | **As an** Admin, **I want to** view an audit log of administrator-level actions **so that** I can monitor system access and detect unauthorised activity. | * Audit log displays each entry's actor, action performed, target record type and ID, and timestamp.<br>* Log entries are read-only and cannot be modified or deleted. |
| US1.9 | **As an** Admin, **I want to** reject and permanently delete a pending user application **so that** unauthorised or unwanted registrations are removed from the system. | * Admin can permanently delete any user account that is in an inactive (pending) state.<br>* Active accounts cannot be deleted; the Admin must first deactivate the account before deletion is permitted.<br>* Deletion permanently removes the user record and all associated tokens (refresh tokens, password reset tokens) - no soft-delete.<br>* Admin accounts cannot be deleted via this action.<br>* The deletion is recorded in the audit log (actor, action, target user ID, timestamp) before the record is removed.<br>* Returns `204 No Content` on success. |

---

## 2. Data Ingestion & Geospatial Management

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US2.1 | **As an** Analyst, **I want to** upload CSV files of historical data **so that** the risk engine has data to process. | * Supports types: `incidents`, `patrol_tracks`, `sightings`, and `tipoffs`.<br>* File is stored and a background processing job is queued.<br>* Validated data is persisted to PostgreSQL with PostGIS spatial indexing. |
| US2.2 | **As an** Analyst, **I want to** use a data upload wizard with previews and validation errors **so that** I can fix data issues before committing. | * Wizard invokes the `/v1/ingestion/validate` endpoint to display a data preview and report errors before the user proceeds to final upload.<br>* Displays friendly, human-readable validation errors per row.<br>* Final upload is only triggered via the upload wizard once the user confirms the data is correct. |

---

## 3. Risk Engine & Visualization

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US3.1 | **As a** Ranger or Analyst, **I want to** view a heatmap of high-risk areas **so that** I can identify poaching hotspots. | * Heatmap layer indicates high-risk areas based on AI Risk Engine scores.<br>* Provides an interactive time range slider to observe changes across intervals.<br>* Heatmap updates within 1 second of a new slider position.<br>* Includes interactive map controls, legends, and data filters. |
| US3.2 | **As a** Ranger or Analyst, **I want to** see the reasoning behind a risk score **so that** I can understand why an area is marked high-risk. | * Explainability panel communicates the specific feature contributions for a selected cell.<br>* Clearly presents confidence levels without overclaiming model certainty. |
| US3.3 | **As a** Ranger or Analyst, **I want** the map to display only data my role is authorised to access **so that** I am not exposed to data outside my permissions. | * All map data is served via authenticated API endpoints with server-side RBAC enforcement.<br>* Access restrictions are applied per endpoint regardless of client state.<br>* No unauthorised data is returned in any API response. |

---

## 4. Field Operations & Offline PWA

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US4.1 | **As a** Ranger, **I want to** submit field reports offline via the PWA **so that** I can capture data in areas without connectivity. | * PWA interface supports offline data capture for incidents and sightings.<br>* All reports capture: report type (incident or sighting), location (lat/lon), `occurred_at`, and description.<br>* Incident reports additionally capture incident type and severity level (low / medium / high).<br>* Sighting reports additionally capture species name and an optional animal count.<br>* Each submitted field report creates a corresponding geospatial event of the matching type.<br>* Reports are stored locally in IndexedDB when offline.<br>* Reports sync automatically to the server within 60 seconds of connectivity being restored.<br>* Supports optional photo uploads to MinIO via pre-signed URL. |
| US4.2 | **As a** Ranger, **I want to** edit and delete my field reports **so that** I can correct mistakes and manage my submissions. | * Ranger can edit the common fields of their own reports: description, location, `occurred_at`, and photos.<br>* For incident reports, the ranger can additionally edit incident type and severity level.<br>* For sighting reports, the ranger can additionally edit species name and animal count.<br>* Edits made offline are stored locally and synced on reconnection.<br>* Ranger can delete their own reports; deleted reports are soft-deleted and no longer visible in the UI.<br>* A Ranger cannot edit or delete another Ranger's reports.<br>* Changes are reflected in the UI immediately after submission. |
| US4.3 | **As a** Ranger, **I want to** generate optimal patrol routes based on risk and resource constraints **so that** I can patrol safely and efficiently. | * Planner accepts starting point, maximum patrol time, and fuel constraint as inputs.<br>* System consumes the Risk Heatmap to propose routes prioritising high-risk coverage.<br>* System generates multiple alternative routes per planning request, grouped by a shared request ID.<br>* Provides a side-by-side route comparison interface showing risk coverage, estimated time, and estimated fuel consumption for each alternative.<br>* Route suggestions are returned within 5 seconds. |
| US4.4 | **As a** Ranger or Analyst, **I want to** view my previously generated patrol routes **so that** I can review past plans without regenerating them. | * Authenticated Rangers and Analysts can retrieve a list of their own previously generated patrol route requests, grouped by request ID.<br>* Each route record displays its start point, resource constraints, suggested path, risk coverage, estimated time, and estimated fuel consumption. |
| US4.5 | **As a** Ranger, **I want** my offline field reports to sync without silent data loss **so that** I can trust that what I captured in the field is accurately reflected in the system. | * When connectivity is restored, all locally queued reports are automatically submitted to the server.<br>* If a report was edited both offline and on the server, the conflict is resolved deterministically - no record is silently overwritten.<br>* Soft-deleted records made offline are correctly propagated; they do not reappear after sync.<br>* The Ranger is not required to take any manual action to trigger or resolve a sync. |
| US4.6 | **As an** Admin, **I want to** edit or delete any field report **so that** I can correct data quality issues and manage submissions across all rangers. | * Admin can edit the common fields (description, location, `occurred_at`, photos) of any field report regardless of who submitted it.<br>* For incident reports, the Admin can additionally edit incident type and severity level.<br>* For sighting reports, the Admin can additionally edit species name and animal count.<br>* Admin can soft-delete any field report; deleted reports are retained for audit purposes but are no longer visible in the UI. |

---

## 5. Community Tip-off

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US5.1 | **As a** Community Liaison, **I want to** submit a tip-off about a suspected incident or sighting **so that** rangers can be informed of potential threats. | * Form captures report type (incident or sighting), location, `occurred_at`, description, and optional photos.<br>* Incident tip-offs additionally capture incident type and severity level.<br>* Sighting tip-offs additionally capture species name and optional animal count.<br>* `occurred_at` must not be in the future.<br>* Submission is associated with the authenticated Community Liaison account.<br>* Returns `201 Created` on success. |

---

## 6. Dashboards & Analytics

| ID | User Story | Acceptance Criteria |
| :--- | :--- | :--- |
| US6.1 | **As an** Analyst or Admin, **I want to** view operational dashboard cards **so that** I can monitor patrol coverage, field report trends, and system activity at a glance. | * Dashboard displays cards for patrol coverage, field report counts, and recent trends.<br>* Data is up to date with the latest synced records. |
| US6.2 | **As an** Analyst, **I want to** view basic model performance metrics **so that** I can assess the reliability of the AI Risk Engine. | * Dashboard displays model performance metrics such as accuracy indicators.<br>* Metrics are clearly labelled and do not overclaim model certainty. |