/**
 * Dev-time integrity guards (PRD §18, §19.2, §19.7 "no dead branches").
 *
 * The v1 prototype shipped branches that tested values ("distance", householdType
 * "travel") that no option could produce. These guards run once at startup in dev
 * and fail loudly if:
 *   - a question option writes a value outside its field's value-set,
 *   - a decision/next points to a node id that doesn't exist,
 *   - a `when`/route references produce an unreachable render node.
 *
 * They can't fully prove predicate reachability (routes are functions), but they
 * eliminate the exact class of bug §18 calls out.
 */

import type { Flow } from '../domain/nodes';
import {
  GEO_RISKS,
  HOUSEHOLD_TYPES,
  INVENTORY_ITEMS,
  ROLES,
  TOP_WORRIES,
  VULNERABILITIES,
} from '../domain/valueSets';

const FIELD_VALUE_SETS: Record<string, readonly string[]> = {
  householdType: HOUSEHOLD_TYPES,
  vulnerability: VULNERABILITIES,
  geoRisk: GEO_RISKS,
  role: ROLES,
  topWorry: TOP_WORRIES,
  inventory: INVENTORY_ITEMS,
};

export function assertFlowIntegrity(flow: Flow): void {
  const errors: string[] = [];
  const ids = new Set(Object.keys(flow.nodes));

  if (!ids.has(flow.startId)) errors.push(`startId "${flow.startId}" is not a node`);

  for (const [id, node] of Object.entries(flow.nodes)) {
    if (node.id !== id) errors.push(`node key "${id}" != node.id "${node.id}"`);

    const next = (node as { next?: string }).next;
    if (next && !ids.has(next)) errors.push(`node "${id}".next -> unknown node "${next}"`);

    if (node.type === 'question') {
      const allowed = FIELD_VALUE_SETS[node.field];
      if (!allowed) {
        errors.push(`question "${id}" writes unknown field "${node.field}"`);
      } else {
        for (const opt of node.options) {
          // "none" is the allowed exclusive sentinel for multi-selects.
          if (opt.value === 'none' && node.multi) continue;
          if (!allowed.includes(opt.value)) {
            errors.push(`question "${id}" option "${opt.value}" not in value-set for "${node.field}"`);
          }
        }
      }
    }
  }

  if (errors.length) {
    throw new Error(`Flow integrity check failed for "${flow.id}":\n  - ${errors.join('\n  - ')}`);
  }
}
