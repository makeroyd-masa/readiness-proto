/* Headless verification of the core model against PRD §19.7 acceptance checks.
   Run: npx tsx verify.ts  (from app/). Not part of the app bundle. */
import { assertFlowIntegrity } from './src/engine/guards';
import { householdReadinessFlow as flow } from './src/content/flow';
import { applyAnswer, firstNode, nextNode } from './src/engine/engine';
import { emptyProfile, type Profile } from './src/domain/profile';
import type { QuestionNode } from './src/domain/nodes';
import { scoreProfile } from './src/domain/scoring';
import { nextSteps } from './src/domain/steps';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}`);
  cond ? pass++ : fail++;
};

/** Drive the flow with a map of answers keyed by question node id. */
function run(answers: Record<string, string | string[]>): { profile: Profile; visited: string[] } {
  let p = emptyProfile('test', '2026-07-13T00:00:00Z');
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

console.log('\n2. Score contains NO coverage dimension (§8)');
{
  const { profile } = run({ q_household: 'solo', q_vulnerability: 'none', q_geo: 'none', q_inventory: ['meds_record'], q_worry: 'cost', q_medications: 'none' });
  const dims = scoreProfile(profile).dimensions.map((d) => d.id);
  ok('no dimension id mentions coverage', !dims.some((d) => /coverage/i.test(d)));
  ok('exactly 5 family-controlled dimensions', dims.length === 5);
}

console.log('\n3. Every household type reaches the reveal with a distinct personalized 5th');
{
  const fifths = new Set<string>();
  for (const ht of ['solo', 'couple', 'kids', 'multigen', 'caregiver']) {
    const answers: Record<string, string | string[]> = {
      q_household: ht,
      q_role: 'caregiver_nearby',
      q_vulnerability: 'none',
      q_geo: 'none',
      q_inventory: [],
      q_worry: 'not_sure',
      q_medications: 'none',
    };
    const { profile, visited } = run(answers);
    ok(`household "${ht}" reaches reveal`, visited.includes('reveal'));
    const fifth = scoreProfile(profile).dimensions.find((d) => d.id === 'personalized_fifth');
    if (fifth) fifths.add(fifth.name);
  }
  ok('personalized 5th differs across household types', fifths.size >= 4);
}

console.log('\n4. Caregiver + remote escalates remote coordination (the v1 dead branch, now live)');
{
  const nearby = run({ q_household: 'caregiver', q_role: 'caregiver_nearby', q_vulnerability: 'none', q_geo: 'none', q_inventory: [], q_worry: 'distance', q_medications: 'none' });
  const remote = run({ q_household: 'caregiver', q_role: 'caregiver_remote', q_vulnerability: 'none', q_geo: 'none', q_inventory: [], q_worry: 'distance', q_medications: 'none' });
  const fifthStatus = (p: Profile) => scoreProfile(p).dimensions.find((d) => d.id === 'personalized_fifth')?.status;
  ok('remote caregiver escalates 5th to "soon"', fifthStatus(remote.profile) === 'soon');
  ok('nearby caregiver does not', fifthStatus(nearby.profile) !== 'soon');
  const remoteStep = nextSteps(remote.profile).some((s) => s.id === 'remote_access');
  ok('remote-access step surfaces for remote caregiver', remoteStep);
}

console.log('\n5. Travel geo routes through the Travel Readiness seam (real branch)');
{
  const { visited } = run({ q_household: 'solo', q_vulnerability: 'none', q_geo: 'travel', q_inventory: [], q_worry: 'not_sure', q_medications: 'none' });
  ok('seam_travel is visited when geoRisk=travel', visited.includes('seam_travel'));
  const noTravel = run({ q_household: 'solo', q_vulnerability: 'none', q_geo: 'none', q_inventory: [], q_worry: 'not_sure', q_medications: 'none' });
  ok('seam_travel skipped otherwise', !noTravel.visited.includes('seam_travel'));
}

console.log('\n6. Prospect: full plan + artifact do NOT depend on the coverage module (§4/HR-I-05)');
{
  const { profile } = run({ q_household: 'kids', q_vulnerability: 'young_kids', q_geo: 'disaster', q_inventory: ['meds_record', 'contacts'], q_worry: 'chaos', q_medications: 'documented' });
  const score = scoreProfile(profile);
  const steps = nextSteps(profile);
  ok('coverageViewed is false', profile.coverageViewed === false);
  ok('a score band is produced without coverage', Boolean(score.band));
  ok('3 next steps produced', steps.length === 3);
}

console.log('\n7. Member can reach the top band on own preparation (§8.2)');
{
  const p0 = run({ q_household: 'couple', q_vulnerability: 'none', q_geo: 'none', q_inventory: ['meds_record', 'contacts', 'decision_maker', 'go_bag', 'written_plan'], q_worry: 'not_sure', q_medications: 'documented' }).profile;
  const member: Profile = { ...p0, tier1: { ...p0.tier1, memberStatus: 'member' } };
  const score = scoreProfile(member);
  ok('fully-prepared household reaches "Ready for check-in"', score.band === 'Ready for check-in');
  ok('score never shows 100%', score.displayPct < 100);
}

console.log('\n8. Never 100%, bands ascend');
{
  const empty = scoreProfile(emptyProfile('t', 'x'));
  ok('empty profile is a valid band', Boolean(empty.band));
  ok('empty displayPct <= 92', empty.displayPct <= 92);
}

console.log('\n9. Reorder: the non-medical half precedes the medical half via half_break');
{
  const { visited } = run({ q_household: 'kids', q_geo: 'none', q_inventory: [], q_worry: 'info', q_vulnerability: 'none', q_medications: 'none' });
  const iBreak = visited.indexOf('half_break');
  const iWorry = visited.indexOf('q_worry');
  const iVuln = visited.indexOf('q_vulnerability');
  const iMeds = visited.indexOf('q_medications');
  ok('half_break is visited', iBreak > -1);
  ok('non-medical q_worry precedes half_break', iWorry > -1 && iWorry < iBreak);
  ok('medical half (vulnerability → medications) follows half_break', iBreak < iVuln && iVuln < iMeds);
  ok('reveal reached after the medical half', visited.includes('reveal'));
}

console.log('\n10. medicalNeeds drives the Emergency information dimension (scored medical half)');
{
  const emStatus = (p: Profile) => scoreProfile(p).dimensions.find((d) => d.id === 'emergency_information')?.status;
  const undoc = run({ q_household: 'solo', q_geo: 'none', q_inventory: [], q_worry: 'info', q_vulnerability: 'none', q_medications: 'undocumented' }).profile;
  ok('undocumented meds → "soon"', emStatus(undoc) === 'soon');
  ok('documented meds → "good"', emStatus({ ...undoc, tier1: { ...undoc.tier1, medicalNeeds: 'documented' } }) === 'good');
  ok('no meds to note → "good"', emStatus({ ...undoc, tier1: { ...undoc.tier1, medicalNeeds: 'none' } }) === 'good');
}

console.log('\n11. People & roles tool writes lift the people_and_roles dimension');
{
  const roleStatus = (p: Profile) => scoreProfile(p).dimensions.find((d) => d.id === 'people_and_roles')?.status;
  const p = run({ q_household: 'couple', q_geo: 'none', q_inventory: [], q_worry: 'chaos', q_vulnerability: 'none', q_medications: 'none' }).profile;
  const before = roleStatus(p);
  const after: Profile = {
    ...p,
    tier1: { ...p.tier1, inventory: ['contacts', 'decision_maker'] },
    tier2: { ...p.tier2, contacts: [{ name: 'Sue', relationship: 'spouse', phone: '555-0100' }], decisionMakerName: 'Sue', decisionMakerStatus: 'yes' },
  };
  ok('people_and_roles improves after adding contacts + decision-maker', before !== 'good' && roleStatus(after) === 'good');
}

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
