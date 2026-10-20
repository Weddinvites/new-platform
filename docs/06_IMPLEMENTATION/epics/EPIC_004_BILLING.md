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
- Who is authorized to manage billing — USER_FLOWS.md Flow 17 "Manage Subscription" says the Organization Owner "or has billing permissions"; "billing permissions" is not a canonical permission or role (MASTER_SPEC §18 closes the role list at OWNER/ADMIN/MEMBER/CLIENT) — needs an explicit decision, most likely OWNER-only per the STORY-003-003/005/006 precedent, but not assumed here.
- Whether `Invoice` needs its own MASTER_SPEC entity definition (API_SPEC.md §30 treats it as a first-class capability — "Retrieve Invoices", `InvoiceGenerated` event — but MASTER_SPEC's §26.x entity catalog has no Invoice entry, unlike Subscription §26.13 and API Key §26.14).

---

# 3. Out of Scope

The following are not implemented as part of this Epic:

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

This Epic depends on both: Identity's authentication/session resolution (reused via the same `SessionVerifier` pattern Organizations established in STORY-003-001), and Organizations' `Organization` entity, since every Subscription belongs to exactly one Organization (MASTER_SPEC §26.13). Billing does not reopen or modify any EPIC-002 or EPIC-003 Story.

MASTER_SPEC §28.2 ("Organizations Module") already documents a one-way event dependency in the other direction — Organizations module "Consume: SubscriptionChanged" — meaning Organizations is specified to react to Billing's domain events. Like STORY-003-001's `OrganizationCreated`, no event bus or consumer exists anywhere in this codebase yet; if/when implemented, this would be a plain typed value, not a dispatched event, consistent with existing precedent — not decided here, just recorded as the documented (but unimplemented) direction of the relationship.

## 4.2 Architectural Governance

- `ADR-001` Multi-Tenant Ownership Model — a Subscription is tenant-scoped to its Organization, same as every other entity in this system.
- `ADR-011` Domain Module Ownership — assigns `Subscription → Billing`; this Epic's Plan-ownership resolution (§9) extends that assignment to `Plan` as well, consistent with MASTER_SPEC §28.4's own Recursos list (`Subscription`, `Plan`, `License`).
- `ADR-007` Security-First — Architecture.md's "Auditability" section lists "Subscription updates" as an example of a critical action requiring an audit record, the same ADR-007 obligation STORY-003-004 satisfied for Organization status changes via the Audit module (`recordAuditEvent`). This Epic is expected to reuse that same Audit module, not introduce a second logging mechanism.

---

# 5. Stories (Proposed Decomposition — None Approved Yet)

No Story below has a contract audit or product approval. This is a proposed breakdown for sequencing discussion only — each Story needs its own audit (citations, Scope/Out-of-Scope, open product decisions resolved) before implementation, exactly as EPIC-003's Stories were each audited individually.

- **STORY-004-001 — Retrieve Subscription & Plan Catalog.** Read-only: current Subscription, its status, and the MASTER_SPEC §16.3 plan catalog. Lowest-risk starting point; mirrors STORY-003-002's shape.
- **STORY-004-002 — Change Plan (Upgrade / Downgrade).** Blocked on: billing-cycle/proration decision, authorization-actor decision.
- **STORY-004-003 — Cancel Subscription.** Blocked on: cancellation semantics (immediate vs. scheduled), authorization-actor decision.
- **STORY-004-004 — Retrieve Invoices & Payment History.** Blocked on: whether `Invoice` gets a real entity definition or proceeds as Billing-internal metadata only (see §2).
- **STORY-004-005 — Validate License (Feature/Usage-Limit Checks).** The cross-module contract other modules would call (ADR-011-style narrow service, same shape as Identity's `verifyOwnerMembership`/`verifyPlatformPrivilege`). Likely the highest-leverage Story since later Epics (Events, Assets, etc.) may need it to gate plan-limited features — but not blocked on a payment provider, since it only reads already-known plan/limit data.

Sequencing, and which Story (if any) to open for a full contract audit first, is a decision for you — not assumed here.

---

# 6. Technical Constraints

All Stories must respect the following constraints:

- Billing business logic belongs to `packages/modules/billing` (new module — confirm its placeholder/physical scaffold doesn't already exist under a different name before creating it).
- Billing must never create, modify, delete, or directly query Organizations- or Identity-owned entities/tables — only through their public Application Services (ADR-011), the same discipline Organizations held toward Identity throughout EPIC-003.
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

1. Payment provider selection (or explicit confirmation that it stays deferred past this Epic, per MASTER_SPEC §39.1).
2. Plan pricing and currency (MASTER_SPEC §16.3 has tiers and features, no prices).
3. Billing cycle cadence and proration rules.
4. Trial existence, length, and conversion behavior.
5. `Past Due` → `Suspended` → `Cancelled` transition rules and grace period, if any.
6. Who may manage billing for an Organization — resolving Flow 17's undefined "billing permissions" phrase.
7. Whether `Invoice` gets a real MASTER_SPEC entity definition, or proceeds as Billing-internal metadata only (same treatment STORY-003-006 gave `support_contact_email` — an explicit, scoped product decision, not inferred).
8. Which Story from §5 to open for full contract audit first (or a different decomposition entirely).

---

# 9. Known Documentation Inconsistencies

- **Naming.** MASTER_SPEC calls this context/module "Subscriptions" (§27.4 "Subscriptions Context", §28.4 "Subscription Module"); ADR-011, Architecture.md ("## Billing"), API_SPEC.md (§30 "Billing API"), and IMPLEMENTATION_ROADMAP.md all call it "Billing." This Epic adopts "Billing" as canonical, matching the majority and the already-implemented ADR-011/API_SPEC ownership tables. MASTER_SPEC's "Subscriptions" wording is not corrected at the source by this Epic — recorded here, not resolved in MASTER_SPEC itself.
- **Plan ownership** (resolved by this Epic, at the EPIC-004 documentation layer — see the note below on why the source documents themselves are unedited). MASTER_SPEC §27.2 "Organizations Context" lists "Organization Plan" under its own "Incluye" list, directly conflicting with §27.4/§28.4 assigning `Plan` to Subscriptions/Billing (also confirmed by §28.4's own Recursos: Subscription, Plan, License). Architecture.md contradicts itself the same way — its "## Organizations" section lists "Subscription Ownership" under its own Incluye list, while its own separate "## Billing" section lists "Planes" and "Suscripciones" as Billing's. **This Epic resolves the conflict**: `Plan` (and the Subscription/Billing-Cycle concepts generally) are Billing-owned, not Organizations-owned.
  - I attempted to add a short reconciliation note directly in MASTER_SPEC §27.2 and in Architecture.md's "## Organizations" section — the same technique used to resolve STORY-003-006's API_SPEC §32 Settings-module conflict — but the edit was blocked by the Claude Code auto-mode permission classifier ("Modify Shared Resources"). The stale "Organization Plan" / "Subscription Ownership" wording remains unedited at the source in both documents until you either clear that edit (e.g. a permission rule) or make the edit yourself.
- **"Organization Status" vs. "Estado comercial de la organización"** — not a conflict, but easy to confuse. MASTER_SPEC §27.2's "Organization Status" is the operational ACTIVE/SUSPENDED field STORY-003-004 implemented (Organizations-owned). Architecture.md's "## Billing" section separately lists "Estado comercial de la organización" ("commercial status of the organization") as a distinct, Billing-owned concept (e.g. Trial/Active/Past Due/Suspended/Cancelled/Expired, per API_SPEC.md §30's Subscription Status enum). Recorded here so neither this Epic nor a future one conflates the two.
- **Invoice has no MASTER_SPEC entity definition.** API_SPEC.md §30 treats `Invoice` as a first-class capability ("Retrieve Invoices", `InvoiceGenerated` event) and ADR-011-style ownership would assign it to Billing, but MASTER_SPEC's §26.x entity catalog (which does define Subscription §26.13 and API Key §26.14) has no Invoice entry. Not resolved here — see §8, item 7.

---

This document is a contract-audit draft for product review, not an implementation-ready contract — no Story has been approved for implementation.
