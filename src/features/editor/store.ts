/**
 * 편집기 스토어 (design.md 3.4.3 ① 자료구조 그대로).
 * nodes·edges·serverVersion·dirty·issues·runState + 실행 취소(zundo, UNDO_LIMIT=100).
 */
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { temporal } from 'zundo';
import { create } from 'zustand';
import type { ValidationIssue, WorkflowDetailRow } from '@/entities/workflow';
import { fromDefinition, type FlowEdge, type FlowNode } from './convert';

export const AUTOSAVE_MS = 1500;
export const UNDO_LIMIT = 100;
export const MAX_CONSOLE_LINES = 5000;

export type NodeRunState = 'idle' | 'running' | 'ok' | 'error' | 'waiting';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorState {
  workflowId: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  serverVersion: number;
  dirty: boolean;
  issues: Record<string, ValidationIssue[]>;
  globalIssues: ValidationIssue[];
  runState: Record<string, NodeRunState>;
  /** 마지막 테스트 실행 id(인스펙터 결과 미리보기용) */
  lastRunId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  conflict: WorkflowDetailRow | null;
  clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null;

  init: (w: Pick<WorkflowDetailRow, 'id' | 'draft' | 'draft_version'>) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  connect: (c: Connection) => void;
  addNode: (n: FlowNode) => void;
  updateNode: (id: string, patch: Partial<FlowNode['data']>) => void;
  updateConfig: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (nodes: FlowNode[]) => void;
  deleteSelected: () => void;
  selectOnly: (id: string | null) => void;
  copySelection: () => void;
  paste: () => void;
  setIssues: (issues: ValidationIssue[]) => void;
  setRunState: (id: string, s: NodeRunState) => void;
  resetRunState: () => void;
  setLastRunId: (id: string | null) => void;
  markSaving: () => void;
  markSaved: (version: number, issues: ValidationIssue[]) => void;
  markSaveError: (message: string) => void;
  setConflict: (w: WorkflowDetailRow | null) => void;
  /** 서버본으로 바꾸기(충돌 다이얼로그 "서버 것 불러오기") */
  loadServer: (w: Pick<WorkflowDetailRow, 'id' | 'draft' | 'draft_version'>) => void;
  /** 내 것으로 덮어쓰기: If-Match를 서버 최신 버전으로 맞춘다 */
  adoptServerVersion: (v: number) => void;
}

const groupIssues = (issues: ValidationIssue[]) => {
  const byNode: Record<string, ValidationIssue[]> = {};
  const global: ValidationIssue[] = [];
  for (const i of issues) {
    if (i.node_id) (byNode[i.node_id] ??= []).push(i);
    else global.push(i);
  }
  return { issues: byNode, globalIssues: global };
};

/** 선택·드래그 중 표시 같은 일시 상태는 실행 취소 기록에서 뺀다 */
const shape = (s: Pick<EditorState, 'nodes' | 'edges'>) =>
  JSON.stringify({ n: s.nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data]), e: s.edges.map((e) => [e.id, e.source, e.sourceHandle, e.target, e.targetHandle]) });

let lastRecord = 0;

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      workflowId: null,
      nodes: [],
      edges: [],
      serverVersion: 0,
      dirty: false,
      issues: {},
      globalIssues: [],
      runState: {},
      lastRunId: null,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      conflict: null,
      clipboard: null,

      init: (w) => {
        const { nodes, edges } = fromDefinition(w.draft);
        set({ workflowId: w.id, nodes, edges, serverVersion: w.draft_version, dirty: false, issues: {}, globalIssues: [], runState: {}, lastRunId: null, saveStatus: 'idle', saveError: null, conflict: null });
        useEditorStore.temporal.getState().clear();
      },
      onNodesChange: (changes) => {
        const meaningful = changes.some((c) => c.type !== 'select' && c.type !== 'dimensions');
        set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), dirty: s.dirty || (meaningful && changes.some((c) => c.type !== 'position' || !c.dragging)) }));
      },
      onEdgesChange: (changes) => {
        const meaningful = changes.some((c) => c.type !== 'select');
        set((s) => ({ edges: applyEdgeChanges(changes, s.edges), dirty: s.dirty || meaningful }));
      },
      connect: (c) => {
        const src = get().nodes.find((n) => n.id === c.source);
        const label = src?.data.type === 'condition' ? (c.sourceHandle === 'true' ? '예' : c.sourceHandle === 'false' ? '아니오' : undefined) : undefined;
        set((s) => ({ edges: addEdge({ ...c, id: `e-${c.source}-${c.sourceHandle}-${c.target}-${c.targetHandle}`, label, data: { condition: null } }, s.edges), dirty: true }));
      },
      addNode: (n) => set((s) => ({ nodes: [...s.nodes.map((x) => ({ ...x, selected: false })), { ...n, selected: true }], dirty: true })),
      updateNode: (id, patch) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), dirty: true })),
      updateConfig: (id, patch) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n)), dirty: true })),
      setNodes: (nodes) => set({ nodes, dirty: true }),
      deleteSelected: () =>
        set((s) => {
          const gone = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
          return {
            nodes: s.nodes.filter((n) => !gone.has(n.id)),
            edges: s.edges.filter((e) => !e.selected && !gone.has(e.source) && !gone.has(e.target)),
            dirty: true,
          };
        }),
      selectOnly: (id) => set((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })), edges: s.edges.map((e) => ({ ...e, selected: false })) })),
      copySelection: () => {
        const nodes = get().nodes.filter((n) => n.selected);
        const ids = new Set(nodes.map((n) => n.id));
        const edges = get().edges.filter((e) => ids.has(e.source) && ids.has(e.target));
        if (nodes.length) set({ clipboard: { nodes: structuredClone(nodes), edges: structuredClone(edges) } });
      },
      paste: () => {
        const clip = get().clipboard;
        if (!clip) return;
        const taken = new Set(get().nodes.map((n) => n.id));
        const map = new Map<string, string>();
        for (const n of clip.nodes) {
          let i = 2;
          let id = `${n.id}_copy`;
          while (taken.has(id)) id = `${n.id}_copy${i++}`;
          taken.add(id);
          map.set(n.id, id);
        }
        const nodes = clip.nodes.map((n) => ({ ...n, id: map.get(n.id)!, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true }));
        const edges = clip.edges.map((e) => ({ ...e, id: `${e.id}_copy_${Date.now()}`, source: map.get(e.source)!, target: map.get(e.target)!, selected: false }));
        set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...nodes], edges: [...s.edges, ...edges], dirty: true }));
      },
      setIssues: (issues) => set(groupIssues(issues)),
      setRunState: (id, st) => set((s) => ({ runState: { ...s.runState, [id]: st } })),
      resetRunState: () => set({ runState: {} }),
      setLastRunId: (id) => set({ lastRunId: id }),
      markSaving: () => set({ saveStatus: 'saving', saveError: null }),
      markSaved: (version, issues) => set({ serverVersion: version, dirty: false, saveStatus: 'saved', saveError: null, lastSavedAt: Date.now(), ...groupIssues(issues) }),
      markSaveError: (message) => set({ saveStatus: 'error', saveError: message }),
      setConflict: (w) => set({ conflict: w, saveStatus: w ? 'error' : get().saveStatus, saveError: w ? '다른 곳에서 먼저 저장했습니다.' : null }),
      loadServer: (w) => {
        get().init(w);
        set({ saveStatus: 'saved', lastSavedAt: Date.now() });
      },
      adoptServerVersion: (v) => set({ serverVersion: v, conflict: null, dirty: true }),
    }),
    {
      limit: UNDO_LIMIT,
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }) as EditorState,
      equality: (a, b) => shape(a) === shape(b),
      // 드래그처럼 연속된 변경은 하나로 묶는다(첫 상태만 기록)
      handleSet: (handleSet) => (state, replace, current, delta) => {
        if (shape(state as EditorState) === shape(current as EditorState)) return;
        const now = Date.now();
        if (now - lastRecord < 400) return;
        lastRecord = now;
        (handleSet as (...a: unknown[]) => void)(state, replace, current, delta);
      },
    },
  ),
);

export const undo = () => {
  useEditorStore.temporal.getState().undo();
  useEditorStore.setState({ dirty: true });
};
export const redo = () => {
  useEditorStore.temporal.getState().redo();
  useEditorStore.setState({ dirty: true });
};
