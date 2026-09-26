# Practice onboarding checklist

For each new practice. Sections 1 and 2 must be complete before any real patient data is entered. Keep a copy, with dates and names, in the practice's customer file.

> The contract items below are placeholders for documents counsel has approved. Don't use the drafts in `docs/legal/` until that review is done.

## 1. Agreements

- [ ] Terms of service accepted by an authorized signer (name, title, date).
- [ ] Business Associate Agreement signed by both parties (`baa-template.md` after counsel review).
- [ ] Order form: plan, price, start date, billing contact.
- [ ] If the practice is a billing company acting for other practices: confirm its own BAAs with those practices.

## 2. Security basics

- [ ] Practice administrator named, with a backup administrator.
- [ ] Second-factor sign-in required for all users (Settings → Sign-in security).
- [ ] SSO and SCIM connected if the practice uses an identity provider (Settings → Single sign-on, Team and roles).
- [ ] IP allowlist and session length decided (Settings → Team and roles).
- [ ] Billing policies set: write-off limits, two-person refunds, exports limited to administrators if wanted (Settings → Policies).
- [ ] If AI features are wanted with clinical text: the practice has confirmed its BAA with Anthropic when connecting Claude (Settings → Integrations). Otherwise they stay limited to codes and de-identified text.

## 3. Practice setup

- [ ] Practice profile: legal name, NPI (type 2), tax ID, address, phone.
- [ ] Providers: NPIs, taxonomies, credentials and expiry dates (Settings → Providers, Credentials).
- [ ] Users invited with roles.
- [ ] Payers and payer IDs; enrollment for 837, 835 (ERA) and EFT submitted per payer (Settings → Payer enrollment).
- [ ] Clearinghouse connected (Settings → Integrations) and a test eligibility check run.
- [ ] Fee schedule and contracted rates.
- [ ] Payment processing (Stripe) connected and tested with a small payment and refund.
- [ ] Text and email (Twilio, Resend) connected if used; the practice approved message wording.

## 4. Data migration

- [ ] Patients imported (CSV or FHIR) and 20 spot-checked against the old system.
- [ ] Insurance policies imported or verified by eligibility checks.
- [ ] Open balances from the old system loaded and totals reconciled to the old A/R report.
- [ ] Old system kept read-only for at least [90] days, or its data archived.

## 5. Go-live

- [ ] First 10 claims reviewed before submission (see `docs/09-pilot-runbook.md` section 4).
- [ ] Acknowledgments (999, 277CA) seen on those claims.
- [ ] First ERA received and posted.
- [ ] Staff trained: front desk (check-in, estimates, payments), billers (claims, denials, remittance), administrator (settings, audit log, data export).
- [ ] Support contact and hours given to the practice.

## 6. First 90 days

- [ ] Weekly check-ins for the first month, then monthly.
- [ ] First quarterly access review completed by the practice administrator (prompted in the app).
- [ ] Numbers compared with baseline (see the pilot runbook measures).
