# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

PSITS student developers seeking paid project work, and local businesses (e.g. barangay-area shops and SMEs) seeking affordable dev talent for software projects. Three account types: student, enterprise, and admin (PSITS moderator).

## Product Purpose

StartupMatch matches student developers to business-posted projects and tracks the resulting work through to completion, so students gain paid real-world experience and businesses get affordable, accountable dev work without running their own hiring/PM process.

## Positioning

Not a generic job board: it combines (1) resume-to-role AI matching — client-side ML (Sentence-BERT embeddings + structured skill-taxonomy scoring) that scores a student's resume against specific developer roles and job listings, and (2) a built-in phase-by-phase contract/milestone tracker (Sprint Dashboard for students, Milestone Tracking for enterprises) that both sides use after a bid is awarded, rather than leaving project execution to an external tool.

## Operating Context

- Students build a developer profile, upload/have their resume matched against roles, browse the marketplace, and bid on posted projects.
- Enterprises post projects (title, tags, budget range, deadline, phase count), review bids, and award one.
- An awarded bid becomes a contract broken into phases; the student submits phase work, the enterprise approves/disputes it, and payment-to-date accrues per approved phase.
- Admin (PSITS moderator) reviews pending verifications (academic ID / business permit + uploaded documents), approves/rejects accounts, and has full read/manage access across the platform for moderation.
- Backed by Supabase (Postgres + RLS + Auth + Storage); resume files and verification documents are uploaded via Cloudinary/Supabase storage.

## Capabilities and Constraints

- PSITS-affiliated: students verify via academic ID, businesses verify via DTI business permit; both go through an admin verification queue (Pending Review → Verified/Rejected) before full platform access.
- Philippines-local: currency is peso (₱); enterprise addresses use barangay.
- Role is meant to be fixed at signup (student/enterprise) with admin granted only by an existing admin — client-supplied "admin" at signup and client-side self-promotion are known hardening gaps already partially patched at the database layer (see `supabase/migrations/20260908090000_close_admin_privilege_escalation.sql`); treat `role`/`verification_status` as admin-only-writable going forward.
- No automated test suite exists yet; risky logic (auth/role, bid-award, payment accrual) has no regression safety net.

## Evidence on Hand

- `Startup match algorithm/` contains the original Python ML-matching prototype and sample resumes/data this web app's `src/resume/matchEngine.ts` is a client-side (transformers.js) port of. Not part of the shipped app.
- No testimonials, case studies, or pricing claims exist yet — do not fabricate any.

## Product Principles

- Verification before trust: neither side gets full marketplace access until an admin has reviewed their ID/permit.
- Match, then track: matching a student to a project is only half the job — the platform owns the relationship through contract completion, not just the introduction.
- Local-first: built for a specific institution (PSITS) and locale (Philippines/barangay-level), not a generic global marketplace.
- Two-sided accountability: both the student (phase submissions) and the enterprise (phase approval/dispute, payment) have visible, trackable obligations per contract phase.
