# Business Associate Agreement (draft template)

> **Draft, not legal advice.** The engineering team wrote this as a starting point for healthcare counsel, organized around the elements HIPAA requires in a business associate contract (45 CFR 164.504(e) and 164.314(a)). It has **not** been reviewed by a lawyer. Do not sign or send it until counsel licensed in the relevant states has reviewed it, filled the bracketed items and adapted it to state law (for example, stricter state breach-notice deadlines). HHS publishes sample business associate provisions that counsel may also want to compare against.

---

This Business Associate Agreement ("Agreement") is entered into as of [EFFECTIVE DATE] between **[PRACTICE LEGAL NAME]** ("Covered Entity") and **CollaboratMD** [legal entity name and state of organization to be confirmed], 10377 S Jordan Gateway #110, South Jordan, UT 84095 ("Business Associate").

## 1. Definitions

Terms used but not defined here (including Breach, Designated Record Set, Protected Health Information ("PHI"), Electronic PHI, Required by Law, Secretary, Security Incident, Subcontractor and Unsecured PHI) have the meanings given in 45 CFR Parts 160 and 164 ("HIPAA Rules"). PHI here means PHI that Business Associate creates, receives, maintains or transmits for Covered Entity.

## 2. Permitted uses and disclosures

2.1 Business Associate may use and disclose PHI only to provide the services described in the [Terms of Service / Master Services Agreement dated ___] (the "Services"): medical billing and revenue cycle software, including claim preparation and submission, remittance posting, eligibility checks, patient statements, payments and messaging, and reporting, or as Required by Law.

2.2 Business Associate may use PHI for its proper management and administration or to carry out its legal responsibilities, and may disclose PHI for those purposes if the disclosure is Required by Law, or if Business Associate obtains reasonable assurances from the recipient that it will keep the PHI confidential, use or further disclose it only as Required by Law or for the purpose of the disclosure, and notify Business Associate of any breach of confidentiality it becomes aware of.

2.3 Business Associate may de-identify PHI in accordance with 45 CFR 164.514(a)–(c). [Counsel: confirm whether de-identified data may be used for product improvement, and state it expressly either way.]

2.4 Business Associate will use, disclose and request only the minimum necessary PHI, consistent with Covered Entity's minimum necessary policies.

2.5 Business Associate will not use or disclose PHI in a way that would violate Subpart E of 45 CFR Part 164 if done by Covered Entity, and will not sell PHI or use it for marketing.

## 3. Business Associate obligations

3.1 **Safeguards.** Business Associate will use appropriate safeguards, and comply with Subpart C of 45 CFR Part 164 for Electronic PHI, to prevent use or disclosure other than as this Agreement provides.

3.2 **Reporting.** Business Associate will report to Covered Entity:
  (a) any use or disclosure of PHI not provided for by this Agreement, and any Security Incident, of which it becomes aware, within [__] business days; except that attempted but unsuccessful Security Incidents (such as pings, port scans, blocked sign-in attempts and denial-of-service attempts that do not result in unauthorized access) are reported by this paragraph in aggregate and need no further notice; and
  (b) any Breach of Unsecured PHI as required by 45 CFR 164.410, without unreasonable delay and in no case later than [__] calendar days after discovery, including, to the extent known, the individuals affected and the information Covered Entity needs for its own notifications.

3.3 **Subcontractors.** Business Associate will ensure, under 45 CFR 164.502(e)(1)(ii) and 164.308(b)(2), that any Subcontractor that creates, receives, maintains or transmits PHI on its behalf agrees in writing to the same restrictions and conditions. A current list of Subcontractors is at Exhibit A.

3.4 **Access.** Within [__] business days of a request from Covered Entity, Business Associate will make PHI in a Designated Record Set available to Covered Entity as needed for Covered Entity to meet 45 CFR 164.524, including in electronic form. (The Services let Covered Entity's administrators export all of its data at any time.)

3.5 **Amendment.** Business Associate will make amendments to PHI in a Designated Record Set that Covered Entity directs under 45 CFR 164.526, or otherwise enable Covered Entity to make them in the Services.

3.6 **Accounting of disclosures.** Business Associate will maintain and provide to Covered Entity, within [__] business days of a request, the information required for Covered Entity to respond to a request for an accounting of disclosures under 45 CFR 164.528.

3.7 **Covered Entity's obligations.** To the extent Business Associate carries out an obligation of Covered Entity under Subpart E of 45 CFR Part 164, it will comply with the requirements of Subpart E that apply to Covered Entity in performing that obligation.

3.8 **Books and records.** Business Associate will make its internal practices, books and records relating to PHI available to the Secretary for determining compliance with the HIPAA Rules.

## 4. Covered Entity obligations

4.1 Covered Entity will notify Business Associate of any limitation in its notice of privacy practices, any change in or revocation of an individual's permission, and any restriction it has agreed to under 45 CFR 164.522, to the extent it affects Business Associate's use or disclosure of PHI.

4.2 Covered Entity will not ask Business Associate to use or disclose PHI in a way that would not be permitted under the HIPAA Rules if done by Covered Entity.

4.3 Covered Entity is responsible for managing its users' access in the Services, including removing users who leave, and for the accuracy of the data it enters.

## 5. Term and termination

5.1 **Term.** This Agreement runs from the Effective Date until the Services end and all PHI is returned or destroyed under section 5.3.

5.2 **Termination for cause.** If either party determines that the other has violated a material term of this Agreement, it may give written notice and an opportunity to cure within [30] days, and may terminate this Agreement and the Services if the violation is not cured.

5.3 **Return or destruction.** On termination, Business Associate will make all PHI available to Covered Entity for export for [30] days, and then destroy it, including copies held by Subcontractors, within [__] days, except for backups that expire on their normal schedule [counsel: state the backup retention period]. Where return or destruction is infeasible, Business Associate will extend the protections of this Agreement to that PHI and limit further uses and disclosures to the purposes that make return or destruction infeasible, for as long as it keeps the PHI.

5.4 **Survival.** Section 5.3 survives termination.

## 6. Miscellaneous

6.1 **Amendment.** The parties will amend this Agreement as needed for compliance with changes to the HIPAA Rules.

6.2 **Interpretation.** Any ambiguity will be resolved to permit compliance with the HIPAA Rules.

6.3 **No third-party beneficiaries.** Nothing here gives any right to anyone other than the parties.

6.4 **Precedence.** If this Agreement conflicts with the Terms of Service regarding PHI, this Agreement governs.

6.5 [Counsel: indemnification, limitation of liability, insurance, governing law and notices.]

---

**Covered Entity**: [PRACTICE LEGAL NAME]
By: ______________________  Name: __________________  Title: __________________  Date: ________

**Business Associate**: CollaboratMD [legal entity]
By: ______________________  Name: __________________  Title: __________________  Date: ________

---

## Exhibit A: Subcontractors

Only the Subcontractors a practice actually uses will receive its PHI. Confirm each has a signed BAA with CollaboratMD before listing it here.

| Subcontractor | Service | PHI involved | Used when | BAA status |
|---|---|---|---|---|
| Vercel | Application hosting | All PHI in transit through the app | Always | [confirm] |
| Neon | Database hosting | All stored PHI | Always | [confirm] |
| Stedi | Clearinghouse (claims, eligibility, remittances, claim status) | Claim and eligibility data | Practice connects Stedi | [confirm] |
| Stripe | Card payments | Patient name, amount; card data is held by Stripe | Practice connects Stripe | [confirm; Stripe's position on BAAs must be checked] |
| Twilio | Text messages | Patient phone number and message text | Practice connects Twilio | [confirm] |
| Resend | Email | Patient email address and message text | Practice connects Resend | [confirm] |
| Anthropic | AI assistance (denial explanations, card reading, questions about data) | Only when the practice records a signed BAA; otherwise only codes and de-identified text | Practice turns on | [confirm] |
