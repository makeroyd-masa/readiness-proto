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
  seam?: 'coverage' | 'financial'; // optional route to an education module (product only after the artifact)
  /** score contribution; higher = more relevant. Returns -Infinity to exclude. */
  rank: (p: Profile) => number;
}

const V = (p: Profile) => p.tier1.vulnerability != null && p.tier1.vulnerability !== 'none';

export const LIBRARY: CandidateStep[] = [
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
    desc: 'Decide who can speak for each adult if they cannot speak for themselves — and make sure the household agrees on who it is.',
    evidenceId: 'ready_documents',
    rank: (p) => {
      const dm = p.tier1.decisionMaker;
      const named = dm === 'documented' || dm === 'informal' || p.tier2.decisionMakerStatus === 'yes' || Boolean(p.tier2.decisionMakerName);
      if (named) return -Infinity; // someone is named → depth handled by legal_paperwork
      const needed = V(p) || p.tier1.householdType !== 'solo';
      return needed ? 3 + (V(p) ? 2 : 0) : 0.8;
    },
  },
  {
    id: 'legal_paperwork',
    title: 'Complete a healthcare proxy and HIPAA release',
    desc: 'Put the paperwork in place so the person you trust can actually speak to doctors and act for you in a crisis.',
    evidenceId: 'ready_documents',
    rank: (p) => {
      const dm = p.tier1.decisionMaker;
      const named = dm === 'documented' || dm === 'informal' || Boolean(p.tier2.decisionMakerName);
      const auth = p.tier1.decisionAuthority;
      if (!named || auth === 'documented') return -Infinity; // relevant once someone is named and paperwork isn't done
      return 3 + (auth === 'partial' ? 0 : 1) + (V(p) ? 2 : 0);
    },
  },
  {
    id: 'contact_tree',
    title: 'Build a shared emergency contact tree',
    desc: 'One list everyone can reach — who to call first, second, and who reaches whom.',
    evidenceId: 'ready_plan',
    rank: (p) => {
      if (p.tier1.contactsReadiness === 'documented' || p.tier2.contacts.length > 0) return -Infinity;
      const gap = p.tier1.contactsReadiness === 'none' ? 1 : 0;
      return 2.5 + gap + (p.tier1.topWorry === 'chaos' ? 2 : 0);
    },
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
      const aging = p.tier1.agingParent === 'yes';
      const remote = aging && p.tier1.role === 'caregiver_remote';
      return remote ? 4 : aging ? 2.5 : -Infinity;
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
    id: 'financial_cushion',
    title: "Understand your household's financial cushion",
    desc: 'See how long your household could keep up with bills if a health event kept an earner out of work — and simple ways to extend that runway.',
    seam: 'financial',
    rank: (p) => {
      const r = p.tier1.financialRunway;
      if (r === 'ample') return -Infinity;
      return r === 'little' || r === 'unsure' ? 2.4 : r === 'some' ? 1.6 : 0.6;
    },
  },
  {
    id: 'ltc_conversation',
    title: 'Have the long-term-care conversation',
    desc: "Talk through where care would happen, who would help, and how you'd handle it — then write down what you decide. SAM gives you a simple guide to start.",
    rank: (p) => {
      const applies = p.tier1.agingParent === 'yes' || p.tier1.householdType === 'multigen';
      if (!applies) return -Infinity;
      const c = p.tier1.ltcConversation;
      if (c === 'documented') return -Infinity;
      return c === 'none' ? 2.6 : 1.6;
    },
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
