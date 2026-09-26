import { buildEdi837P, type ClaimAttachmentRef, type OtherPayer } from "@/lib/edi/x837p";
import { buildEdi837I } from "@/lib/edi/x837i";
import { buildEdi837D } from "@/lib/edi/x837d";
import type { ClaimBundle } from "./claims";

/** The 837 (P, I or D, by claim type) for a claim, without sending it. */
export function buildClaimEdi(
  bundle: ClaimBundle,
  o: { now: Date; authorizationNumber: string | null; attachments: ClaimAttachmentRef[]; otherPayer?: OtherPayer },
): string {
  const { now, authorizationNumber, attachments, otherPayer } = o;
  const dental = bundle.claim.claimType === "dental";
  const institutional = bundle.claim.claimType === "institutional";
  return dental ? buildEdi837D({
    controlNumber: bundle.claim.controlNumber,
    interchangeControl: String(Math.floor(now.getTime() / 1000) % 1_000_000_000),
    senderId: "COLLABORATMD",
    receiverId: bundle.payer.payerId,
    now,
    billingProvider: { name: bundle.practice.name, npi: bundle.practice.npi, taxId: bundle.practice.taxId, address1: bundle.practice.address1, city: bundle.practice.city, state: bundle.practice.state, zip: bundle.practice.zip, taxonomy: bundle.provider.taxonomy },
    rendering: { lastName: bundle.provider.lastName, firstName: bundle.provider.firstName, npi: bundle.provider.npi, taxonomy: bundle.provider.taxonomy },
    payer: { name: bundle.payer.name, payerId: bundle.payer.payerId, type: bundle.payer.type },
    subscriber: { lastName: bundle.patient.lastName, firstName: bundle.patient.firstName, memberId: bundle.insurance.memberId, groupNumber: bundle.insurance.groupNumber, dob: bundle.patient.dob, sex: bundle.patient.sex, address1: bundle.patient.address1, city: bundle.patient.city, state: bundle.patient.state, zip: bundle.patient.zip, relationship: bundle.insurance.relationship },
    claim: {
      totalCents: bundle.claim.totalCents, placeOfService: bundle.encounter.placeOfService, frequencyCode: bundle.claim.frequencyCode,
      originalPayerClaimNumber: bundle.claim.originalPayerClaimNumber, authorizationNumber, diagnoses: bundle.encounter.diagnoses, attachments,
    },
    lines: bundle.lines.map((l) => ({ cdt: l.cpt, chargeCents: l.chargeCents * l.units, units: l.units, dateOfService: bundle.encounter.dateOfService, tooth: l.tooth, surfaces: l.surfaces, oralCavity: l.oralCavity })),
    otherPayer,
  }) : institutional ? buildEdi837I({
    controlNumber: bundle.claim.controlNumber,
    interchangeControl: String(Math.floor(now.getTime() / 1000) % 1_000_000_000),
    senderId: "COLLABORATMD",
    receiverId: bundle.payer.payerId,
    now,
    billingProvider: { name: bundle.practice.name, npi: bundle.practice.npi, taxId: bundle.practice.taxId, address1: bundle.practice.address1, city: bundle.practice.city, state: bundle.practice.state, zip: bundle.practice.zip },
    attending: { lastName: bundle.provider.lastName, firstName: bundle.provider.firstName, npi: bundle.provider.npi, taxonomy: bundle.provider.taxonomy },
    payer: { name: bundle.payer.name, payerId: bundle.payer.payerId, type: bundle.payer.type },
    subscriber: { lastName: bundle.patient.lastName, firstName: bundle.patient.firstName, memberId: bundle.insurance.memberId, groupNumber: bundle.insurance.groupNumber, dob: bundle.patient.dob, sex: bundle.patient.sex, address1: bundle.patient.address1, city: bundle.patient.city, state: bundle.patient.state, zip: bundle.patient.zip, relationship: bundle.insurance.relationship },
    claim: {
      totalCents: bundle.claim.totalCents, frequencyCode: bundle.claim.frequencyCode, originalPayerClaimNumber: bundle.claim.originalPayerClaimNumber,
      authorizationNumber, diagnoses: bundle.encounter.diagnoses, institutional: bundle.claim.institutional!, attachments,
    },
    lines: bundle.lines.map((l) => ({ revenueCode: l.revenueCode ?? "", hcpcs: l.cpt || null, modifiers: l.modifiers, chargeCents: l.chargeCents * l.units, units: l.units, dateOfService: bundle.encounter.dateOfService })),
    otherPayer,
  }) : buildEdi837P({
    controlNumber: bundle.claim.controlNumber,
    interchangeControl: String(Math.floor(now.getTime() / 1000) % 1_000_000_000),
    senderId: "COLLABORATMD",
    receiverId: bundle.payer.payerId,
    now,
    billingProvider: { name: bundle.practice.name, npi: bundle.practice.npi, taxId: bundle.practice.taxId, address1: bundle.practice.address1, city: bundle.practice.city, state: bundle.practice.state, zip: bundle.practice.zip },
    renderingProvider: { lastName: bundle.provider.lastName, firstName: bundle.provider.firstName, npi: bundle.provider.npi, taxonomy: bundle.provider.taxonomy },
    payer: { name: bundle.payer.name, payerId: bundle.payer.payerId },
    subscriber: { lastName: bundle.patient.lastName, firstName: bundle.patient.firstName, memberId: bundle.insurance.memberId, groupNumber: bundle.insurance.groupNumber, dob: bundle.patient.dob, sex: bundle.patient.sex, address1: bundle.patient.address1, city: bundle.patient.city, state: bundle.patient.state, zip: bundle.patient.zip, relationship: bundle.insurance.relationship },
    claim: {
      totalCents: bundle.claim.totalCents, placeOfService: bundle.encounter.placeOfService, frequencyCode: bundle.claim.frequencyCode,
      originalPayerClaimNumber: bundle.claim.originalPayerClaimNumber, authorizationNumber,
      dateOfService: bundle.encounter.dateOfService, diagnoses: bundle.encounter.diagnoses, attachments,
    },
    lines: bundle.lines.map((l) => ({ cpt: l.cpt, modifiers: l.modifiers, chargeCents: l.chargeCents * l.units, units: l.units, dxPointers: l.dxPointers, dateOfService: bundle.encounter.dateOfService })),
    otherPayer,
  });
}
