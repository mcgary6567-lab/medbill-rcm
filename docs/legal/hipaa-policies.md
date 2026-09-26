# HIPAA security and privacy policies (draft)

> **Draft, not legal advice.** A starting set of policies for CollaboratMD as a business associate, written by the engineering team from how the product and company work today. It must be reviewed by healthcare counsel and a qualified security or compliance professional, adopted formally by company leadership, and revisited at least yearly. Where it describes a product control, the control exists in the code as of this writing. Where it describes a company practice (training, reviews), the company still has to start doing it.

**Owner:** Security Official [name, to be appointed]. **Privacy Official:** [name, to be appointed]; may be the same person at this size.
**Adopted:** [date]. **Next review:** [date + 1 year].

## 1. Scope

These policies cover all workforce members (employees, contractors, founders) and all systems that create, receive, maintain or transmit protected health information (PHI) for practices using CollaboratMD.

## 2. Risk analysis and management (45 CFR 164.308(a)(1))

- A written risk analysis is done before the first live practice and then yearly, or after major changes (new subprocessor, new data type, new hosting). `docs/06-threat-model.md` is the technical input.
- Each risk gets an owner, a decision (fix, mitigate, accept) and a date. Accepted risks are signed off by the Security Official.
- An independent security assessment (penetration test) is done before the first live practice and yearly after.

## 3. Workforce security and access (164.308(a)(3)–(4))

- Only workforce members who need PHI to do their job get access to production data. Today that is limited to [names/roles].
- Production database access uses individual credentials, never shared ones. Access is removed the day someone leaves.
- Support staff do not browse practice data without a support request from that practice; access for support is recorded.
- Platform operator access (`PLATFORM_ADMIN_EMAILS`) is reviewed quarterly.

**In the product:** practices control their own users with roles and capabilities, can require second-factor sign-in, restrict sign-in by IP address, set session length, connect SSO and SCIM so leavers lose access, and get a quarterly access review prompt.

## 4. Training (164.308(a)(5))

- Every workforce member completes HIPAA privacy and security training before accessing PHI and yearly after. Completion is recorded.
- Training covers: what PHI is, minimum necessary, phishing, password and device security, how to report an incident.

## 5. Security incident procedures (164.308(a)(6))

- Anyone who suspects an incident reports it immediately to the Security Official at [contact].
- The Security Official logs it, contains it, investigates, and decides whether it is a breach (section 9).
- `docs/07-operations.md` covers the technical response; this policy covers the decisions and notifications.

## 6. Contingency plan (164.308(a)(7))

- **Backups:** Neon point-in-time history, with the window set in the Neon project (see `docs/08-restore-drill.md`).
- **Restore testing:** quarterly drill, recorded.
- **Emergency mode:** if the platform is unavailable, practices continue to see patients; claims can wait. Practices can export their data at any time from Settings → Data export.

## 7. Business associates and subcontractors (164.308(b))

- A signed BAA is in place with every subcontractor that handles PHI before any PHI is sent to it. The list is kept in Exhibit A of `docs/legal/baa-template.md`.
- AI features send clinical text to Anthropic only after the practice records that a BAA is in place; otherwise only codes and de-identified text are sent. This is enforced in the product.

## 8. Technical safeguards (164.312)

| Requirement | How it is met today |
|---|---|
| Unique user identification | Individual accounts; no shared logins |
| Emergency access | Practice administrators; platform operators under section 3 |
| Automatic logoff | Session lifetime set per practice |
| Encryption | TLS in transit (HSTS); storage encrypted by Neon; integration secrets and second-factor secrets additionally encrypted by the application |
| Audit controls | Audit log of sign-ins, exports, adjustments, settings changes and more, viewable by practice administrators |
| Integrity | Ledger entries are added, never edited; corrections post new entries |
| Person or entity authentication | Passwords (bcrypt), second factor, SSO; account lockout and attempt limits |
| Transmission security | TLS for every connection, including clearinghouse, payment and messaging providers |

## 9. Breach notification (164.400–414)

1. **Discovery.** A breach is treated as discovered on the first day it is known, or would have been known with reasonable diligence, to any workforce member.
2. **Assessment.** The Privacy Official assesses, and documents, whether there is a low probability that PHI was compromised, considering the four factors in 164.402: the nature and extent of the PHI, who received it, whether it was actually acquired or viewed, and how far the risk has been mitigated. Without that documented low probability, it is a breach.
3. **Notify the practice.** As a business associate, CollaboratMD notifies each affected practice (the covered entity) without unreasonable delay and no later than 60 calendar days after discovery, or sooner if the practice's BAA says so. Include who was affected and what happened, as far as known.
4. The practice is responsible for notifying individuals, HHS and, where required, the media, unless the BAA assigns these to CollaboratMD. Individual notice is due no later than 60 days after discovery. Breaches affecting 500 or more people are reported to HHS at the same time, and to prominent media outlets for any state with more than 500 affected residents. Smaller breaches are logged and reported to HHS within 60 days of the end of the calendar year.
5. **State law** may require faster notice or notice to state regulators. Counsel keeps a list of the states where practices operate.
6. Keep all breach documentation for 6 years.

## 10. Devices and workstations (164.310)

- Laptops used for work have full-disk encryption, a screen lock of 5 minutes or less, current OS updates, and no PHI saved locally except temporarily during a support task, deleted after.
- Exports containing PHI (for example, a practice data export used in a restore drill) are deleted when the task ends.
- No PHI in email, chat or tickets. Refer to records by ID.

## 11. Documentation and retention (164.316)

Policies, risk analyses, training records, incident logs and BAAs are kept for at least 6 years from when they were created or last in effect, whichever is later.

## 12. Sanctions (164.308(a)(1)(ii)(C))

Violations of these policies lead to action up to and including termination, applied consistently and documented.
