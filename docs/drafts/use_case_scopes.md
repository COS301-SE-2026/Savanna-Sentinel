# SIGILL USE CASE DOCUMENT
---
## Acrnoyms Used
- TUCBW - This Use Case Begins With
- TUCEW - This Use Case Ends With
---
## Use Cases

### Subsystem 1: Authentication
**NOTE:** This subsystem is included for completeness, even if they do not count towards the total use case count

#### Image
![Authoritzation Subsystem Dark Mode](sav_sent_use_cases_auth_light.png)

#### Use Case Scope
| Use Case Number | Starts With/Ends With |
| --------------- | --------------------- |
| UC1.1 Login Account | TUCBW the user being shown the login screen upon enterring the website.<br /> TUCEW the user being shown a confirmation message and being redirected to the dashboard. |
| UC1.2 Register Account | TUCBW the user clicking the "Register Account" button on the login screen. <br /> TUCEW the user being shown a confirmation message and being told to initiate UC1.1. |
| UC 1.3 Logout Account | TUCBW the user clicking the Logout button on the navigation burger menu. <br /> TUCEW the user being shown the login screen. |
| UC 1.4 Update Account Details | TUCBW the user enterring the submission details and clicking the submit button <br /> TUCEW the user being informed their details have been updated. **ALT:** TUCEW the user being redirected to the login screen, only if their password has changed. |
| UC 1.5 Reset password | TUCBW the user clicking the reset password button on the login screen <br /> TUCEW the user enterring their new password on the magic link and being redirected to login |
| UC 1.6 Activate User | TUCBW the admin clicking the activate button next to the corresponding pending user <br /> TUCEW the admin being shown a confirmation message, and the user being sent a welcome email. |
| UC 1.7 Deactivate User | TUCBW the admin clicking the deactivate button next to the corresponding active user <br /> TUCEW the admin being shown a confirmation message, and the user being sent a deactivation email. Important to note the account is not removed from the DB, just access to the service is revoked. |
| UC 1.8 Delete Pending User | TUCBW the admin clicking the reject button next to the corresponding pending user. <br /> TUCEW with the admin being shown a confirmation message, and the user being sent a rejection email. |

---
## Changelog
### V1 (From Demo 1)
- Refactored entire diagram to match feedback
- Introduced use case Scope
- Seperated use cases into more distinct subsystems
- Partioned actors into roles to make the diagram cleaner
- Removed the following use cases
  - Refresh Session - No Actor is involved with this use case, it as automated action that the user is unaware of.
- Updated the following use cases
  - Reset Password via Email -> Reset Password - Simpler name that does not restrict the method as much, details can be added in other documentation.
  - Activate / Deactive User -> Split into 2 use cases - These have different outcomes internally
- Minor improvements