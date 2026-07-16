/**
 * Coverage as an OPTIONAL education module (PRD §9), decoupled from the score.
 *
 *  - Prospect variant: lead with QUESTIONS TO ASK, not a gap. The MASA offer appears
 *    only after the user has the artifact and has engaged the questions.
 *  - Member variant: REFERENCE the benefit they already hold (retention/activation),
 *    not a manufactured gap.
 *  - The v1 line "the one gap on your list I can actually close for you today" is
 *    RETIRED (§9.3).
 *
 * Cost/coverage grounding here is the four pre-approved static stats (Appendix C).
 * Real per-state grounding from the medical-billing-data layer (pilot.db: ambulance
 * fee schedule + parsed SBCs) is out of scope for this prototype; see
 * `PROTOTYPE_NOTES.md`. The COVERAGE_DATA_SOURCE indirection marks where it attaches.
 */

export type CoverageDataSource = 'static_stats' | 'pilot_db';
export const COVERAGE_DATA_SOURCE: CoverageDataSource = 'static_stats';

/** Appendix C — pre-approved MASA statistics. Use only in the coverage module, always cited. */
export const MASA_STATS = {
  groundAmbulance: '$2,000',
  airAmbulance: '$69,000',
  oopProbability: '79%',
  citation: 'Consumer Reports (2021); MASA claims data.',
  membersServed: '2 million+',
  yearsInBusiness: '50+ years (founded 1974)',
} as const;

/** Questions to ask — the education-first spine of the prospect variant (PRD §9.1). */
export const COVERAGE_QUESTIONS: string[] = [
  'What ground ambulance transport is covered, and up to what amount?',
  'What air/medical-flight transport is covered?',
  'Are there network limits on which ambulance provider I can use?',
  'Who decides whether transport was "medically necessary"?',
  'What out-of-pocket cost could remain after my plan pays?',
];

export interface CoverageCopy {
  heading: string;
  intro: string;
  /** shown only for prospects, after questions engaged. */
  offer?: string;
  offerCta?: string;
}

export function coverageCopy(memberStatus: string): CoverageCopy {
  if (memberStatus === 'member') {
    // Member variant — reference, not reveal (PRD §9.2).
    return {
      heading: 'How your MASA coverage applies',
      intro:
        'Because you are a MASA member, approved emergency ground and air transport is already covered — no deductibles or network limits to sort out in the moment. Here is what a family should still plan for beyond transport, and the questions worth confirming about the rest of your plan.',
    };
  }
  // Prospect variant — education first, reveal second (PRD §9.1).
  return {
    heading: 'Understanding your emergency-transport exposure',
    intro:
      'Emergency transport is where surprise bills most often hide — even with health insurance. Before anyone quotes you anything, here are the questions worth asking about your own coverage.',
    offer: 'MASA members may have support here. Want SAM to show how this works?',
    offerCta: 'Show me how MASA coverage works',
  };
}
