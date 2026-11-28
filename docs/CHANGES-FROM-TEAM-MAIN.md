# Changes since team `main` (9e05909)

Everything in branch `support-tickets-marketplace-polish` compared with
`Tamagoki-Code/StartupMatch` `main` at commit `9e05909` ("Sprint auto-advance,
contract activity log, mobile Messages, admin inbox", 2026-11-24).

19 files changed. No existing feature was removed except the admin **Messages**
page, which is replaced by **Support Tickets** (see below).

---

## Before you merge: run the SQL once

Run `Startup-Match_TEAM_backend_migrations.sql` in our Supabase project
(**SQL Editor → New query → paste → Run**). It applies all-or-nothing and only
adds things; the current live site keeps working while it runs.

It contains two migrations, also committed in `supabase/migrations/`:

| Migration | What it does |
|---|---|
| `20260908210000_restore_signup_documents_after_hardening.sql` | Fixes signup. The admin-hardening migration (`20260908090000`) rewrote `handle_new_user()` from an older version and stopped saving the **academic ID**, the **ID / permit photo** and the **establishment photo**. This restores all three and keeps the admin lockout (no self-assigned admin, everyone starts as Pending Review). |
| `20260908260000_support_tickets_and_avatars.sql` | Adds `support_tickets` and `support_ticket_messages` (with row-level security: owner or admin only), a trigger that sends the ticket notifications, and `profiles.avatar_url` for profile photos and business logos (only Cloudinary image URLs are accepted). |

If you merge without running it, the marketplace page will not load (it reads
`avatar_url`) and Help / Support Tickets will show errors.

---

## What changed, by role

### Students
- **Marketplace listings:** business logo (or a building icon), bolder business
  name, a location link that opens Google Maps for the barangay, **Timeline**
  (posted date – deadline) and **Duration** ("29 days", "1 month 3 days")
  instead of a bare deadline, and a **Message Owner** button that opens the
  conversation in Messages.
- **Active Project card on every page:** the student sidebar is now one shared
  component (the two near-identical sidebars were merged). The card links to the
  Sprint Board, or says "No active project yet" with a link to the Marketplace.
- **Bids:** status colours fixed ("Awarded" is green, it was amber like
  "Pending"). On phones each bid is a card so amount and status stay visible.
- **Sprint Board / Overview:** countdowns never show negative days
  ("62d overdue", "Due today", "No deadline set"); the deadline chip is red only
  when actually overdue; "Reset demo data" is hidden from real accounts.
- **Resume Check:** a two-mode switch and a drag-and-drop upload area with a
  progress bar while the AI model downloads.

### Businesses
- **Settings → Business Logo:** upload / change / remove; shown on their
  listings and in Messages.
- **Milestone cards:** full status-colour border instead of a thick bar on one side.

### Moderators (admin)
- **Support Tickets** page replaces the admin Messages page: queue with
  Needs Attention / Resolved / All, read and reply, set status
  (Open / In Progress / Resolved).
- **Verification Queue:** shows the **ID number** (academic ID or permit / DTI
  no.), the school or business and barangay, and **thumbnails** of the uploaded
  ID / permit and storefront photos (click to open full size). Search also
  matches ID numbers and business names.

### Everyone
- **Help button** (?) next to the bell for students and businesses: send a
  support request to the PSITS moderators and follow the replies.
- **Messages:** New Message lists only contacts from bids (a student sees
  businesses they bid on, a business sees students who bid on its projects),
  not the whole user list. Conversation names now show on phones.
- **Profile photos:** default avatars are a person or building icon instead of
  initials. Anyone can upload a photo in Settings (up to 20 MB). Clicking your
  own profile picture opens a viewer with Upload / Change / Remove.
- **Notifications:** unread items get a blue dot; each can be marked read or
  unread; long text is cut to two lines with Show more.
- **Logo:** new tab icon (`public/favicon.svg`, two overlapping circles) used in
  the browser tab, sign-in page and sidebars.
- **Sign-in page:** clearer error states (no "Security event logged" for simple
  typos), upload feedback, password hint, loading spinner.

---

## UI refresh (whole app)

- One **top bar** on every student page: page title, Help, notifications, the
  signed-in user (opens the profile) and Log out.
- **Sidebar** selected item is a soft blue pill instead of a bar down one edge.
- **Status pills** use five consistent tones (success / warning / danger / info /
  neutral); unknown statuses are neutral instead of amber.
- **Empty states:** loading shows shimmer lines, errors are red and announced to
  screen readers, empty sections get a fitting icon and readable text.
- **Icons:** activity feeds use drawn icons instead of emoji.
- **Foundation (`src/index.css`):** Inter weight 800 loaded (headings were being
  faked bold), on-brand keyboard focus ring, text selection colour, slim
  scrollbars, aligned table numbers, a short fade between pages, and
  reduced-motion support.
- **Phones:** notification panel spans the screen (was cut off), message thread
  fills the screen with the reply box at the bottom, Sprint Board header wraps
  cleanly, upload says "Tap to choose a PDF".

---

## Files

| Area | Files |
|---|---|
| New | `src/SupportTickets.tsx`, `src/support.ts`, `src/avatar.ts`, `src/timeline.ts`, `src/timeline.test.ts`, `public/favicon.svg`, two migrations |
| Changed | `src/App.tsx`, `src/AuthPage.tsx`, `src/index.css`, `src/admin.ts`, `src/messages.ts`, `src/marketplace.ts`, `src/notifications.ts`, `src/devProfile.ts`, `src/cloudinary.ts` (optional upload folder), `src/resume/ResumeCheckPage.tsx`, `.figma/make/site.json` (tab icon) |

Checks: TypeScript clean, 17 tests pass (6 new for timeline/duration), build passes.

---

## How to test after merging

1. Student: Marketplace shows logo/icon, map link, timeline and duration;
   **Message Owner** opens a conversation.
2. Student or business: **?** → Contact Support → send. Moderator: Support
   Tickets shows it; reply and set In Progress. The sender gets a notification.
3. Register a **new** student with an academic ID and ID photo. Moderator:
   Verification Queue shows the ID number and photo thumbnail.
4. Settings → upload a profile photo / business logo; it appears in the top bar,
   sidebar and Messages.
5. Open the app on a phone: Bids, Messages and the notification panel fit the screen.

---

## Known limits

- **Old accounts:** people who signed up while the signup bug was live have no
  ID number or documents on file; there is no re-upload step yet.
- **Contacts-only messaging** is enforced in the app screens only;
  `get_or_create_conversation` still accepts any profile ID.
- **Photo size:** the app allows 20 MB, but Cloudinary's free plan may reject
  images over 10 MB.
- **Still open from the security review:** students can write to their own
  `contracts` / `bids` / `contract_phases` rows beyond what they should
  (e.g. self-award, edit paid amount), and any signed-in user can insert a
  notification for anyone. These need a separate RLS migration.
- Notifications don't link to the related page yet.
- The UI refresh was checked visually on student screens (desktop and phone);
  business and moderator screens only received the shared changes.
