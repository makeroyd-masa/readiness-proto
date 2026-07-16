/**
 * The reusable node-type library (PRD §6.1). Every flow is authored as data
 * built from these eight node types; the engine (engine/engine.ts) walks them.
 * Content is authored data; the engine is code (PRD §19.1).
 */

import type { Profile } from './profile';

export type NodeType =
  | 'content' // SAM says something; may pull a cited knowledge block
  | 'question' // deterministic options (+ optional free-text escape hatch)
  | 'freetext' // open box; routed through the LLM orchestrator (v2/later phase)
  | 'decision' // pure logic over the profile; no user input
  | 'compute' // scoring and derived values
  | 'artifact' // renders a template from the profile
  | 'seam' // coverage education, human handoff, share, or cross-flow jump
  | 'return'; // change-detection for repeat visits

export interface BaseNode {
  id: string;
  type: NodeType;
  /** Optional guard: node is only entered when this predicate is true. */
  when?: (p: Profile) => boolean;
}

export interface ContentNode extends BaseNode {
  type: 'content';
  say: string | ((p: Profile) => string);
  /** id of a cited evidence block to surface at point-of-need (PRD HR-I-10). */
  evidenceId?: string;
  next?: string;
}

export interface QuestionOption {
  value: string;
  label: string;
  /** exclusive option (e.g. "none of these") clears others in multi-select. */
  exclusive?: boolean;
}

export interface QuestionNode extends BaseNode {
  type: 'question';
  say: string | ((p: Profile) => string);
  /** which profile field this writes to (dot path into tier1). */
  field: string;
  multi?: boolean;
  options: QuestionOption[];
  /** optional free-text escape hatch label (logged only in v1; PRD §11 Stage 0). */
  freeTextEscape?: string;
  next?: string;
}

export interface DecisionNode extends BaseNode {
  type: 'decision';
  /** returns the id of the next node based on the profile. */
  route: (p: Profile) => string;
}

export interface ComputeNode extends BaseNode {
  type: 'compute';
  /** side-effect-free marker; the engine recomputes score from the profile. */
  next?: string;
}

export interface ArtifactNode extends BaseNode {
  type: 'artifact';
  next?: string;
}

export interface SeamNode extends BaseNode {
  type: 'seam';
  seam: 'coverage' | 'handoff' | 'share' | 'cross_flow';
  next?: string;
}

export interface ReturnNode extends BaseNode {
  type: 'return';
  next?: string;
}

export interface FreeTextNode extends BaseNode {
  type: 'freetext';
  say: string;
  /** v1: log only + map to closest flow entry. No LLM (PRD §12, §19.3). */
  next?: string;
}

export type FlowNode =
  | ContentNode
  | QuestionNode
  | FreeTextNode
  | DecisionNode
  | ComputeNode
  | ArtifactNode
  | SeamNode
  | ReturnNode;

export interface Flow {
  id: string;
  title: string;
  startId: string;
  nodes: Record<string, FlowNode>;
}
