# Changelog

### V2.1 (2026-07-25)

* Added 2FA extension use case
* Fixed heading on dashboard subsystem
* Added Admin subsystem

### V2 (Demo 1 -> V2)

- Refactored entire diagram to match feedback
- Introduced use case scope
- Separated use cases into more distinct subsystems
- Partitioned actors into roles to make the diagram cleaner
- Removed the following use cases
  - Refresh Session - No Actor is involved with this use case, it is an automated action that the user is unaware of.
  - View Role Filtered Map Data - Was merged into View Map Data
  - Edit Any Report / Delete Any Report - Merged into Edit and Delete Own Report
- Updated the following use cases
  - Reset Password via Email -> Reset Password - Simpler name that does not restrict the method as much, details can be added in other documentation.
  - Activate / Deactive User -> Split into 2 use cases - These have different outcomes internally
  - Split US2 into various use cases to make them more granular, and added scope to help detail the process, as requested from feedback
- Minor improvements
