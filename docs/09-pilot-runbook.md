# Pilot runbook

How to run the first live practice on CollaboratMD: what to sign and set up before real patient data arrives, and how to measure whether it worked. The pilot is the first time real claims go to real payers, so the priority is to find problems while volume is small and a person is watching.

## 0. Before choosing the practice

- [ ] Security review commissioned, or scheduled with a date before go-live (see `docs/06-threat-model.md`).
- [ ] Neon point-in-time history configured and one restore drill passed (`docs/08-restore-drill.md`).
- [ ] Uptime monitor and error alerts set (`docs/07-operations.md`).
- [ ] Legal documents reviewed by healthcare counsel: BAA, terms, privacy policy (`docs/legal/`).
- [ ] BAAs in place with the subprocessors that will touch PHI for this practice: Neon, Vercel, and any of Stedi, Stripe, Twilio, Resend and Anthropic that will be used.

## 1. Choosing the practice

A good first practice:

- is small (1 to 5 providers), with one payer mix you understand, usually commercial plus Medicare;
- has a biller who will use it daily and tell you what is wrong;
- can keep its current system running in parallel for the first month;
- agrees in writing that this is a pilot, what support looks like, and how either side ends it.

## 2. Paperwork (week 0)

- [ ] Pilot agreement: scope, dates, price (or none), support hours, how either side ends it, and how their data is returned (the Settings → Data export zip).
- [ ] BAA signed by both sides (template: `docs/legal/baa-template.md`, after counsel review).
- [ ] Practice onboarding checklist started (`docs/legal/onboarding-checklist.md`).

## 3. Setup (week 1)

Do this with the practice administrator on a call; the in-app setup guide on the dashboard tracks most of it.

- [ ] Practice profile: legal name, NPI, tax ID, address. Providers with NPIs and taxonomies.
- [ ] Users invited with the right roles. Second factor required for all (Settings → Sign-in security). SSO if they have an identity provider.
- [ ] Clearinghouse connected (Stedi). Enrollment for claims, ERAs and EFT submitted for each payer (Settings → Payer enrollment); ERAs only flow once payers approve the enrollment.
- [ ] Payers list checked against the payer IDs on their current claims.
- [ ] Fee schedule loaded; contracted rates for the top payers if they have them.
- [ ] Billing policies agreed: write-off limits, two-person refunds, strict scrubbing on for the first month.
- [ ] Patients imported (CSV import or FHIR), then spot-checked: 20 random patients compared with the source system.
- [ ] Open balances from the old system loaded (Billing → Balances from your previous system), totals matched to the old system's A/R report.
- [ ] Stripe connected if they take card payments; a $1 test payment made and refunded.
- [ ] Statement and text templates reviewed by the practice.

## 4. First claims (week 2)

- [ ] First 10 claims: build them in CollaboratMD, and compare each 837 (download from the claim page) field by field with how the old system would have sent it.
- [ ] Submit those 10 and watch the 999 and 277CA acknowledgments come back on each claim.
- [ ] Any rejection: fix the cause in CollaboratMD (a scrub rule or a data field), not only on the claim.
- [ ] Then submit daily volume, with someone checking the rejection list every morning.

## 5. Measure (weeks 2 to 12)

Record a **baseline** from the practice's old system for the 3 months before the pilot, then the same numbers each week from CollaboratMD's Reports. Agree targets with the practice at the start; don't promise numbers before you have data.

| Measure | Where in CollaboratMD | Baseline | Week 4 | Week 8 | Week 12 |
|---|---|---|---|---|---|
| Clean claim rate (accepted on first submission) | Reports → Payer performance | | | | |
| Denial rate (by count and dollars) | Denials; Reports | | | | |
| Days in A/R | Reports → A/R aging | | | | |
| Share of A/R over 90 days | Reports → A/R aging | | | | |
| Charge lag (visit to claim) | Report builder: claims by date of service and created date (no built-in report yet) | | | | |
| ERA auto-post rate | Remittance (auto-posted vs pending) | | | | |
| Patient collections (share of patient balance collected) | Billing; Reports | | | | |
| Biller hours per week on billing | Ask the practice | | | | |

Also track support: every question or problem in one list, with its category (bug, missing feature, confusing, training) and how long it took to resolve.

## 6. Weekly check-in (30 minutes)

1. Numbers from the table.
2. Open rejections and denials over $500.
3. Support list: what is fixed, what is next.
4. Anything the practice is still doing in the old system, and why.

## 7. End of pilot (week 12)

Decide together:

- **Continue:** convert to a paid agreement, switch off the old system, and keep monthly check-ins for a quarter.
- **Extend:** name the specific problems left and a date.
- **Stop:** give them the full data export, confirm they have it, then delete their data on the date the agreement says and confirm deletion in writing.

Write up what was learned: which scrub rules fired, which payers rejected and why, and what setup took longest. That write-up is the input for onboarding the next practices faster.
