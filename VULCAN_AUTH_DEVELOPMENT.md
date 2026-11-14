# Vulcan · authentication and shift access (development branch)

**Status:** First implementation of the sign-in, home-shift requests, temporary-coverage requests, approvals, optional profile, and blank personal dashboard. **Not deployed.** Main branch and the live GitHub Pages website are unchanged.

## What the branch adds

- New `vulcan.html` entry point, `vulcan-app.js` logic, and `vulcan.css` styling. The existing `index.html` and operational pages remain intact.
- Email/password or Google sign-in. Under Settings, users can **link** their other sign-in provider to the *same Firebase UID* to avoid duplicate memberships.
- One-time email verification for email/password sign-in; Google normally arrives verified. First-time request with chosen home shift, visible requester name, and requested role.
- Waiting screen; real-time Firebase listeners notice approved membership when database rules permit.
- Optional personal profile (name/pronunciation/about/status/accent color). Individual dashboards start **empty**; users pin/remove placeholder widgets.
- Active shift selected from the assigned home shift, current schedule, or 24-hour approved coverage. Wednesday overlap and clock-in/clock-out buffer windows are considered.
- Approver view for authorized **home-shift** clerks, managers, and the bootstrapped administrator; administrators can switch their active shift to review any team.
- Default operational pages are **informational placeholders**: no fake reports, no live CRUD or work data yet.

## Important: Firebase access is currently locked

Realtime Database was deliberately locked with global `.read: false` and `.write: false`.
**Do not replace those live rules yet.** `database.rules.proposed.json` is an **UNTESTED SECURITY DRAFT**, not a deployed policy. Sign-in may authenticate but requesting access will correctly fail with permission denied until rules are tested and explicitly approved for deployment.

The old public chat remains blocked. Existing chat messages, spreadsheets, and Google Drive have not been touched.

## Required before a usable protected pilot

1. Confirm the facility time zone; the development code temporarily uses `America/Los_Angeles`.
2. Add the intended test host (for GitHub Pages, `jose-r-kenzie.github.io`) to Firebase Authentication → Settings → Authorized domains. Verify both sign-in methods from that host.
3. Test `database.rules.proposed.json` against a **Firebase Realtime Database Emulator**. At minimum, test: public access denied; unapproved users cannot read any membership except their own; users cannot approve themselves; users cannot change roles; cross-shift approvals denied; tier-1 clerk cannot approve Manager/Admin; Admin bootstrap; temporary grants expire; existing data remains private.
4. Bootstrap Jose's administrator **by a trusted console/Admin SDK operation**, not through website code: after Jose first creates an Auth user, use that authenticated user's exact Firebase UID and set `admins/UID = true`. Separately seed that user's approved `memberships/UID` once (same UID, `role: "admin"`, `homeShift`, `active: true`, `approvedBy`, `approvedAt`). The browser is intentionally unable to grant itself Admin rights. **Do not perform this bootstrap until Jose confirms the exact UID and requests it.**
5. Only after security tests and explicit owner approval, publish rules and expose a test build. Leave production work records out of the experiment until organizational approval.
6. Add decline/revoke/deactivation workflows, audit trail, refresh request and resubmission support, messaging notifications, and backend validations before real workers are onboarded.
7. Connect Lives, Drops, Transships, report calculations, and read-only other tabs to authorized, shift-partitioned data. Old `.html` pages are currently public via direct URL and must be blocked/retired before real work data is stored.

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

## What was verified without a running executor

- Source JavaScript syntax parsed.
- Proposed rules file parses as JSON and denies root-level reads and writes.
- All ten application screens exist.
- Six schedule examples passed, including Wednesday overlap and overnight handoff.

**Not yet verified:** Firebase emulator security checks (including unverified accounts, profile abuse, and widget payload limits), OAuth redirect and authorized domain behavior, production browser UI, accessibility, real-time approval end-to-end, email/Google linking across provider collisions, report values, operational CRUD. No deployed behavior should be implied.

The actual GitHub Pages root `index.html` is intentionally unchanged for this phase. To review the prototype on GitHub, open `vulcan.html` in this development branch; the existing live Pages URL does not yet serve branch-only files.
