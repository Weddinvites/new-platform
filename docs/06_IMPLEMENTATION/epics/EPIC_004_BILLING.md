# EPIC 004 — Billing & Subscription

**Status:** Planned — contract audit in progress; no Story is approved for implementation yet.
**Module:** `billing`
**Priority:** High — "Validate License" / plan-based feature availability (MASTER_SPEC §16.3) gates capabilities consumed by other modules (White Label, Custom Domain, API, AI Assistant); the payment-gateway integration itself is explicitly non-blocking for MVP (MASTER_SPEC §39.1).
**Phase:** MVP

---

# 1. Objective

Implement the Billing bounded context: subscription, plan, billing-cycle, invoice, and license-validation management for Organizations, independent of actual payment processing (API_SPEC.md §30 "Provider Independence": "Payment gateways and billing providers are infrastructure concerns. The Billing module depends on business contracts rather than provider-specific implementations.").

**Canonical naming.** This Epic and its module are named **Billing**, matching ADR-011, Architecture.md, API_SPEC.md, and IMPLEMENTATION_ROADMAP.md. MASTER_SPEC names the equivalent bounded context "Subscriptions" (§27.4 "Subscriptions Context", §28.4 "Subscription Module") — this is stale naming in MASTER_SPEC, not corrected at the source by this Epic (see §9 Known Documentation Inconsistencies); every other authoritative document agrees on "Billing," and this Epic adopts that name.

The Subscription entity "belongs to an Organization" (MASTER_SPEC §26.13: "La Subscription pertenece a una Organization") — Billing is therefore Organization-scoped, the same tenant boundary EPIC-003 established, but is its own bounded context/module (ADR-011: `Subscription → Billing`), not a capability of Organizations.

**Two commercial products, not one.** MASTER_SPEC §39.1 contemplates both "pago por suscripción" and "pago por evento" — confirmed during this Epic's Story-level audit to mean two genuinely different products: (1) **Agency Subscriptions** — a PARTNER Organization (Agency) pays recurring fees for one of the four plans in MASTER_SPEC §16.3, which is what this Epic (and `Subscription`, §26.13) models; (2) **Event Owner one-time purchases** — an individual B2C customer (a couple, a quinceañera's parents, etc.) pays once for a single event. Event Owners don't have their own Organization (they're CLIENT members of the shared SYSTEM organization, per Architecture.md's "AllInvites Default Organization"), so product (2) doesn't fit the Organization-scoped `Subscription` entity at all and is out of this Epic's scope (see §3).

---

# 2. Scope

This Epic covers, per API_SPEC.md §30 "Billing API" and MASTER_SPEC §27.4/§28.4:

- Retrieve Subscription (current plan, status, billing-cycle state).
- Change Plan — Upgrade / Downgrade, including compatibility validation and effective-date calculation.
- Cancel Subscription — scheduled or immediate, preserving history.
- Retrieve Invoices — list, filter by period, download reference (actual invoice generation "may be delegated to an external billing provider," API_SPEC.md §30).
- Retrieve Payment History.
- Validate License — feature/usage-limit checks, "may be consumed internally by other modules" (API_SPEC.md §30) — the mechanism that gates the per-plan features already catalogued in MASTER_SPEC §16.3 (event caps, guest caps, White Label, Custom Domain, API, AI Assistant, by plan tier).
- Plan ownership (resolved by this Epic's contract audit — see §9): the `Plan` resource and the commercial "Organization Plan"/"Planes" concept are Billing-owned, not Organizations-owned, reconciling the MASTER_SPEC §27.2 / Architecture.md "Organizations" conflict already recorded by EPIC-003.

**Not yet in scope for implementation** — each item below requires an explicit product decision before any Story that depends on it may be contract-audited in full (see §8):

- Pricing and currency for the plan catalog in MASTER_SPEC §16.3.
- Billing cycle cadence (monthly/annual/both) and proration rules.
- Trial existence, length, and conversion behavior (the `Trial` status exists as a named state only; neither MASTER_SPEC nor API_SPEC defines behavior for it).
- `Past Due` → `Suspended` → `Cancelled` transition rules and any grace period (same: named states only, no rules).
- Who is authorized to *change* billing (Change Plan, Cancel) — USER_FLOWS.md Flow 17 "Manage Subscription" says the Organization Owner "or has billing permissions"; "billing permissions" is not a canonical permission or role (MASTER_SPEC §18 closes the role list at OWNER/ADMIN/MEMBER/CLIENT) — still needs an explicit decision (§8, item 6). Who may *retrieve* is already resolved by STORY-004-001 (any ACTIVE member, deliberately not OWNER-only, so a non-Owner isn't locked out of seeing a Past Due status) — that decision does not extend to changing anything.
- Whether `Invoice` needs its own MASTER_SPEC entity definition (API_SPEC.md §30 treats it as a first-class capability — "Retrieve Invoices", `InvoiceGenerated` event — but MASTER_SPEC's §26.x entity catalog has no Invoice entry, unlike Subscription §26.13 and API Key §26.14).

---

# 3. Out of Scope

The following are not implemented as part of this Epic:

- The B2C one-time event-purchase product (see §1 "Two commercial products, not one") — a distinct commercial product with no specification anywhere beyond MASTER_SPEC §39.1's one-line mention, no Organization of its own to attach to, and no relationship to an Event (Events is a later Epic). Deferred to its own future Story.
- Payment gateway / processor integration — MASTER_SPEC §39.1 "Payment Gateway": status "Pendiente"; candidates Stripe, Mercado Pago, Paddle, Lemon Squeezy listed, no provider selected; explicitly "no bloquea el desarrollo del MVP." The Provider Independence seam (API_SPEC.md §30) is what allows this Epic to proceed without a provider decision.
- Actual financial processing (charging, refunds, chargebacks, tax/VAT calculation) — delegated to whichever external provider is eventually selected; this Epic owns only Subscription/Plan/Invoice *metadata*, not money movement.
- Organizations' own entity, settings, status, or branding — EPIC-003, closed; Billing only reads the Organization id a Subscription belongs to, the same pattern Organizations used toward Identity (ADR-011; no direct cross-module entity/repository access).
- Identity's authentication, session, or membership model — EPIC-002, closed.
- API Key entity, repository, or API — MASTER_SPEC §26.14 states API Keys belong to an Organization, not to Billing; module ownership is unresolved in both ADR-011's and API_SPEC.md §19's ownership tables (the same pre-existing gap EPIC-003 already recorded; not this Epic's to resolve).
- Any new RBAC permission, role, or actor beyond the canonical `OWNER`/`ADMIN`/`MEMBER`/`CLIENT` model — including whatever Flow 17's undefined "billing permissions" phrase was meant to imply (see §2, open decision).
- Event, Guest, Messaging, Invitation Deployment, Analytics, AI functionality.

---

# 4. Dependencies

## 4.1 EPIC-002 Identity (Closed) and EPIC-003 Organizations (Closed)

This Epic depends on both: Identity's authentication/session resolution (reused via the same `SessionVerifier` pattern Organizations established in STORY-003-001), and Organizations' `Organization` entity, since every Subscription belongs to exactly one Organization (MASTER_SPEC §26.13). Billing does not reopen or modify any EPIC-002 Story, and does not touch Identity's login/session flow at all.

**STORY-004-001 does reopen EPIC-003.** Its contract (see §5) extends STORY-003-001's closed Create Organization request schema (`plan_id` becomes required) and adds a new enforcement check to STORY-003-002/003/005/006's Retrieve/Update use cases, alongside the existing `ORGANIZATION_SUSPENDED` check STORY-003-004 added there. This is the same kind of "closed Story changed" precedent STORY-003-004 itself set — recorded explicitly here rather than silently reopened.

MASTER_SPEC §28.2 ("Organizations Module") already documents a one-way event dependency in the other direction — Organizations module "Consume: SubscriptionChanged" — meaning Organizations is specified to react to Billing's domain events. Like STORY-003-001's `OrganizationCreated`, no event bus or consumer exists anywhere in this codebase yet; if/when implemented, this would be a plain typed value, not a dispatched event, consistent with existing precedent — not decided here, just recorded as the documented (but unimplemented) direction of the relationship.

## 4.2 Architectural Governance

- `ADR-001` Multi-Tenant Ownership Model — a Subscription is tenant-scoped to its Organization, same as every other entity in this system.
- `ADR-011` Domain Module Ownership — assigns `Subscription → Billing`; this Epic's Plan-ownership resolution (§9) extends that assignment to `Plan` as well, consistent with MASTER_SPEC §28.4's own Recursos list (`Subscription`, `Plan`, `License`).
- `ADR-007` Security-First — Architecture.md's "Auditability" section lists "Subscription updates" as an example of a critical action requiring an audit record, the same ADR-007 obligation STORY-003-004 satisfied for Organization status changes via the Audit module (`recordAuditEvent`). This Epic is expected to reuse that same Audit module, not introduce a second logging mechanism.

---

# 5. Stories

STORY-004-001's contract is decided (below), through a product-decision pass with you — pending implementation authorization. The remaining Stories are still just a proposed decomposition: no contract audit or product approval yet.

## STORY-004-001 — Subscription Creation at Purchase, Retrieve, and Trial Enforcement

**Status:** Contract decided — pending implementation authorization.

### Objective

Give every PARTNER Organization a `Subscription` the moment it's purchased/created, let any ACTIVE member retrieve it, and enforce a 30-day Trial window after which the Organization is blocked from every other organization-scoped action until it's paid for — all without requiring a payment-provider integration (API_SPEC.md §30 "Provider Independence").

### Scope

- Extend `POST /api/v1/management/organizations` (STORY-003-001) to require `plan_id` and atomically create a `Subscription` row alongside the `Organization` and its OWNER `OrganizationMembership`, in the same transaction.
- New `GET /api/v1/management/organizations/:organizationId/subscription` (Retrieve Subscription).
- The MASTER_SPEC §16.3 plan catalog as a fixed, closed enum: `EMPRENDEDOR`, `PLANNER_ESENCIAL`, `PLANNER_PROFESIONAL`, `AGENCIA_ILIMITADA`. No pricing, no feature-flag enforcement — that's STORY-004-005 "Validate License."
- A computed Trial-expiry check and a new Billing-owned cross-module service (`verifySubscriptionActive`) that STORY-003-002/003/005/006's use cases call, returning `403 SUBSCRIPTION_PAST_DUE`.
- Audit logging of Subscription creation (ADR-007; Architecture.md "Auditability" lists "Subscription updates"), via the existing Audit module, same mechanism STORY-003-004 used.

### Out of Scope

- The B2C one-time event-purchase product — see §1/§3. Not an Organization-scoped `Subscription`, not addressed by this Story.
- Actual payment processing of any kind. The Subscription is created `TRIAL` with no payment check; "pay to reactivate" is a future Story, blocked on the payment-provider decision (§8, item 1).
- Change Plan, Cancel Subscription, Retrieve Invoices, Retrieve Payment History, Validate License — STORY-004-002 through 005, separately audited.
- The `SUSPENDED`, `CANCELLED`, and `EXPIRED` Subscription statuses, and any transition into `ACTIVE` (e.g. via a future real payment) — this Story only ever writes `TRIAL` at creation; no other status is ever written by it.
- Identity's login/session flow — untouched. Blocking is enforced per-endpoint on organization-scoped actions, the same mechanism STORY-003-004 used for `ORGANIZATION_SUSPENDED`, not at authentication.

### Preconditions

- For Create Organization: caller supplies a valid Bearer access token (unchanged from STORY-003-001).
- For Retrieve Subscription: caller supplies a valid Bearer access token and holds an ACTIVE membership (any role) in the target Organization, or is platform-privileged (STORY-003-004).

### API Reference

- `POST /api/v1/management/organizations` (extended, STORY-003-001).
- `GET /api/v1/management/organizations/:organizationId/subscription` (new).

### Authentication / Authorization

- Create Organization: unchanged — any authenticated User.
- Retrieve Subscription: any ACTIVE member of the target Organization (not OWNER-only), or a platform-privileged caller (ACTIVE OWNER/ADMIN in SYSTEM) for any Organization — the same bypass STORY-003-004 gave Retrieve Organization, for consistency. Chosen deliberately so a non-Owner member isn't locked out of seeing that the account is Past Due.

### Request Schema (Create Organization, extended)

```json
{
  "display_name": "string, required",
  "slug": "string, optional",
  "plan_id": "EMPRENDEDOR | PLANNER_ESENCIAL | PLANNER_PROFESIONAL | AGENCIA_ILIMITADA, required"
}
```

### Response Schema

Create Organization's existing response (`organization`, `membership`) gains a `subscription` field. Retrieve Subscription returns the same shape directly:

```json
{
  "success": true,
  "data": {
    "organization_id": "uuid",
    "plan": "EMPRENDEDOR",
    "status": "TRIAL",
    "trial_ends_at": "ISO-8601 timestamp | null",
    "created_at": "ISO-8601 timestamp"
  }
}
```

`status` in both responses is the Subscription's **effective** status, not necessarily its raw stored value — see "Trial Enforcement" below.

### Status / Error Mapping

- Create Organization (additions only — existing mappings from STORY-003-001 unchanged): `VALIDATION_ERROR` (422) for a missing or unrecognized `plan_id`.
- Retrieve Subscription: `VALIDATION_ERROR` (422) malformed `organizationId`; `RESOURCE_NOT_FOUND` (404) nonexistent, inaccessible (no ACTIVE membership and not platform-privileged), or SYSTEM organization — byte-identical, same concealment rule as Retrieve Organization; `UNAUTHORIZED` (401) authentication failure; `INTERNAL_SERVER_ERROR` (500) unexpected failure. No `FORBIDDEN` — there is no role gate, only the membership/concealment check.
- Enforcement additions to Retrieve/Update Organization, Retrieve/Update Branding, Retrieve/Update Settings: `403 SUBSCRIPTION_PAST_DUE`, checked immediately after the existing `ORGANIZATION_SUSPENDED` check (suspension wins if both are true).

### Trial Enforcement

- `trial_ends_at` is set at creation to `created_at + 30 days`. No scheduled job ever writes to the `status` column — there is no cron/background transition.
- A Subscription's **effective status**, computed at read time, is: `"PAST_DUE"` if the stored `status` is `"TRIAL"` and `now > trial_ends_at`; otherwise the stored `status` unchanged. This is the same "derived, not stored" pattern `Organization.isSuspended()` already uses, applied here to a time-based condition instead of a stored enum.
- `verifySubscriptionActive(organizationId)` (new, Billing-owned, ADR-011-style narrow service — same shape as Identity's `verifyOwnerMembership`/`verifyPlatformPrivilege`) computes the effective status and returns `{type: "SUBSCRIPTION_PAST_DUE"}` when it is `PAST_DUE`, else success.
- Called by: Retrieve/Update Organization, Retrieve/Update Branding, Retrieve/Update Settings (the same five use cases STORY-003-004 touched for `ORGANIZATION_SUSPENDED`).
- **Excluded** from this check: Suspend/Activate Organization (a platform-privileged action on a *different* organization — must not be blocked by that organization's own billing state, the same carve-out logic as `/activate` being exempt from its own suspension check) and Retrieve Subscription itself (must stay reachable so the account can see it's Past Due and know to pay — the whole reason this endpoint exists).
- Login is never touched — this enforcement lives entirely inside Organizations'/Billing's existing organization-scoped request handling, not Identity.

### Repository and Service Boundaries

- New `packages/modules/billing` module (ADR-002 physical structure), its first real content.
- New `subscriptions` table (`packages/database`): `id`, `organization_id` (unique — one Subscription per Organization), `plan` (enum, not null), `status` (enum, not null, default `TRIAL`), `trial_ends_at` (nullable timestamp), `created_at`.
- New Billing-owned public Application Service, `createInitialSubscription(params: { organizationId, plan }, tx) => Promise<Result<{ subscriptionId }, CreateInitialSubscriptionError>>` — called by Organizations' (extended) Create Organization use case inside the same transaction already used for `CreateInitialOwnerMembershipService` (STORY-003-001), the same cross-module-write pattern, just a second call.
- New Billing-owned public Application Service, `verifySubscriptionActive` (see Trial Enforcement above) — called by the five existing Organizations use cases listed there.
- Organizations must not import Billing's `SubscriptionRepository`, `Subscription` domain internals, or the `subscriptions` table directly (ADR-011) — only through the two services above. Symmetric to how Organizations already treats Identity.

### Required Tests

- Billing, unit: `createInitialSubscription` — success; duplicate `organizationId` (unique constraint) → `UNEXPECTED`. `verifySubscriptionActive` — `TRIAL` within window → success; `TRIAL` past `trial_ends_at` → `SUBSCRIPTION_PAST_DUE`; stored `PAST_DUE`/`ACTIVE` → mapped correctly; nonexistent Subscription → `UNEXPECTED` (should never happen given atomic creation, but defensive).
- Organizations, use case (Create Organization, extended): missing/invalid `plan_id` → `VALIDATION_ERROR`; success creates all three rows atomically; Billing-service failure rolls back the whole transaction (no orphaned Organization or Membership) — same rollback discipline as the existing Identity-contract failure test.
- Organizations, use case (Retrieve Subscription): ACTIVE member (any role) → success; platform-privileged non-member → success; SUSPENDED/REMOVED/no membership and not platform-privileged → `RESOURCE_NOT_FOUND`; SYSTEM organization → identical `RESOURCE_NOT_FOUND`; unauthenticated → `UNAUTHORIZED`; response shows the *effective* status (`PAST_DUE`) once `trial_ends_at` has passed, even though the stored value is still `TRIAL`.
- Organizations, use cases (Retrieve/Update Organization, Branding, Settings): Past Due Organization → `403 SUBSCRIPTION_PAST_DUE`, after the existing `ORGANIZATION_SUSPENDED` check; both conditions true → `ORGANIZATION_SUSPENDED` wins; Active/Trial-within-window Organization → unchanged existing behavior.
- Organizations, use case (Suspend/Activate): unaffected by the target Organization's own Subscription status — a Past Due Organization can still be suspended/activated by a platform-privileged caller.
- Handler/route: extended Create Organization request/response shape; new Retrieve Subscription endpoint's full status/error mapping.

### Acceptance Criteria

- Every newly created Organization has exactly one Subscription, in `TRIAL`, `trial_ends_at` 30 days out — created in the same transaction, never observable without one.
- Any ACTIVE member (not just OWNER) can retrieve a Subscription; a platform-privileged caller can retrieve any Organization's.
- 30 days after creation, with no other action taken, the Organization's effective Subscription status becomes `PAST_DUE` and every Retrieve/Update on Organization/Branding/Settings is blocked with `403 SUBSCRIPTION_PAST_DUE` — except Retrieve Subscription, which still succeeds and reports `PAST_DUE`.
- Login succeeds at all times regardless of Subscription status.
- Suspend/Activate Organization is never blocked by the target Organization's own Subscription status.
- No payment, pricing, or provider logic exists anywhere in this Story's implementation.

### Explicit Implementation Boundary

This Story implements exactly: extending Create Organization's validation/transaction to also create a Subscription → the new Retrieve Subscription endpoint → the computed Trial-expiry check → wiring that check into the five existing enforcement points. It does not implement Change Plan, Cancel, Invoices, Payment History, Validate License, any payment processing, or the B2C one-time-purchase product.

---

## Remaining Stories (Proposed Decomposition — None Approved Yet)

No Story below has a contract audit or product approval. This is a proposed breakdown for sequencing discussion only — each needs its own audit before implementation, exactly as STORY-004-001 just went through.

- **STORY-004-002 — Change Plan (Upgrade / Downgrade).** Blocked on: billing-cycle/proration decision, who-may-manage-billing decision (§8, item 6 — still open; STORY-004-001 only resolved who may *retrieve*, not who may *change*).
- **STORY-004-003 — Cancel Subscription.** Blocked on: cancellation semantics (immediate vs. scheduled), who-may-manage-billing decision.
- **STORY-004-004 — Retrieve Invoices & Payment History.** Blocked on: whether `Invoice` gets a real entity definition or proceeds as Billing-internal metadata only (see §2).
- **STORY-004-005 — Validate License (Feature/Usage-Limit Checks).** The cross-module contract other modules would call (ADR-011-style narrow service). Likely the next-highest-leverage Story since later Epics (Events, Assets, etc.) may need it to gate plan-limited features — not blocked on a payment provider, since it only reads already-known plan/limit data.

Sequencing, and which Story to open for a full contract audit next, is a decision for you — not assumed here.

---

# 6. Technical Constraints

All Stories must respect the following constraints:

- Billing business logic belongs to `packages/modules/billing` (new module — confirm its placeholder/physical scaffold doesn't already exist under a different name before creating it).
- Billing must never create, modify, delete, or directly query Organizations- or Identity-owned entities/tables — only through their public Application Services (ADR-011), the same discipline Organizations held toward Identity throughout EPIC-003.
- Organizations must never create, modify, delete, or directly query Billing-owned entities/tables (`Subscription`, the `subscriptions` table) — only through Billing's public Application Services (`createInitialSubscription`, `verifySubscriptionActive`), the new cross-module direction STORY-004-001 adds (Organizations → Billing, alongside the existing Organizations → Identity).
- Identity must never gain a dependency on Billing or Organizations' Subscription state — login/session resolution stays entirely Identity's own concern (STORY-004-001 confirmed this explicitly).
- Domain code must not depend on Next.js, the eventual payment provider's SDK, or HTTP — per API_SPEC.md §30 "Provider Independence."
- No shared domain ownership: Organization remains Organizations'; User/OrganizationMembership remain Identity's; API Key ownership remains unresolved and out of scope (§3).
- No new RBAC permission, role, or actor may be introduced without explicit approval — including resolving Flow 17's "billing permissions" phrase.
- Tenant/organization isolation must be enforced server-side, same as every other module.
- All security-sensitive and financially-sensitive behavior requires automated tests; subscription status changes must be audit-logged (§4.2).

---

# 7. Epic Definition of Done

EPIC-004 is complete when:

- Every Story proposed in §5 (or a product-revised list) is contract-audited, approved, implemented, and tested.
- No payment-processing, tax-calculation, or provider-specific logic has been introduced directly in the Billing module — it depends on business contracts only (API_SPEC.md §30 Provider Independence), consistent with MASTER_SPEC §39.1 leaving the provider choice open.
- No Organization-entity, User-entity, or API-Key logic has been introduced anywhere in the Billing module.
- The `Plan` resource is documented and implemented as Billing-owned everywhere a client or another module reads it, resolving the MASTER_SPEC §27.2 / Architecture.md conflict this Epic's audit identified.
- Unit tests pass. Typecheck passes. Lint passes. Build passes.
- No undocumented architectural changes were introduced.
- No unresolved security-critical issues remain.

---

# 8. Open Product Decisions (Blocking Before Any Story Is Implemented)

None of the items below are assumed or invented here — each needs an explicit, unambiguous decision from you before the Story it blocks can be contract-audited:

1. Payment provider selection (or explicit confirmation that it stays deferred past this Epic, per MASTER_SPEC §39.1). **Still open** — confirmed deferred past STORY-004-001 specifically.
2. Plan pricing and currency (MASTER_SPEC §16.3 has tiers and features, no prices). **Still open** — not needed by STORY-004-001, which never surfaces a price.
3. Billing cycle cadence and proration rules. **Still open** — not needed until STORY-004-002 (Change Plan).
4. Trial existence, length, and conversion behavior. **Resolved for STORY-004-001**: every Subscription is created `TRIAL`, fixed 30-day length, no payment check at creation. Conversion *to* `ACTIVE` (via real payment) remains open, blocked on item 1.
5. `Past Due` → `Suspended` → `Cancelled` transition rules and grace period, if any. **Partially resolved**: `TRIAL` → effective `PAST_DUE` at 30 days is decided (computed, not stored — see STORY-004-001 "Trial Enforcement"), and Past Due's blocking behavior is decided. `PAST_DUE` → `SUSPENDED`/`CANCELLED` and any grace period remain open.
6. Who may manage billing for an Organization — resolving Flow 17's undefined "billing permissions" phrase. **Partially resolved**: who may *retrieve* is decided (any ACTIVE member, or platform-privileged). Who may *change* (Change Plan, Cancel) remains open — needed before STORY-004-002/003.
7. Whether `Invoice` gets a real MASTER_SPEC entity definition, or proceeds as Billing-internal metadata only (same treatment STORY-003-006 gave `support_contact_email` — an explicit, scoped product decision, not inferred). **Still open** — needed before STORY-004-004.
8. Which Story from §5 to open for full contract audit first (or a different decomposition entirely). **Resolved**: STORY-004-001, now contract-decided (see its section).

---

# 9. Known Documentation Inconsistencies

- **Naming.** MASTER_SPEC calls this context/module "Subscriptions" (§27.4 "Subscriptions Context", §28.4 "Subscription Module"); ADR-011, Architecture.md ("## Billing"), API_SPEC.md (§30 "Billing API"), and IMPLEMENTATION_ROADMAP.md all call it "Billing." This Epic adopts "Billing" as canonical, matching the majority and the already-implemented ADR-011/API_SPEC ownership tables. MASTER_SPEC's "Subscriptions" wording is not corrected at the source by this Epic — recorded here, not resolved in MASTER_SPEC itself.
- **Plan ownership** (resolved by this Epic, at the EPIC-004 documentation layer — see the note below on why the source documents themselves are unedited). MASTER_SPEC §27.2 "Organizations Context" lists "Organization Plan" under its own "Incluye" list, directly conflicting with §27.4/§28.4 assigning `Plan` to Subscriptions/Billing (also confirmed by §28.4's own Recursos: Subscription, Plan, License). Architecture.md contradicts itself the same way — its "## Organizations" section lists "Subscription Ownership" under its own Incluye list, while its own separate "## Billing" section lists "Planes" and "Suscripciones" as Billing's. **This Epic resolves the conflict**: `Plan` (and the Subscription/Billing-Cycle concepts generally) are Billing-owned, not Organizations-owned.
  - I attempted to add a short reconciliation note directly in MASTER_SPEC §27.2 and in Architecture.md's "## Organizations" section — the same technique used to resolve STORY-003-006's API_SPEC §32 Settings-module conflict — but the edit was blocked by the Claude Code auto-mode permission classifier ("Modify Shared Resources"). The stale "Organization Plan" / "Subscription Ownership" wording remains unedited at the source in both documents until you either clear that edit (e.g. a permission rule) or make the edit yourself.
- **"Organization Status" vs. "Estado comercial de la organización"** — not a conflict, but easy to confuse. MASTER_SPEC §27.2's "Organization Status" is the operational ACTIVE/SUSPENDED field STORY-003-004 implemented (Organizations-owned). Architecture.md's "## Billing" section separately lists "Estado comercial de la organización" ("commercial status of the organization") as a distinct, Billing-owned concept (e.g. Trial/Active/Past Due/Suspended/Cancelled/Expired, per API_SPEC.md §30's Subscription Status enum). Recorded here so neither this Epic nor a future one conflates the two.
- **Invoice has no MASTER_SPEC entity definition.** API_SPEC.md §30 treats `Invoice` as a first-class capability ("Retrieve Invoices", `InvoiceGenerated` event) and ADR-011-style ownership would assign it to Billing, but MASTER_SPEC's §26.x entity catalog (which does define Subscription §26.13 and API Key §26.14) has no Invoice entry. Not resolved here — see §8, item 7.

---

This document is a contract-audit draft for product review, not an implementation-ready contract — no Story has been approved for implementation.
