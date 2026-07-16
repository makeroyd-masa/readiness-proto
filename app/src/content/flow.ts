/**
 * The Household Readiness flow, authored as DATA (PRD §11, §19.3).
 * Built entirely from the 8 node types. The engine walks it; this file has no logic
 * beyond routing predicates, and every predicate/option value is a member of a
 * value-set in domain/valueSets.ts (dead-branch fix, §18).
 */

import type { Flow } from '../domain/nodes';

export const householdReadinessFlow: Flow = {
  id: 'household_readiness',
  title: 'Household Readiness Check',
  startId: 'welcome',
  nodes: {
    // Stage 0 — Open
    welcome: {
      id: 'welcome',
      type: 'content',
      say: "Let's find out how ready your household is if a medical emergency hit today — it takes about 5 minutes, and you'll leave with a plan you can actually use.\n\nFirst: who's in your household?",
      next: 'q_household',
    },

    // Stage 1 — Household framing
    q_household: {
      id: 'q_household',
      type: 'question',
      field: 'householdType',
      say: "Who's in your household?",
      options: [
        { value: 'solo', label: 'Just me' },
        { value: 'couple', label: 'Me and my partner or spouse' },
        { value: 'kids', label: 'A family with kids at home' },
        { value: 'multigen', label: 'Multi-generational — kids and an older parent' },
        { value: 'caregiver', label: 'I help care for an aging parent' },
      ],
      next: 'd_caregiver',
    },
    d_caregiver: {
      id: 'd_caregiver',
      type: 'decision',
      // Real branch on a real value — caregiver unlocks the role question.
      route: (p) => (p.tier1.householdType === 'caregiver' ? 'q_role' : 'q_vulnerability'),
    },
    q_role: {
      id: 'q_role',
      type: 'question',
      field: 'role',
      when: (p) => p.tier1.householdType === 'caregiver',
      say: 'Are you nearby, or coordinating from a distance?',
      options: [
        { value: 'caregiver_nearby', label: "I'm nearby — same town or a short drive" },
        { value: 'caregiver_remote', label: "I'm at a distance — different city or state" },
      ],
      next: 'q_vulnerability',
    },
    q_vulnerability: {
      id: 'q_vulnerability',
      type: 'question',
      field: 'vulnerability',
      say: 'In an emergency, would anyone in your household have trouble speaking or advocating for themselves?',
      options: [
        { value: 'none', label: "No — everyone can speak for themselves" },
        { value: 'cannot_advocate', label: 'Yes — someone might not be able to advocate for themselves' },
        { value: 'young_kids', label: "Yes — young kids who couldn't advocate for themselves" },
      ],
      next: 'q_geo',
    },

    // Stage 2 — Context & environmental risk
    q_geo: {
      id: 'q_geo',
      type: 'question',
      field: 'geoRisk',
      say: 'Where you live changes what "ready" looks like. Does any of this apply?',
      options: [
        { value: 'disaster', label: "We're in a hurricane, flood, or wildfire-prone area" },
        { value: 'rural', label: "We're rural or far from a major hospital" },
        { value: 'travel', label: 'We travel often or split time between two homes' },
        { value: 'none', label: 'None of these really apply' },
      ],
      next: 'd_travel',
    },
    d_travel: {
      id: 'd_travel',
      type: 'decision',
      // Real branch on a real value — travel seams toward Travel Readiness.
      route: (p) => (p.tier1.geoRisk === 'travel' ? 'seam_travel' : 'q_inventory'),
    },
    seam_travel: {
      id: 'seam_travel',
      type: 'seam',
      seam: 'cross_flow',
      when: (p) => p.tier1.geoRisk === 'travel',
      next: 'q_inventory',
    },

    // Stage 3 — Current-state inventory (drives the score; no coverage item, §18)
    q_inventory: {
      id: 'q_inventory',
      type: 'question',
      field: 'inventory',
      multi: true,
      say: 'Which of these does your household already have in place? Pick any that apply — this is what sets your readiness score.',
      options: [
        { value: 'meds_record', label: "A current list of everyone's meds, allergies, and conditions" },
        { value: 'contacts', label: 'An emergency contact list everyone can find' },
        { value: 'decision_maker', label: "Someone able to make medical decisions if you can't" },
        { value: 'go_bag', label: 'A go-bag or several days of medication supply' },
        { value: 'written_plan', label: 'A written household plan everyone can find' },
        { value: 'none', label: 'Honestly… none of these yet', exclusive: true },
      ],
      next: 'q_worry',
    },

    // Stage 4 — Worry / prioritization
    q_worry: {
      id: 'q_worry',
      type: 'question',
      field: 'topWorry',
      say: 'Last one. When you picture an emergency, what worries you most?',
      options: [
        { value: 'info', label: "No one would have the right info if someone couldn't speak" },
        { value: 'chaos', label: "We'd panic or get separated and not know what to do" },
        { value: 'cost', label: 'The cost — ambulance, hospital, transport' },
        { value: 'distance', label: 'Being far from the right care when it happens' },
        { value: 'not_sure', label: "Not sure — that's kind of why I'm here" },
      ],
      next: 'c_score',
    },

    // Stage 5 — Compute & reveal
    c_score: { id: 'c_score', type: 'compute', next: 'reveal' },
    reveal: {
      id: 'reveal',
      type: 'content',
      // The UI recognizes 'reveal' as the transition into the Result view.
      say: "Here's where your household stands.",
    },
  },
};
