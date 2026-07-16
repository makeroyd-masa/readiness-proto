/**
 * Flow engine (PRD §19.3). Walks the authored flow deterministically:
 *  - evaluates Decision nodes against the profile,
 *  - skips nodes whose `when` guard is false,
 *  - passes through Compute nodes (score is derived from the profile, see scoring.ts),
 *  - stops on the next node that needs rendering.
 * Tapped options run straight down these rails — no LLM (PRD §6, §19.3).
 */

import type { Flow, FlowNode } from '../domain/nodes';
import type { Profile } from '../domain/profile';
import type { InventoryItem } from '../domain/valueSets';

/** Node types the UI renders (vs. auto nodes the engine passes through). */
const RENDER_TYPES = new Set(['content', 'question', 'freetext', 'artifact', 'seam', 'return']);

const MAX_HOPS = 100; // loop backstop

export function getNode(flow: Flow, id: string | undefined): FlowNode | null {
  if (!id) return null;
  return flow.nodes[id] ?? null;
}

/** Resolve from a starting id to the next render node (or null at end of flow). */
export function resolve(flow: Flow, startId: string | undefined, p: Profile): FlowNode | null {
  let id = startId;
  for (let hops = 0; hops < MAX_HOPS; hops++) {
    const node = getNode(flow, id);
    if (!node) return null;

    if (node.when && !node.when(p)) {
      id = (node as { next?: string }).next;
      continue;
    }
    if (node.type === 'decision') {
      id = node.route(p);
      continue;
    }
    if (node.type === 'compute') {
      id = node.next;
      continue;
    }
    if (RENDER_TYPES.has(node.type)) return node;

    id = (node as { next?: string }).next;
  }
  throw new Error(`Flow ${flow.id}: exceeded ${MAX_HOPS} hops from ${startId} (cycle?)`);
}

export function firstNode(flow: Flow, p: Profile): FlowNode | null {
  return resolve(flow, flow.startId, p);
}

/** Given the current render node, resolve the following render node. */
export function nextNode(flow: Flow, current: FlowNode, p: Profile): FlowNode | null {
  const nextId = (current as { next?: string }).next;
  return resolve(flow, nextId, p);
}

/**
 * Apply a question answer to the profile (pure — returns a new profile).
 * Single-select writes the value; multi-select writes an array (with exclusive
 * "none" collapsing to []).
 */
export function applyAnswer(p: Profile, field: string, value: string | string[]): Profile {
  const tier1: Record<string, unknown> = { ...p.tier1 };
  if (Array.isArray(value)) {
    tier1[field] = value.filter((v) => v !== 'none') as InventoryItem[];
  } else {
    tier1[field] = value;
  }
  return { ...p, tier1: tier1 as unknown as Profile['tier1'] };
}
