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
      say: "Let's build a readiness plan for your household — about 5 minutes, and you'll leave with something you can actually use.\n\nFirst, who are you building this plan for?",
      next: 'q_household',
    },

    // ========================================================================
    // TIER P — publicly shareable. Safe for the shared seminar screen (§5.2, §13):
    // composition, aging-parent responsibility, the two highest-stakes scenarios,
    // environment, inventory, worry, and the long-term-care conversation.
    // ========================================================================

    // Stage 1 — Household framing
    q_household: {
      id: 'q_household',
      type: 'question',
      field: 'householdType',
      say: 'Who are you building this plan for?',
      options: [
        { value: 'solo', label: 'Just me' },
        { value: 'couple', label: 'Me and my partner or spouse' },
        { value: 'kids', label: 'A family with kids at home' },
        { value: 'multigen', label: 'Multiple generations under one roof' },
      ],
      next: 'q_agingparent',
    },
    // v3 (HR-V3-03): aging-parent responsibility, decoupled from household type.
    q_agingparent: {
      id: 'q_agingparent',
      type: 'question',
      field: 'agingParent',
      say: 'Do you have parents or older loved ones whose care may fall to you?',
      options: [
        { value: 'yes', label: 'Yes — I help now or expect to' },
        { value: 'no', label: 'No, not right now' },
      ],
      next: 'q_role',
    },
    q_role: {
      id: 'q_role',
      type: 'question',
      field: 'role',
      when: (p) => p.tier1.agingParent === 'yes',
      say: 'Are you nearby, or coordinating from a distance?',
      options: [
        { value: 'caregiver_nearby', label: "I'm nearby — same town or a short drive" },
        { value: 'caregiver_remote', label: "I'm at a distance — different city or state" },
      ],
      next: 'q_contacts',
    },

    // Stage 2 — Highest-stakes scenarios, promoted from the inventory checklist (Q2/Q3).
    q_contacts: {
      id: 'q_contacts',
      type: 'question',
      field: 'contactsReadiness',
      say: 'If someone had a medical emergency tonight, does everyone know who to call first?',
      options: [
        { value: 'documented', label: "Yes — the key numbers are written where everyone can find them" },
        { value: 'informal', label: 'Sort of — people know, but nothing is written down' },
        { value: 'none', label: 'Not really' },
      ],
      next: 'q_takecharge',
    },
    q_takecharge: {
      id: 'q_takecharge',
      type: 'question',
      field: 'decisionMaker',
      say: "If you couldn't speak for yourself, is there one person who could take charge?",
      options: [
        { value: 'documented', label: "Yes — we've clearly agreed who" },
        { value: 'informal', label: "Probably, but we've never made it official" },
        { value: 'none', label: 'No one clearly' },
      ],
      next: 'q_geo',
    },

    // Stage 3 — Context & environmental risk
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

    // Stage 4 — Current-state inventory (fast multi-select; contacts + decision-maker
    // are now their own scenario questions, so they're removed here).
    q_inventory: {
      id: 'q_inventory',
      type: 'question',
      field: 'inventory',
      multi: true,
      say: 'Which of these does your household already have in place? Pick any that apply.',
      options: [
        { value: 'meds_record', label: "A current list of everyone's meds, allergies, and conditions" },
        { value: 'go_bag', label: 'A go-bag or several days of medication supply' },
        { value: 'written_plan', label: 'A written household plan everyone can find' },
        { value: 'none', label: 'Honestly… none of these yet', exclusive: true },
      ],
      next: 'q_worry',
    },

    // Stage 5 — Worry / prioritization
    q_worry: {
      id: 'q_worry',
      type: 'question',
      field: 'topWorry',
      say: 'When you picture an emergency, what worries you most?',
      options: [
        { value: 'info', label: "No one would have the right info if someone couldn't speak" },
        { value: 'chaos', label: "We'd panic or get separated and not know what to do" },
        { value: 'cost', label: 'The cost — ambulance, hospital, transport' },
        { value: 'distance', label: 'Being far from the right care when it happens' },
        { value: 'not_sure', label: "Not sure — that's kind of why I'm here" },
      ],
      next: 'q_ltc',
    },

    // v3 (HR-V3-05): long-term-care conversation — Tier P, but only for households
    // where it applies (aging-parent responsibility or multi-generational).
    q_ltc: {
      id: 'q_ltc',
      type: 'question',
      field: 'ltcConversation',
      when: (p) => p.tier1.agingParent === 'yes' || p.tier1.householdType === 'multigen',
      say: 'Has your family talked about long-term care — where, who would help, and how it would be handled?',
      options: [
        { value: 'documented', label: "Yes — we've talked it through and written down the plan" },
        { value: 'informal', label: "We've talked about it, but nothing's written down" },
        { value: 'none', label: 'Not yet' },
      ],
      next: 'half_break',
    },

    // ========================================================================
    // THE BREAK — end of the shareable (Tier P) half. In the seminar the shared
    // screen stops here (reveal + finish-at-home). In the standard app it's a
    // one-line transition and the flow continues end-to-end.
    // ========================================================================
    half_break: {
      id: 'half_break',
      type: 'content',
      say: "That covers the shareable basics. The rest is more personal — who can legally act for you, health details, and your household's financial cushion — so it's just for your private file.",
      next: 'q_authority',
    },

    // ========================================================================
    // TIER P (home half) + TIER M + TIER F — completed at home. Tiers M and F are
    // never shown on the shared seminar screen (§5.2, §13, NF-09).
    // ========================================================================

    // v3 (HR-V3-06): legal-authority depth — only when a decision-maker exists.
    q_authority: {
      id: 'q_authority',
      type: 'question',
      field: 'decisionAuthority',
      when: (p) => p.tier1.decisionMaker != null && p.tier1.decisionMaker !== 'none',
      say: 'Does that person have the legal paperwork to act for you — a healthcare proxy and a HIPAA release?',
      options: [
        { value: 'documented', label: 'Yes — the paperwork is signed' },
        { value: 'partial', label: "We've started, but it's not finished" },
        { value: 'none', label: 'No paperwork yet' },
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
      next: 'q_medications',
    },
    q_medications: {
      id: 'q_medications',
      type: 'question',
      field: 'medicalNeeds',
      say: 'The part that matters most to a first responder: medications, allergies, and conditions. Does anyone in your household have any they should know about?',
      options: [
        { value: 'none', label: 'No daily meds, allergies, or conditions to note' },
        { value: 'documented', label: 'Yes — and we keep a current written list' },
        { value: 'undocumented', label: "Yes — but it's not written down anywhere yet" },
      ],
      next: 'q_financial',
    },
    // v3 (HR-V3-05): financial runway — Tier F, home only, never on the shared screen.
    q_financial: {
      id: 'q_financial',
      type: 'question',
      field: 'financialRunway',
      say: 'If a health event kept a wage-earner out of work for three months, how long could your household cover its bills?',
      options: [
        { value: 'ample', label: 'Six months or more' },
        { value: 'some', label: 'One to three months' },
        { value: 'little', label: 'Less than a month' },
        { value: 'unsure', label: "I'm not sure" },
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
