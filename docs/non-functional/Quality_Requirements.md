# Quality Requirements

---

## 1. Performance

1.1 The interactive risk heatmap shall render within 2 seconds for a grid of up to 10 000 cells on a standard desktop browser.

1.2 Patrol route suggestions shall be returned to the user within 5 seconds for a reserve area of up to 500 km² under default resource constraints.

1.3 CSV ingestion of historical data files containing up to 100 000 rows shall complete within 30 seconds without blocking the user interface.

1.4 Standard authenticated API endpoints shall respond within 500 ms at the 95th percentile under normal concurrent load.

1.5 The time range slider shall update the displayed heatmap within 1 second of each new slider position.

---

## 2. Reliability

2.1 The system shall not lose any field report data captured during offline operation, zero records shall be dropped during an offline to online synchronisation cycle.

2.2 The AI Risk Engine shall produce consistent and reproducible risk scores when given the same historical input dataset.

2.3 The data ingestion pipeline shall reject malformed CSV rows without corrupting or discarding valid rows in the same upload, and shall report each invalid row to the user with a human-readable error message.

2.4 The Sync Service shall resolve database conflicts arising from concurrent offline uploads and offline deletions deterministically, such that no records are silently overwritten and soft-deleted records are correctly propagated on sync.

---

## 3. Availability

3.1 The Progressive Web App shall remain fully functional for field data capture including incident and sighting entry, with zero network connectivity.

3.2 Data captured offline shall synchronise automatically with the central database within 60 seconds of network connectivity being restored, without requiring any user action.

3.3 The production deployment shall maintain 99% uptime over any 30 day window, as measured by UptimeRobot and NodePing.

---

## 4. Scalability

4.1 The database shall support historical datasets of at least 10 million incident, sighting, and patrol track records without degradation in spatial query response times.

4.2 The system shall sustain at least 50 concurrent authenticated user sessions without a measurable increase in API response time compared to a single user baseline.

4.3 Additional background processing workers shall be addable without modifying application code, using only deployment level configuration changes.

---

## 5. Security

5.1 All data transmitted between the client and server shall be encrypted using TLS. No endpoint shall be accessible over unencrypted HTTP.

5.2 Role based access control shall be enforced server side on every API request, such that a user authenticated as Ranger cannot access Analyst only or Admin only resources regardless of client side state.

5.3 Role based access control shall be enforced server side on all API endpoints, such that each role receives only the data it is authorised to access. Access restrictions are defined per endpoint in the API Service Contract and are enforced regardless of client side state.

5.4 User passwords shall be stored using a salted hashing algorithm with a minimum bcrypt cost factor of 12. No plaintext or reversibly encrypted passwords shall exist in the database.

5.5 The system shall maintain an audit log of all administrator level actions, recording the actor's user ID, the action performed, and a timestamp.

5.6 The login endpoint shall return an identical error response for all failure cases, including incorrect username, incorrect password, and inactive account, such that no information about account existence or status is revealed to the requester.

5.7 Only the login, registration, password recovery, password reset, and token refresh endpoints shall be publicly accessible without authentication. All other API endpoints shall require a valid JWT token.

---

## 6. Maintainability

6.1 All backend modules shall maintain a minimum of 70% unit test line coverage, as measured by Coveralls on every push to the main branch.

6.2 The CI pipeline shall block merges to the main branch if any automated test, SonarCloud quality gate, or build step fails.

6.3 All REST API endpoints shall be described in the auto generated OpenAPI specification, including request parameters, response schemas, and authentication requirements.

---

## 7. Usability

7.1 All validation error messages shown to the user shall be written in plain, human readable language. No raw exception text or HTTP status codes shall be displayed.

7.2 The explainability panel shall present AI risk confidence levels with clear uncertainty language, such that users do not interpret the output as a definitive or certain prediction.

7.3 The patrol route comparison interface shall display all route alternatives simultaneously on a single screen, with a summary of risk coverage, estimated time, and estimated fuel consumption for each route.

---

## 8. Accessibility

8.1 All text and interactive element colour combinations in the user interface shall achieve a contrast ratio of at least 4.5:1, conforming to WCAG Level AA. This is enforced through the project's Tailwind CSS configuration and verified against the Brand Style colour palette.

8.2 All interactive map controls, navigation menus, and form elements shall be fully operable using only a keyboard. shadcn/Radix UI components provide keyboard navigation by default and this behaviour must not be disabled.

8.3 Dynamic content regions in the web dashboard shall use semantic HTML elements and ARIA roles such that they are correctly announced by modern screen readers. Radix UI primitives underlying shadcn components provide correct ARIA attributes by default and must be supplemented with explicit labels on custom components.