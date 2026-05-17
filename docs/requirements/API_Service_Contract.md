# Savanna Sentinel – API Service Contracts

**Version:** 1.0
**Base Path:** `/v1`
**Auth:** All endpoints require a valid JWT Bearer token in the `Authorization` header unless marked as *Public*.
**Format:** `application/json` for all request and response bodies unless noted.

> **Photo Upload Flow:** Before submitting a field report or tip-off, the client requests a pre-signed MinIO URL from the backend, uploads the file directly to MinIO, and then includes the resulting object URL in the `images` array of the report submission. This avoids routing large files through the FastAPI backend.

---

## SC-01: Register User

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/register` |
| **Access** | Public |

**Preconditions**
- The provided email address and username must not already exist in the system.
- `password` must be at least 8 characters long.
- `requested_role` must be one of: `community_liaison`, `ranger`, `analyst`.

**Request Body**

| Field | Type | Required |
|---|---|---|
| username | string | Yes |
| email | string | Yes |
| password | string | Yes |
| first_name | string | Yes |
| last_name | string | Yes |
| requested_role | string | Yes |

**Postconditions**
- A new user account is created with the `requested_role` as the user's role and `is_active: false`.
- The account cannot be used to log in until an Admin activates it.

**Response `201 Created`**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "role": "string",
  "is_active": false,
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing or invalid fields |
| 409 | Email or username already in use |

---

## SC-02: Login

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/login` |
| **Access** | Public |

> **Security note:** To prevent user enumeration, the server must not distinguish between an incorrect username, an incorrect password, or an inactive account in the error response. All failure cases return the same `401` response with a generic message.

**Preconditions**
- The request body must contain a non-empty username and password.

**Request Body**

| Field | Type | Required |
|---|---|---|
| username | string | Yes |
| password | string | Yes |

**Postconditions**
- A signed JWT access token and refresh token are issued to the client.
- The access token expires after 3600 seconds.

**Response `200 OK`**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Credentials are invalid or the account cannot be accessed |

---

## SC-03: Logout

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/logout` |
| **Access** | All authenticated roles |

**Preconditions**
- The request must include a valid JWT access token in the `Authorization` header.
- The request body must contain the refresh token to be revoked.

**Request Body**

| Field | Type | Required |
|---|---|---|
| refresh_token | string | Yes |

**Postconditions**
- The provided refresh token is revoked (`revoked_at` is set in the database) and can no longer be used to issue new access tokens.
- The session is considered terminated; the access token should be discarded client-side.

**Response `204 No Content`**

**Error Responses**

| Status | Condition |
|---|---|
| 400 | `refresh_token` field missing |
| 401 | Access token missing or invalid |

---

## SC-04: Refresh Access Token

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/refresh` |
| **Access** | Public |

**Preconditions**
- The request body must contain a valid, non-revoked refresh token.

**Request Body**

| Field | Type | Required |
|---|---|---|
| refresh_token | string | Yes |

**Postconditions**
- A new signed JWT access token and refresh token are issued (token rotation).
- The previous refresh token is invalidated.
- The new access token expires after 3600 seconds.

**Response `200 OK`**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Refresh token is missing, invalid, or revoked |

---

## SC-05: Get Own Profile

| | |
|---|---|
| **Endpoint** | `GET /v1/users/me` |
| **Access** | All authenticated roles |

**Preconditions**
- The request must include a valid JWT access token.

**Postconditions**
- None. Read-only operation.

**Response `200 OK`**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "role": "string",
  "is_active": "boolean",
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |

---

## SC-06: Update Own Profile

| | |
|---|---|
| **Endpoint** | `PATCH /v1/users/me` |
| **Access** | All authenticated roles |

**Preconditions**
- At least one updatable field must be present in the request body.
- If `new_password` is provided, `current_password` must also be provided and must be correct.

**Request Body** (all fields optional)

| Field | Type | Description |
|---|---|---|
| first_name | string | Updated first name |
| last_name | string | Updated last name |
| current_password | string | Required only when changing password |
| new_password | string | Must be at least 8 characters |

**Postconditions**
- The authenticated user's profile is updated with the provided values.
- If password is changed, all existing refresh tokens for the user are revoked.

**Response `200 OK`** - Returns the updated user profile object (same shape as SC-05).

**Error Responses**

| Status | Condition |
|---|---|
| 400 | No updatable fields provided |
| 401 | Token missing or invalid |
| 403 | `current_password` is incorrect |

---

## SC-07: Validate CSV Data
| | |
|---|---|
| **Endpoint** | `POST /v1/ingestion/validate` |
| **Access** | `analyst`, `admin` |
| **Content-Type** | `multipart/form-data` |

**Preconditions**
- `data_type` must be one of: `incidents`, `patrol_tracks`, `sightings`, `tipoffs`.
- The uploaded file must be a valid CSV.

**Postconditions**
- The controller parses the file and performs validation without persisting any data to the database.

**Response `200 OK`**
```json
{
  "valid_rows": "integer",
  "total_rows": "integer",
  "errors": [
    { "row": "integer", "field": "string", "message": "string" }
  ]
}
```

---

## SC-08: Upload CSV Data
| | |
|---|---|
| **Endpoint** | `POST /v1/ingestion/upload` |
| **Access** | `analyst`, `admin` |
| **Content-Type** | `multipart/form-data` |

**Preconditions**
- The file has been pre-validated via SC-07 to minimize ingestion failures.
- `data_type` must be one of: `incidents`, `patrol_tracks`, `sightings`, `tipoffs`.

**Postconditions**
- The file is stored in MinIO and a background processing job is queued. Valid rows are persisted to the PostGIS database.

**Response `202 Accepted`**
```json
{
  "upload_id": "string",
  "status": "queued",
  "queued_at": "ISO 8601"
}
```

## SC-09: Get Upload Status

| | |
|---|---|
| **Endpoint** | `GET /v1/ingestion/uploads/{upload_id}` |
| **Access** | `analyst`, `admin` |

**Preconditions**
- `upload_id` must refer to an upload record that exists in the system.

**Postconditions**
- None. Read-only operation.

**Response `200 OK`**
```json
{
  "upload_id": "string",
  "data_type": "string",
  "status": "queued | processing | completed | failed",
  "rows_imported": "integer",
  "rows_failed": "integer",
  "errors": [
    {
      "row": "integer",
      "field": "string",
      "message": "string"
    }
  ],
  "completed_at": "ISO 8601 | null"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 403 | Role not permitted |
| 404 | Upload ID does not exist |

---

## SC-10: Request Pre-Signed Upload URL

| | |
|---|---|
| **Endpoint** | `POST /v1/media/upload-url` |
| **Access** | `ranger`, `community_liaison`, `admin` |

**Preconditions**
- `file_name` must be a non-empty string.
- `content_type` must be a valid image MIME type (e.g. `image/jpeg`, `image/png`).

**Request Body**

| Field | Type | Required |
|---|---|---|
| file_name | string | Yes |
| content_type | string | Yes |

**Postconditions**
- A pre-signed MinIO URL is generated allowing the client to upload directly to object storage.
- The URL expires after 300 seconds.

**Response `200 OK`**
```json
{
  "upload_url": "string",
  "object_url": "string",
  "expires_in": 300
}
```

> The client uploads the file directly to `upload_url` via HTTP `PUT`. On success, `object_url` is the permanent reference to include in the `images` array of a subsequent report or tip-off submission.

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing or invalid fields |
| 403 | Role not permitted |

---

## SC-11: Submit Field Report

| | |
|---|---|
| **Endpoint** | `POST /v1/reports` |
| **Access** | `ranger`, `admin` |

**Preconditions**
- `report_type` must be one of: `incident`, `sighting`.
- `location` must contain a valid latitude and longitude pair.
- `occurred_at` must not be a future date and time.
- Each entry in `images` must be a valid MinIO object URL previously obtained via SC-10.
- If `report_type` is `incident`, `incident_type` must be provided.
- If `report_type` is `sighting`, `species` must be provided.

**Request Body**

| Field | Type | Required |
|---|---|---|
| report_type | string | Yes |
| location | `{ lat: float, lon: float }` | Yes |
| occurred_at | ISO 8601 | Yes |
| description | string | Yes |
| incident_type | string | Required when `report_type` is `incident` |
| severity | `low \| medium \| high` | Optional when `report_type` is `incident` |
| species | string | Required when `report_type` is `sighting` |
| count | integer | Optional when `report_type` is `sighting` |
| images | array of object URLs | No |
| route_id | string | No |
| sync_status | `offline \| pending \| synced` | No |

**Postconditions**
- The report is persisted and associated with the authenticated user.
- A corresponding geospatial event is created and linked: an `incidents` record if `report_type` is `incident`; a `sightings` record if `report_type` is `sighting`.
- If `route_id` is provided and refers to an existing route, the report is linked to that route.

**Response `201 Created`**
```json
{
  "report_id": "string",
  "report_type": "string",
  "status": "submitted",
  "submitted_by": "string",
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing required fields |
| 403 | Role not permitted to submit reports |
| 422 | `occurred_at` is in the future, or coordinates are invalid |

---

## SC-12: Edit Field Report

| | |
|---|---|
| **Endpoint** | `PATCH /v1/reports/{report_id}` |
| **Access** | `ranger`, `admin` |

**Preconditions**
- `report_id` must refer to an existing report.
- A Ranger may only edit their own reports. An Admin may edit any report.
- At least one updatable field must be present.
- `occurred_at`, if provided, must not be a future date and time.

**Request Body** (all fields optional)

| Field | Type | Description |
|---|---|---|
| description | string | Updated description |
| location | `{ lat: float, lon: float }` | Updated location |
| occurred_at | ISO 8601 | Updated event time |
| images | array of object URLs | Replaces existing image list |
| incident_type | string | Updated incident type (incident reports only) |
| severity | `low \| medium \| high` | Updated severity (incident reports only) |
| species | string | Updated species name (sighting reports only) |
| count | integer | Updated animal count (sighting reports only) |

**Postconditions**
- The report is updated with the provided values.
- `sync_status` is set to `synced`.

**Response `200 OK`** - Returns the updated report object (same shape as SC-11 response).

**Error Responses**

| Status | Condition |
|---|---|
| 400 | No updatable fields provided |
| 401 | Token missing or invalid |
| 403 | Ranger attempting to edit another user's report |
| 404 | Report ID does not exist |
| 422 | `occurred_at` is in the future, or coordinates are invalid |

---

## SC-13: Delete Field Report

| | |
|---|---|
| **Endpoint** | `DELETE /v1/reports/{report_id}` |
| **Access** | `ranger`, `admin` |

**Preconditions**
- `report_id` must refer to an existing report.
- A Ranger may only delete their own reports. An Admin may delete any report.

**Postconditions**
- The report record is soft-deleted: marked as deleted and excluded from all queries, but retained in the database for audit purposes.

**Response `204 No Content`**

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Ranger attempting to delete another user's report |
| 404 | Report ID does not exist |

---

## SC-14: Submit Community Tip-off

| | |
|---|---|
| **Endpoint** | `POST /v1/tipoffs` |
| **Access** | `community_liaison`, `admin` |

**Preconditions**
- `report_type` must be one of: `incident`, `sighting`.
- `location` must contain a valid latitude and longitude pair.
- `occurred_at` must not be a future date and time.
- Each entry in `images` must be a valid MinIO object URL previously obtained via SC-10.
- If `report_type` is `incident`, `incident_type` must be provided.
- If `report_type` is `sighting`, `species` must be provided.

**Request Body**

| Field | Type | Required |
|---|---|---|
| report_type | string | Yes |
| location | `{ lat: float, lon: float }` | Yes |
| occurred_at | ISO 8601 | Yes |
| description | string | Yes |
| incident_type | string | Required when `report_type` is `incident` |
| severity | `low \| medium \| high` | Optional when `report_type` is `incident` |
| species | string | Required when `report_type` is `sighting` |
| count | integer | Optional when `report_type` is `sighting` |
| images | array of object URLs | No |

**Postconditions**
- The tip-off is persisted and associated with the authenticated Community Liaison account.
- A corresponding geospatial event is created and linked: an `incidents` record if `report_type` is `incident`; a `sightings` record if `report_type` is `sighting`.

**Response `201 Created`**
```json
{
  "tipoff_id": "string",
  "report_type": "string",
  "status": "submitted",
  "submitted_by": "string",
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing required fields |
| 403 | Role not permitted |
| 422 | `occurred_at` is in the future, or coordinates are invalid |

---

## SC-15: Change User Role

| | |
|---|---|
| **Endpoint** | `PATCH /v1/users/{user_id}/role` |
| **Access** | `admin` |

> **Security note:** Admin accounts cannot be created or promoted to via this endpoint. The `admin` role is reserved and may only be assigned directly at the database level by a system operator. This prevents privilege escalation through the API.

**Preconditions**
- `user_id` must refer to an existing user in the system.
- The target user must not hold the `admin` role; Admin accounts cannot be modified via the API.
- `new_role` must be one of: `community_liaison`, `ranger`, `analyst`. The value `admin` is not accepted.
- The authenticated user must have `admin` role.

**Request Body**

| Field | Type | Required |
|---|---|---|
| new_role | string | Yes |

**Postconditions**
- The specified user's role is updated to the provided value.
- If the user has active sessions, the role change takes effect on the next token refresh.

**Response `200 OK`**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "role": "string",
  "is_active": "boolean",
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Invalid role provided, or `new_role` is `admin` |
| 401 | Token missing or invalid |
| 403 | Only admin users can change roles, or target user holds the `admin` role |
| 404 | User ID does not exist |

---

## SC-16: Set User Active Status

| | |
|---|---|
| **Endpoint** | `PATCH /v1/users/{user_id}/status` |
| **Access** | `admin` |

**Preconditions**
- `user_id` must refer to an existing user in the system.
- The target user must not hold the `admin` role; Admin accounts cannot be activated or deactivated via the API.
- `is_active` must be a boolean value.
- The authenticated user must have `admin` role.
- An Admin cannot deactivate their own account.

**Request Body**

| Field | Type | Required |
|---|---|---|
| is_active | boolean | Yes |

**Postconditions**
- The specified user's `is_active` status is updated to the provided value.
- If the account is deactivated, all active refresh tokens for that user are immediately revoked.
- A deactivated user's next login attempt will fail with a generic `401` response (per SC-02 security note).

**Response `200 OK`**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "role": "string",
  "is_active": "boolean",
  "created_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | `is_active` field missing or not a boolean |
| 401 | Token missing or invalid |
| 403 | Only admin users can change account status, Admin attempting to modify their own account, or target user holds the `admin` role |
| 404 | User ID does not exist |

---

## SC-17: Request Password Reset

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/forgot-password` |
| **Access** | Public |

> **Security note:** To prevent user enumeration, this endpoint always returns `200 OK` regardless of whether the provided email address exists in the system. No information about account existence is revealed.

**Preconditions**
- `email` must be a non-empty string.

**Request Body**

| Field | Type | Required |
|---|---|---|
| email | string | Yes |

**Postconditions**
- If an active account with the provided email exists, a time-limited password reset token is generated and a reset link is sent to that email address.
- The reset token expires after 900 seconds (15 minutes).
- No action is taken if the email does not match any account, but the response is identical.

**Response `200 OK`**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | `email` field is missing or empty |

---

## SC-18: Confirm Password Reset

| | |
|---|---|
| **Endpoint** | `POST /v1/auth/reset-password` |
| **Access** | Public |

**Preconditions**
- `token` must be a valid, non-expired password reset token previously issued via SC-17.
- `new_password` must be at least 8 characters long.

**Request Body**

| Field | Type | Required |
|---|---|---|
| token | string | Yes |
| new_password | string | Yes |

**Postconditions**
- The user's password is updated to `new_password`.
- The reset token is invalidated and cannot be reused.
- All existing refresh tokens for the user are revoked.

**Response `200 OK`**
```json
{
  "message": "Password has been reset successfully."
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing fields, `new_password` is fewer than 8 characters, or token is invalid or expired |

---

## SC-19: List All Users

| | |
|---|---|
| **Endpoint** | `GET /v1/users` |
| **Access** | `admin` |

**Preconditions**
- The authenticated user must have `admin` role.

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| is_active | boolean | Filter by active or inactive accounts |
| role | string | Filter by role: `ranger`, `analyst`, `community_liaison`, `admin` |
| page | integer | Page number for pagination (default: 1) |
| page_size | integer | Results per page (default: 20, max: 100) |

**Postconditions**
- None. Read-only operation.

**Response `200 OK`**
```json
{
  "total": "integer",
  "page": "integer",
  "page_size": "integer",
  "results": [
    {
      "id": "string",
      "username": "string",
      "email": "string",
      "first_name": "string",
      "last_name": "string",
      "role": "string",
      "is_active": "boolean",
      "created_at": "ISO 8601"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Requesting user is not an Admin |

---

## SC-20: List Field Reports

| | |
|---|---|
| **Endpoint** | `GET /v1/reports` |
| **Access** | `ranger`, `admin` |

> **RBAC note:** A Ranger receives only their own reports. An Admin receives all reports.
> Scoping is enforced server-side; no client parameter can override it.

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| report_type | string | Filter by type: `incident`, `sighting` |
| severity | string | Filter by severity: `low`, `medium`, `high` |
| from | ISO 8601 | Filter reports with `occurred_at` on or after this datetime |
| to | ISO 8601 | Filter reports with `occurred_at` on or before this datetime |
| sync_status | string | Filter by sync state: `offline`, `pending`, `synced` |
| page | integer | Page number for pagination (default: 1) |
| page_size | integer | Results per page (default: 20, max: 100) |

**Postconditions**
- None. Read-only operation.

**Response `200 OK`**
```json
{
  "total": "integer",
  "page": "integer",
  "page_size": "integer",
  "results": [
    {
      "report_id": "string",
      "report_type": "incident | sighting",
      "location": { "lat": "float", "lon": "float" },
      "occurred_at": "ISO 8601",
      "description": "string",
      "incident_type": "string | null",
      "severity": "low | medium | high | null",
      "species": "string | null",
      "count": "integer | null",
      "images": ["string"],
      "route_id": "string | null",
      "sync_status": "offline | pending | synced",
      "submitted_by": "string",
      "created_at": "ISO 8601",
      "updated_at": "ISO 8601",
      "deleted_at": "ISO 8601 | null"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Role not permitted |

---

## SC-21: Get Single Field Report

| | |
|---|---|
| **Endpoint** | `GET /v1/reports/{report_id}` |
| **Access** | `ranger`, `admin` |

> **RBAC note:** A Ranger may only retrieve their own reports. An Admin may retrieve any report.

**Preconditions**
- `report_id` must refer to an existing, non-deleted report.

**Postconditions**
- None. Read-only operation.

**Response `200 OK`** - Returns a single report object (same shape as each item in the SC-20
results array).

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Ranger attempting to retrieve another user's report |
| 404 | Report ID does not exist or has been soft-deleted |

---

## Standard Error Envelope

All error responses return the following structure:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": [
      { "field": "string", "message": "string" }
    ]
  }
}
```

`details` is omitted when not applicable (e.g. 401, 404 responses).

---

## SC-22: Get Risk Heatmap

| | |
|---|---|
| **Endpoint** | `GET /v1/risk/heatmap` |
| **Access** | `ranger`, `analyst`, `admin` |

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| time_interval | string | Filter by interval label (e.g. `2024-Q1`). Defaults to latest computed interval. |
| bbox | string | Bounding box filter `minLon,minLat,maxLon,maxLat` |

**Postconditions**
- None. Read-only operation.

**Response `200 OK`**
```json
{
  "heatmap_id": "string",
  "time_interval": "string",
  "computed_at": "ISO 8601",
  "grid_resolution": "string",
  "cells": [
    {
      "cell_id": "string",
      "polygon_bounds": "GeoJSON Polygon",
      "risk_score": "float",
      "explainability": [
        { "key_reason": "string", "confidence_level": "float" }
      ]
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Role not permitted |
| 404 | No heatmap has been computed yet |

---

## SC-23: Generate Patrol Route

| | |
|---|---|
| **Endpoint** | `POST /v1/routes` |
| **Access** | `ranger`, `analyst`, `admin` |

**Preconditions**
- `start_point` must be a valid latitude/longitude pair.
- `max_time` must be a positive number (minutes).
- `max_fuel` must be a positive number (litres).
- A computed heatmap must exist to generate routes against.

**Request Body**

| Field | Type | Required |
|---|---|---|
| start_point | `{ lat: float, lon: float }` | Yes |
| max_time | float | Yes |
| max_fuel | float | Yes |

**Postconditions**
- A background route planning job is queued.
- On completion, multiple alternative `PatrolRoute` records are persisted, all sharing a common `request_id` and associated with the requesting user.

> **Polling:** The client should poll `GET /v1/routes?request_id={request_id}` until results appear. Route generation is expected to complete within 5 seconds under normal conditions.

**Response `202 Accepted`**
```json
{
  "job_id": "string",
  "request_id": "string",
  "status": "queued",
  "queued_at": "ISO 8601"
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | Missing or invalid fields |
| 401 | Token missing or invalid |
| 403 | Role not permitted |
| 422 | No heatmap available to plan against |

---

## SC-24: List Patrol Routes

| | |
|---|---|
| **Endpoint** | `GET /v1/routes` |
| **Access** | `ranger`, `analyst`, `admin` |

> **RBAC note:** A Ranger receives only their own generated routes. Analysts and Admins receive all routes.
> Routes sharing the same `request_id` are alternatives generated from a single planning request and can be compared side by side.

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| request_id | string | Filter by a specific planning request to retrieve its alternatives |
| page | integer | Page number (default: 1) |
| page_size | integer | Results per page (default: 20, max: 100) |

**Response `200 OK`**
```json
{
  "total": "integer",
  "page": "integer",
  "page_size": "integer",
  "results": [
    {
      "route_id": "string",
      "request_id": "string",
      "start_point": { "lat": "float", "lon": "float" },
      "max_time": "float",
      "max_fuel": "float",
      "suggested_path": "GeoJSON LineString",
      "estimated_time": "float",
      "estimated_fuel": "float",
      "risk_coverage": "float",
      "created_at": "ISO 8601"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Role not permitted |

---

## SC-25: Get Single Patrol Route

| | |
|---|---|
| **Endpoint** | `GET /v1/routes/{route_id}` |
| **Access** | `ranger`, `analyst`, `admin` |

> **RBAC note:** A Ranger may only retrieve their own routes.

**Preconditions**
- `route_id` must refer to an existing route.

**Response `200 OK`** - Returns a single route object (same shape as each item in the SC-24 results array).

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Ranger attempting to retrieve another user's route |
| 404 | Route ID does not exist |

---

## SC-26: Get Dashboard Metrics

| | |
|---|---|
| **Endpoint** | `GET /v1/dashboard` |
| **Access** | `analyst`, `admin` |

**Postconditions**
- None. Read-only aggregation.

**Response `200 OK`**
```json
{
  "patrol_coverage": {
    "total_area_km2": "float",
    "covered_area_km2": "float",
    "coverage_percent": "float"
  },
  "field_reports": {
    "total": "integer",
    "last_30_days": "integer",
    "by_type": { "incident": "integer", "sighting": "integer" }
  },
  "model_performance": {
    "last_trained_at": "ISO 8601",
    "accuracy": "float | null",
    "note": "string"
  }
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Role not permitted |

---

## SC-27: List Tip-offs

| | |
|---|---|
| **Endpoint** | `GET /v1/tipoffs` |
| **Access** | `community_liaison`, `analyst`, `admin` |

> **RBAC note:** A Community Liaison receives only their own tip-offs. Analysts and Admins receive all tip-offs.

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| report_type | string | Filter by `incident` or `sighting` |
| from | ISO 8601 | Filter by `occurred_at` on or after |
| to | ISO 8601 | Filter by `occurred_at` on or before |
| page | integer | Page number (default: 1) |
| page_size | integer | Results per page (default: 20, max: 100) |

**Response `200 OK`**
```json
{
  "total": "integer",
  "page": "integer",
  "page_size": "integer",
  "results": [
    {
      "tipoff_id": "string",
      "report_type": "incident | sighting",
      "location": { "lat": "float", "lon": "float" },
      "occurred_at": "ISO 8601",
      "description": "string",
      "incident_type": "string | null",
      "severity": "low | medium | high | null",
      "species": "string | null",
      "count": "integer | null",
      "images": ["string"],
      "submitted_by": "string",
      "created_at": "ISO 8601"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Role not permitted |

---

## SC-28: Batch Sync Offline Reports

| | |
|---|---|
| **Endpoint** | `POST /v1/reports/sync` |
| **Access** | `ranger`, `admin` |

> Used by the PWA when connectivity is restored. Submits a batch of locally-queued field reports in a single request. The Sync Service processes each record, resolving conflicts deterministically (last-write-wins by `occurred_at`; soft-deleted records propagate correctly).

**Request Body**

| Field | Type | Required |
|---|---|---|
| reports | array of report objects | Yes |

Each report object follows the same shape as the SC-11 request body, with an additional `local_id` field (the client's IndexedDB key) used to correlate sync results.

**Postconditions**
- Each valid report in the batch is persisted (inserted or conflict-resolved).
- Soft-deleted records (where `deleted_at` is set locally) are propagated as soft-deletes server-side.
- The response maps each `local_id` to its server-assigned `report_id` and outcome.

**Response `207 Multi-Status`**
```json
{
  "results": [
    {
      "local_id": "string",
      "report_id": "string",
      "status": "created | updated | deleted | conflict | error",
      "message": "string | null"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 400 | `reports` field missing or not an array |
| 401 | Token missing or invalid |
| 403 | Role not permitted |

---

## SC-29: List Audit Logs

| | |
|---|---|
| **Endpoint** | `GET /v1/audit-logs` |
| **Access** | `admin` |

**Preconditions**
- The authenticated user must have `admin` role.

**Query Parameters** (all optional)

| Parameter | Type | Description |
|---|---|---|
| actor_id | string | Filter by the ID of the user who performed the action |
| action | string | Filter by action name (e.g. `user.activate`, `report.delete`) |
| target_type | string | Filter by target record type (e.g. `user`, `field_report`) |
| from | ISO 8601 | Filter entries with `created_at` on or after this datetime |
| to | ISO 8601 | Filter entries with `created_at` on or before this datetime |
| page | integer | Page number (default: 1) |
| page_size | integer | Results per page (default: 20, max: 100) |

**Postconditions**
- None. Read-only operation. Audit log entries cannot be modified or deleted.

**Response `200 OK`**
```json
{
  "total": "integer",
  "page": "integer",
  "page_size": "integer",
  "results": [
    {
      "id": "string",
      "actor_id": "string",
      "action": "string",
      "target_type": "string | null",
      "target_id": "string | null",
      "details": "object | null",
      "created_at": "ISO 8601"
    }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Requesting user is not an Admin |

---

## SC-30: Delete User

| | |
|---|---|
| **Endpoint** | `DELETE /v1/users/{user_id}` |
| **Access** | `admin` |

> **Irreversible action:** This endpoint permanently removes the user record and all associated tokens. There is no soft-delete. It is intended for rejecting pending registrations; use SC-16 to deactivate an existing active user.

**Preconditions**
- `user_id` must refer to an existing user in the system.
- The target user must be inactive (`is_active: false`). Active accounts cannot be deleted; the Admin must first deactivate the account via SC-16 before deletion is permitted.
- The target user must not hold the `admin` role; Admin accounts cannot be deleted via the API.
- The authenticated user must have `admin` role.

**Postconditions**
- The deletion is recorded in the audit log (actor ID, action `user.delete`, target user ID, timestamp) before the record is removed.
- The user record and all associated refresh tokens and password reset tokens are permanently removed from the database.

**Response `204 No Content`**

**Error Responses**

| Status | Condition |
|---|---|
| 401 | Token missing or invalid |
| 403 | Requesting user is not an Admin, target user holds the `admin` role, or target account is active |
| 404 | User ID does not exist |

---

`details` is omitted when not applicable (e.g. 401, 404 responses).