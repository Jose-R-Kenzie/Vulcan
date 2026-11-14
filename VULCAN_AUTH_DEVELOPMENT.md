# Vulcan · authentication and shift access (development branch)

**Status:** Development-only implementation of sign-in, access approvals, shift schedules, optional profile, blank dashboard, and first operational record screens. **Not deployed.** Main branch, live Firebase database rules, and the GitHub Pages site remain unchanged.

## What the branch adds

- New `vulcan.html` entry point, `vulcan-app.js` logic, and `vulcan.css` styling. The existing `index.html` and operational pages remain intact.
- Email/password or Google sign-in. Under Settings, users can **link** their other sign-in provider to the *same Firebase UID* to avoid duplicate memberships.
- One-time email verification for email/password sign-in; Google normally arrives verified. First-time request with chosen home shift, visible requester name, and requested role.
- Waiting screen; real-time Firebase listeners notice approved membership when database rules permit.
- Optional personal profile (name/pronunciation/about/status/accent color). Individual dashboards start **empty**; users pin/remove placeholder widgets.
- Active shift selected from the assigned home shift, current schedule, or 24-hour approved coverage. Wednesday overlap and clock-in/clock-out buffer windows are considered.
- Approver view for authorized **home-shift** clerks, managers, and the bootstrapped administrator; administrators can switch their active shift to review any team.
- Lives, Drops, and Transships now have searchable, shift-scoped editable tables and record forms, with **15 / 36 / 58** original Excel field labels and available dropdown choices. There are no imported real records. Read-only roles can view; authorized clerks/managers can create, update, archive, and restore. Optimistic version checks prevent silent overwrites when two clerks edit the same record.
- Derived reports, Dwells, FIFO, CUTs, Yard, and messages remain **informational placeholders**: no fake reports or live calculations.

## Important: Firebase access is currently locked

Realtime Database was deliberately locked with global `.read: false` and `.write: false`.
**Do not replace those live rules yet.** `database.rules.proposed.json` is a **local security proposal**, not a deployed policy. The expanded draft passed **56 Firebase emulator permission tests** with no failures on the development branch. Sign-in may authenticate but requesting access will correctly fail with permission denied until the rules are explicitly approved for deployment.

The old public chat remains blocked. Existing chat messages, spreadsheets, and Google Drive have not been touched.

## Required before a usable protected pilot

1. Confirm the facility time zone; the development code temporarily uses `America/Los_Angeles`.
2. Add the intended test host (for GitHub Pages, `jose-r-kenzie.github.io`) to Firebase Authentication → Settings → Authorized domains. Verify both sign-in methods from that host.
3. Verify GitHub Actions **Firebase Realtime Database Emulator** tests are green. The test suite checks public access, self-approval, permission ceilings, cross-shift isolation, 24-hour expiration, write types, archive/restore, and the locked legacy messages path. This is isolated test data and does not change production Firebase.
4. Bootstrap Jose's administrator **by a trusted console/Admin SDK operation**, not through website code: after Jose first creates an Auth user, use that authenticated user's exact Firebase UID and set `admins/UID = true`. Separately seed that user's approved `memberships/UID` once (same UID, `role: "admin"`, `homeShift`, `active: true`, `approvedBy`, `approvedAt`). The browser is intentionally unable to grant itself Admin rights. **Do not perform this bootstrap until Jose confirms the exact UID and requests it.**
5. Only after security tests and explicit owner approval, publish rules and expose a test build. Leave production work records out of the experiment until organizational approval.
6. Add decline/revoke/deactivation workflows, a durable audit trail, resubmission, messaging notifications, browser-level integration tests and rate controls before real workers are onboarded.
7. Port Excel report calculations, Dwells and FIFO with independently checked totals and row-level ordering. The 21-sheet workbook has not been imported. Old `.html` pages are currently public via direct URL and must be blocked/retired before real work data is stored.
8. Review whether backend rules must enforce schedule windows as well as shift membership. Currently shift windows are enforced by the **UI**, while backend pillar rules enforce permanent home-shift membership or a valid 24-hour grant. A determined client could call the backend outside a home shift's scheduled hours unless additional trusted schedule enforcement is added.
9. Confirm the `America/Los_Angeles` timezone and Excel date-time semantics; dates typed in web forms currently use the browser's local timezone. Some non-standard existing workbook input values may require normalization during an eventual import.

## Role policy currently drafted

| Role | In the pilot |
| --- | --- |
| Admin | Backend-bootstrapped identity; can approve any home-shift role and shift coverage |
| Manager | Can approve non-admin roles for home shift |
| PA Clerk | Can approve non-admin roles for home shift |
| Tier 1 Clerk | Can approve roles up to and including PA Clerk on home shift |
| PA, Tier 1, Senior Operations Manager | No approval permissions |

This scope captures Jose's requested custom hierarchy. More detailed permission matrices for each operational table and report still need implementation.

## Schedules configured in development

- Front Half Days: Sunday–Wednesday, **04:30–17:30**.
- Front Half Nights: Sunday–Wednesday, **16:30–05:00 next morning**.
- Back Half Days: Wednesday–Saturday, **04:30–17:30**.
- Back Half Nights: Wednesday–Saturday, **16:30–05:00 next morning**.
- Each temporary shift approval is at most 24 hours from grant creation, then must be renewed.

The schedule **allows Wednesday overlap** and the 04:30–05:00 / 16:30–17:30 shift handoffs, rather than silently choosing a single shift.

## What is tested

- JavaScript syntax parses and the site has all initial sign-in / shift views.
- Eight schedule cases passed, including Wednesday overlap and overnight handoff.
- Pillar schema validation tests check the three original field counts, types, and editor/viewer role distinctions.
- Isolated GitHub Actions Firebase database emulator tests passed **56/56** checks, including all approval and operational data access cases. A static HTML/JavaScript contract test also verifies that interactive elements exist.
- `scripts/build-proposed-rules.mjs` regenerates the isolated `database.rules.proposed.json` field allowlists from `vulcan-pillars.js`; it never deploys.

**Not yet verified:** Real browser sign-in, profile updates, OAuth linking/provider collisions, email verification, real-time approval end-to-end, mobile accessibility, reports, and operational CRUD against a safe Firebase staging instance. None of this should be represented as deployed or ready for actual operations.

The actual GitHub Pages root `index.html` is intentionally unchanged for this phase. To review the prototype on GitHub, open `vulcan.html` in this development branch; the existing live Pages URL does not yet serve branch-only files.
