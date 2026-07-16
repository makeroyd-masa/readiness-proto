/**
 * The evidence layer (PRD HR-I-10, §3).
 *
 * v1 showed FAKE "Mayo Clinic: ..." strings. Here the evidence is the REAL
 * Ready.gov / FEMA corpus (health-data repo: 62 household_readiness blocks), each
 * cited at point-of-need with publisher + source_url. Mayo is a future drop-in
 * behind this same interface (Appendix D: Mayo not yet ingested).
 *
 * LICENSING (internal-only prototype): FEMA reprint terms say content "will not be
 * altered in any way" and MASA legal has NOT signed off. We therefore surface a
 * short pointer + citation and link to the unaltered source rather than reproducing
 * full block bodies. External release is gated on legal clearance.
 */

export interface EvidenceBlock {
  id: string;
  title: string;
  /** brief point-of-need pointer, NOT a reproduction of the source publication. */
  pointer: string;
  publisher: string;
  sourceUrl: string;
  attribution: string;
}

const READY_GOV_ATTRIBUTION =
  'Content from Ready.gov (U.S. Federal Emergency Management Agency). Not an endorsement by FEMA or the U.S. Government.';

export const EVIDENCE: Record<string, EvidenceBlock> = {
  ready_kit: {
    id: 'ready_kit',
    title: 'Build a kit',
    pointer: 'Keep several days of medications, water, and copies of key documents ready to grab.',
    publisher: 'Ready.gov (FEMA)',
    sourceUrl: 'https://www.ready.gov/kit',
    attribution: READY_GOV_ATTRIBUTION,
  },
  ready_plan: {
    id: 'ready_plan',
    title: 'Make a plan',
    pointer: 'Agree in advance on how your household will contact one another and where you will meet.',
    publisher: 'Ready.gov (FEMA)',
    sourceUrl: 'https://www.ready.gov/plan',
    attribution: READY_GOV_ATTRIBUTION,
  },
  ready_documents: {
    id: 'ready_documents',
    title: 'Safeguard critical documents',
    pointer: 'Keep insurance, identification, and medical/decision-making documents where the household can find them.',
    publisher: 'Ready.gov (FEMA)',
    sourceUrl: 'https://www.ready.gov/financial-preparedness',
    attribution: READY_GOV_ATTRIBUTION,
  },
  ready_medical_info: {
    id: 'ready_medical_info',
    title: 'Medications & medical information',
    pointer: 'Organize prescriptions, medical supplies, and a current medication list as part of your emergency kit.',
    publisher: 'Ready.gov (FEMA)',
    sourceUrl: 'https://www.ready.gov/kit',
    attribution: READY_GOV_ATTRIBUTION,
  },
};

export function getEvidence(id: string | undefined): EvidenceBlock | null {
  if (!id) return null;
  return EVIDENCE[id] ?? null;
}
