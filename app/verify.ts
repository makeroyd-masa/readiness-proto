/* Headless verification of the core model against PRD §19.7 + Revision 3 checks.
   Run: npx tsx verify.ts  (from app/). Not part of the app bundle. */
import { assertFlowIntegrity } from './src/engine/guards';
import { householdReadinessFlow as flow } from './src/content/flow';
import { applyAnswer, firstNode, nextNode, resolve } from './src/engine/engine';
import { emptyProfile, type Profile } from './src/domain/profile';
import type { QuestionNode } from './src/domain/nodes';
import { scoreProfile } from './src/domain/scoring';
import { nextSteps, LIBRARY } from './src/domain/steps';
import { FIELD_TIER } from './src/domain/valueSets';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}`);
  cond ? pass++ : fail++;
};

/** A superset of every answer; routing decides which are actually consumed. */
const BASE: Record<string, string | string[]> = {
  q_household: 'couple',
  q_agingparent: 'no',
  q_role: 'caregiver_nearby',
  q_contacts: 'documented',
  q_takecharge: 'documented',
  q_geo: 'none',
  q_inventory: [],
  q_worry: 'not_sure',
  q_ltc: 'documented',
  q_authority: 'documented',
  q_vulnerability: 'none',
  q_medications: 'documented',
  q_financial: 'ample',
};
const A = (o: Record<string, string | string[]> = {}) => ({ ...BASE, ...o });

/** Drive the flow with a map of answers keyed by question node id. */
function run(answers: Record<string, string | string[]>): { profile: Profile; visited: string[] } {
  let p = emptyProfile('test', '2026-07-23T00:00:00Z');
  const visited: string[] = [];
  let node = firstNode(flow, p);
  for (let i = 0; i < 60 && node; i++) {
    visited.push(node.id);
    if (node.id === 'reveal') break;
    if (node.type === 'question') {
      const q = node as QuestionNode;
      const a = answers[q.id];
      if (a === undefined) throw new Error(`no answer for question ${q.id}`);
      p = applyAnswer(p, q.field, a);
    }
    node = nextNode(flow, node, p);
  }
  return { profile: p, visited };
}

console.log('\n1. Flow integrity (no dead branches, §18/§19.2)');
try {
  assertFlowIntegrity(flow);
  ok('assertFlowIntegrity passes', true);
} catch (e) {
  ok('assertFlowIntegrity passes — ' + (e as Error).message, false);
}

console.log('\n2. Score has NO coverage dimension and exactly 6 dimensions (§8, HR-V3-05)');
{
  const { profile } = run(A({ q_inventory: ['meds_record'], q_worry: 'cost' }));
  const dims = scoreProfile(profile).dimensions.map((d) => d.id);
  ok('no dimension id mentions coverage', !dims.some((d) => /coverage/i.test(d)));
  ok('exactly 6 family-controlled dimensions', dims.length === 6);
  ok('financial_resilience is present', dims.includes('financial_resilience'));
}

console.log('\n3. Every household type reaches the reveal with a distinct personalized 5th');
{
  const fifths = new Set<string>();
  for (const ht of ['solo', 'couple', 'kids', 'multigen']) {
    const { profile, visited } = run(A({ q_household: ht }));
    ok(`household "${ht}" reaches reveal`, visited.includes('reveal'));
    const fifth = scoreProfile(profile).dimensions.find((d) => d.id === 'personalized_fifth' || d.id === 'long_term_care');
    if (fifth) fifths.add(fifth.name);
  }
  ok('personalized 5th differs across household types', fifths.size >= 4);
}

console.log('\n4. Aging-parent flag drives LTC + remote coordination (HR-V3-03/05)');
{
  const remote = run(A({ q_agingparent: 'yes', q_role: 'caregiver_remote', q_ltc: 'none' }));
  const nearby = run(A({ q_agingparent: 'yes', q_role: 'caregiver_nearby', q_ltc: 'none' }));
  const noAging = run(A({ q_agingparent: 'no' }));
  const fifthId = (p: Profile) => scoreProfile(p).dimensions.find((d) => d.id === 'long_term_care' || d.id === 'personalized_fifth')?.id;
  ok('aging-parent household gets Long-term-care as the 5th', fifthId(remote.profile) === 'long_term_care');
  ok('non-aging household does NOT get LTC as the 5th', fifthId(noAging.profile) === 'personalized_fifth');
  ok('remote caregiver surfaces the remote-access step', nextSteps(remote.profile).some((s) => s.id === 'remote_access'));
  ok('q_role is skipped when there is no aging parent', !noAging.visited.includes('q_role'));
  ok('nearby caregiver reaches reveal', nearby.visited.includes('reveal'));
}

console.log('\n5. Travel geo routes through the Travel Readiness seam (real branch)');
{
  const { visited } = run(A({ q_geo: 'travel' }));
  ok('seam_travel is visited when geoRisk=travel', visited.includes('seam_travel'));
  const noTravel = run(A({ q_geo: 'none' }));
  ok('seam_travel skipped otherwise', !noTravel.visited.includes('seam_travel'));
}

console.log('\n6. v3 reorder: Tier-P half precedes the private half via half_break');
{
  const { visited } = run(A({ q_agingparent: 'yes' }));
  const iBreak = visited.indexOf('half_break');
  const before = ['q_household', 'q_agingparent', 'q_contacts', 'q_takecharge', 'q_geo', 'q_inventory', 'q_worry', 'q_ltc'];
  const after = ['q_authority', 'q_vulnerability', 'q_medications', 'q_financial'];
  ok('half_break is visited', iBreak > -1);
  ok('all Tier-P questions precede half_break', before.every((id) => { const i = visited.indexOf(id); return i > -1 && i < iBreak; }));
  ok('private (M/F + authority) questions follow half_break', after.every((id) => { const i = visited.indexOf(id); return i > -1 && i > iBreak; }));
}

console.log('\n7. Tier enforcement: the seminar (Tier-P) half never renders Tier M/F (NF-09)');
{
  // Walk from the start to half_break, collecting the fields the shared screen would show.
  const p = run(A({ q_agingparent: 'yes' })).profile;
  const seminarFields: string[] = [];
  let node = firstNode(flow, p);
  for (let i = 0; i < 60 && node; i++) {
    if (node.id === 'half_break') break;
    if (node.type === 'question') seminarFields.push((node as QuestionNode).field);
    node = nextNode(flow, node, p);
  }
  ok('no Tier-M field on the seminar screen', !seminarFields.some((f) => FIELD_TIER[f] === 'M'));
  ok('no Tier-F field on the seminar screen', !seminarFields.some((f) => FIELD_TIER[f] === 'F'));
  ok('financialRunway is Tier F', FIELD_TIER['financialRunway'] === 'F');
}

console.log('\n8. Financial resilience is scored on runway (HR-V3-05)');
{
  const emStatus = (fin: string) => {
    const p = run(A({ q_financial: fin })).profile;
    return scoreProfile(p).dimensions.find((d) => d.id === 'financial_resilience')?.status;
  };
  ok('ample runway → good', emStatus('ample') === 'good');
  ok('little runway → soon', emStatus('little') === 'soon');
  ok('unsure runway → soon', emStatus('unsure') === 'soon');
}

console.log('\n9. People & roles depth: informal authority = watch, documented = good (HR-V3-06)');
{
  const roleStatus = (o: Record<string, string | string[]>) =>
    scoreProfile(run(A(o)).profile).dimensions.find((d) => d.id === 'people_and_roles')?.status;
  ok('documented contacts + named + signed paperwork → good', roleStatus({ q_contacts: 'documented', q_takecharge: 'documented', q_authority: 'documented' }) === 'good');
  ok('named decision-maker but no paperwork → watch', roleStatus({ q_contacts: 'documented', q_takecharge: 'documented', q_authority: 'none' }) === 'watch');
  ok('no decision-maker → soon', roleStatus({ q_contacts: 'documented', q_takecharge: 'none' }) === 'soon');
}

console.log('\n10. Prospect: full plan + artifact do NOT depend on the coverage module (§4/HR-I-05)');
{
  const { profile } = run(A({ q_household: 'kids', q_vulnerability: 'young_kids', q_geo: 'disaster', q_inventory: ['meds_record'], q_worry: 'chaos', q_medications: 'documented', q_financial: 'some' }));
  const score = scoreProfile(profile);
  ok('coverageViewed is false', profile.coverageViewed === false);
  ok('a score band is produced without coverage', Boolean(score.band));
  ok('3 next steps produced', nextSteps(profile).length === 3);
}

console.log('\n11. A fully-prepared household reaches the top band; never 100% (§8.2)');
{
  const p0 = run(A({ q_contacts: 'documented', q_takecharge: 'documented', q_authority: 'documented', q_inventory: ['meds_record', 'go_bag', 'written_plan'], q_medications: 'documented', q_financial: 'ample' })).profile;
  const member: Profile = { ...p0, tier1: { ...p0.tier1, memberStatus: 'member' } };
  const score = scoreProfile(member);
  ok('fully-prepared household reaches "Ready for check-in"', score.band === 'Ready for check-in');
  ok('score never shows 100%', score.displayPct < 100);
}

console.log('\n12. Persona baseline — band cutoffs re-baselined for the 6-dimension model (HR-V3-10)');
{
  const band = (o: Record<string, string | string[]>) => scoreProfile(run(A(o)).profile).band;
  const frac = (o: Record<string, string | string[]>) => scoreProfile(run(A(o)).profile).fraction;
  const cases: [string, Record<string, string | string[]>, string][] = [
    ['unprepared solo', { q_household: 'solo', q_contacts: 'none', q_takecharge: 'none', q_inventory: ['none'], q_medications: 'undocumented', q_financial: 'little', q_worry: 'not_sure' }, 'Started'],
    ['unprepared kids / disaster', { q_household: 'kids', q_vulnerability: 'young_kids', q_geo: 'disaster', q_contacts: 'none', q_takecharge: 'none', q_inventory: ['none'], q_medications: 'undocumented', q_financial: 'unsure', q_worry: 'chaos' }, 'Started'],
    ['partial couple', { q_household: 'couple', q_contacts: 'informal', q_takecharge: 'informal', q_authority: 'none', q_inventory: ['meds_record'], q_medications: 'documented', q_financial: 'some', q_worry: 'chaos' }, 'Needs one key update'],
    ['well-prepared couple (one gap)', { q_household: 'couple', q_contacts: 'documented', q_takecharge: 'documented', q_authority: 'documented', q_inventory: ['meds_record', 'go_bag', 'written_plan'], q_medications: 'documented', q_financial: 'some' }, 'Ready to share'],
    ['fully-prepared multigen', { q_household: 'multigen', q_agingparent: 'yes', q_role: 'caregiver_nearby', q_contacts: 'documented', q_takecharge: 'documented', q_authority: 'documented', q_ltc: 'documented', q_inventory: ['meds_record', 'go_bag', 'written_plan'], q_medications: 'documented', q_financial: 'ample' }, 'Ready for check-in'],
  ];
  for (const [name, o, want] of cases) ok(`${name} → ${want}`, band(o) === want);
  ok('more preparation scores strictly higher', frac(cases[0][1]) < frac(cases[2][1]) && frac(cases[2][1]) < frac(cases[4][1]));
  const empty = scoreProfile(emptyProfile('t', 'x'));
  ok('empty profile is a valid band, never 100%', Boolean(empty.band) && empty.displayPct <= 92);
}

console.log('\n13. Product-neutrality: no scored gap / step title / question copy names a product (NF-10)');
{
  const DENY = /\b(insurance|premium|policy|deductible|indemnity|annuity|underwrit\w*|buy now|purchase a)\b/i;
  const offenders: string[] = [];
  // question copy + option labels
  for (const node of Object.values(flow.nodes)) {
    if (node.type === 'question') {
      const say = typeof node.say === 'string' ? node.say : '';
      if (DENY.test(say)) offenders.push(`q:${node.id}.say`);
      for (const o of node.options) if (DENY.test(o.label)) offenders.push(`q:${node.id}.opt:${o.value}`);
    }
  }
  // step titles + descriptions
  for (const s of LIBRARY) {
    if (DENY.test(s.title)) offenders.push(`step:${s.id}.title`);
    if (DENY.test(s.desc)) offenders.push(`step:${s.id}.desc`);
  }
  // dimension names (aging + non-aging cover all)
  const dimNames = new Set<string>();
  for (const o of [{}, { q_agingparent: 'yes' }]) scoreProfile(run(A(o)).profile).dimensions.forEach((d) => dimNames.add(d.name));
  for (const n of dimNames) if (DENY.test(n)) offenders.push(`dim:${n}`);
  ok(`no product terms in scored copy${offenders.length ? ' — ' + offenders.join(', ') : ''}`, offenders.length === 0);
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
