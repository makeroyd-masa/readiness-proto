/**
 * Next-step selector (PRD HR-I-06, §11 Stage 6, Appendix B).
 * Picks the top 3 from a candidate library, ranked by gaps x worry x vulnerability x geo.
 *
 * NOTE (PRD Appendix B): "Understand your emergency-transport coverage" appears here
 * only as an OPTIONAL step that routes to the coverage module. It is never scored and
 * never auto-ranked to the top by a manufactured gap (that was the v1 upsell smell).
 */

import { hasInventory, type Profile } from './profile';

export interface CandidateStep {
  id: string;
  title: string;
  desc: string;
  evidenceId?: string; // cited Ready.gov block (Mayo-ready slot)
  seam?: 'coverage'; // optional route to the coverage education module
  /** score contribution; higher = more relevant. Returns -Infinity to exclude. */
  rank: (p: Profile) => number;
}

const V = (p: Profile) => p.tier1.vulnerability != null && p.tier1.vulnerability !== 'none';

const LIBRARY: CandidateStep[] = [
  {
    id: 'emergency_card',
    title: 'Create an emergency medical card',
    desc: 'A single card with medications, allergies, conditions, and contacts that a first responder or family member can find fast.',
    evidenceId: 'ready_medical_info',
    rank: (p) => {
      const mn = p.tier1.medicalNeeds;
      // Retired once documented (list exists / card built / nothing to note).
      if (hasInventory(p, 'meds_record') || mn === 'none' || mn === 'documented' || p.tier2.medications || p.tier2.allergiesConditions) {
        return -Infinity;
      }
      return 3 + (mn === 'undocumented' ? 3 : 0) + (V(p) ? 2 : 0) + (p.tier1.topWorry === 'info' ? 2 : 0);
    },
  },
  {
    id: 'decision_maker',
    title: 'Name who can make medical decisions',
    desc: 'Decide — and document — who can speak for each adult if they cannot speak for themselves. "I\'m not sure" is a valid answer and creates this step.',
    evidenceId: 'ready_documents',
    rank: (p) => {
      if (hasInventory(p, 'decision_maker') || p.tier2.decisionMakerStatus === 'yes' || p.tier2.decisionMakerName) return -Infinity;
      const needed = V(p) || p.tier1.householdType !== 'solo';
      return needed ? 3 + (V(p) ? 2 : 0) : 0.5;
    },
  },
  {
    id: 'contact_tree',
    title: 'Build a shared emergency contact tree',
    desc: 'One list everyone can reach — who to call first, second, and who reaches whom.',
    evidenceId: 'ready_plan',
    rank: (p) => (hasInventory(p, 'contacts') || p.tier2.contacts.length > 0 ? -Infinity : 2.5 + (p.tier1.topWorry === 'chaos' ? 2 : 0)),
  },
  {
    id: 'go_bag',
    title: 'Build a medication + evacuation go-bag',
    desc: 'Keep several days of medications and copies of key documents ready to grab.',
    evidenceId: 'ready_kit',
    rank: (p) => {
      if (hasInventory(p, 'go_bag')) return -Infinity;
      const geo = p.tier1.geoRisk;
      return 2 + (geo === 'disaster' ? 3 : geo === 'rural' ? 1.5 : 0);
    },
  },
  {
    id: 'remote_access',
    title: "Set up remote access to a parent's care",
    desc: 'Line up the authorizations you would need to talk to a hospital and coordinate care on a loved one\'s behalf — before a crisis, not during one.',
    evidenceId: 'ready_documents',
    rank: (p) => {
      const remote = p.tier1.householdType === 'caregiver' && p.tier1.role === 'caregiver_remote';
      const caregiver = p.tier1.householdType === 'caregiver';
      return remote ? 4 : caregiver ? 2.5 : -Infinity;
    },
  },
  {
    id: 'written_plan',
    title: 'Turn this into a written household plan',
    desc: 'Put roles, contacts, and steps in one place everyone can find. SAM builds this for you as your Readiness File.',
    evidenceId: 'ready_plan',
    rank: (p) => (hasInventory(p, 'written_plan') ? -Infinity : 1.5 + (p.tier1.topWorry === 'chaos' ? 1 : 0)),
  },
  {
    id: 'med_supply',
    title: 'Confirm several days of medication supply',
    desc: 'Make sure anyone on daily medication has enough on hand to get through a disruption.',
    rank: (p) => (V(p) ? 1.8 + (p.tier1.geoRisk === 'rural' ? 1 : 0) : -Infinity),
  },
  {
    id: 'nearest_hospital',
    title: 'Identify the nearest appropriate hospital',
    desc: 'Know where to go — and how you would get there — for the kind of care your household is most likely to need.',
    rank: (p) => (p.tier1.geoRisk === 'rural' || p.tier1.topWorry === 'distance' ? 2.2 : 0.3),
  },
  {
    id: 'coverage_optional',
    title: 'Understand your emergency-transport coverage',
    desc: 'Optional: see the questions to ask about ambulance and air-transport coverage, and where gaps commonly hide.',
    seam: 'coverage',
    // Modest, fixed relevance when cost is the worry. Never a top-forced gap.
    rank: (p) => (p.tier1.topWorry === 'cost' ? 1.6 : 0.4),
  },
];

export interface RankedStep extends CandidateStep {
  score: number;
}

export function nextSteps(p: Profile, limit = 3): RankedStep[] {
  return LIBRARY.map((s) => ({ ...s, score: s.rank(p) }))
    .filter((s) => s.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
