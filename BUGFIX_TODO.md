# Launch Bug-Fix TODO

Status: confirmed code bugs fixed; deployment risks remain. Updated 2026-07-29.

## P0 — Launch blockers
- [x] Validate/normalize generation counts before pricing; prevent free negative-count jobs and oversized overcharging.
- [x] Make credit reservation + job creation atomic so enqueue failures cannot consume credits.
- [x] Restrict private artifact writes and validate owner/resource namespaces before signing downloads.
- [x] Enforce active account status on user APIs and admin authorization.
- [x] Escape user-controlled print/ebook HTML and block unnecessary Puppeteer network requests.
- [x] Make cancel/retry/complete/fail transitions conditional and refund cancellation exactly once.
- [x] Make retry reservation concurrency-safe and refund completion atomic/crash-safe.
- [x] Prevent bundle setup/generation failures from leaking reserved credits.

## P1 — Data and workflow integrity
- [x] Correct credit ledger deltas when admin removals are clamped.
- [x] Fence job attempts with renewable leases so stale recovery cannot complete duplicate attempts.
- [x] Reject unsafe external OAuth callback redirects.
- [x] Check critical Supabase writes in print/ebook/chapter pipelines.
- [x] Make support/admin mutations fail honestly and audit only successful mutations.
- [x] Reuse bundle opportunity analysis instead of charging/running it twice.
- [x] Recheck cover entitlement and persistence on regeneration.
- [x] Remove the non-functional Resume action for active jobs.

## P2 — Deployment/integration work (not confirmed code bugs)
- [ ] Replace process-local rate limiting before multi-instance deployment.
- [ ] Verify production disables `BILLING_TEST_ACTIVATION`.
- [ ] Deploy a persistent worker and set recovery/lease settings.
- [ ] Require Replicate for sale-quality cover/coloring features or hide them.
- [ ] Implement and test JVZoo/WarriorPlus purchase, claim, refund, and chargeback webhooks.

## Validation gates
- [x] `npm run typecheck`
- [x] `npm run build` — Next.js 16.2.9 production build passed.
- [x] Sudoku, Maze, Opportunity, Coloring suites.
- [x] PDF geometry gate and existing sample-book validation.
- [ ] Apply/test migrations 0019–0021 on a disposable Supabase DB; Supabase CLI is not installed locally.
