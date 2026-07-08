import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
  type ReactFlowInstance,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createProject, createPhase, createMilestone, setDependencies } from '../api/client';

// ── Local types ────────────────────────────────────────────────────────────────

interface CObjective {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
}

interface CPhase {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  objectives: CObjective[];
}

interface PhaseNodeData extends Record<string, unknown> {
  phase: CPhase;
  phaseNum: number;
}

type PhaseNodeType = Node<PhaseNodeData, 'phaseNode'>;

// ── ID generator ───────────────────────────────────────────────────────────────

let _uid = 0;
function uid() { return `loc-${++_uid}-${Date.now()}`; }

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500'];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function AvatarCircle({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'md' }) {
  const sz = size === 'xs' ? 'w-4 h-4 text-[8px]' : size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]';
  return (
    <div className={`${sz} rounded-full ${avatarColor(name)} flex items-center justify-center text-white font-bold shrink-0 select-none`}>
      {initials(name)}
    </div>
  );
}

// ── Handle style ───────────────────────────────────────────────────────────────

const HS: React.CSSProperties = {
  width: 20, height: 20,
  background: '#fff',
  border: '2.5px solid #94a3b8',
  borderRadius: '50%',
  transition: 'background 0.15s, border-color 0.15s',
  zIndex: 10,
};

// ── Phase canvas node ──────────────────────────────────────────────────────────

const PhaseNode = memo(function PhaseNode({ data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<PhaseNodeType>) {
  const { phase, phaseNum } = data;
  const { setCenter } = useReactFlow();
  return (
    <div
      className={`w-80 bg-white rounded-2xl overflow-hidden shadow-xl border transition-all duration-150 ${selected ? 'border-[#46645c] shadow-blue-100/60' : 'border-[#E0CFC4] shadow-slate-200/60'}`}
      onClick={() => setCenter(positionAbsoluteX + 160, positionAbsoluteY + 90, { duration: 600 })}
    >
      <Handle type="source" position={Position.Top}    id="t" style={HS} />
      <Handle type="source" position={Position.Bottom} id="b" style={HS} />

      {/* Card header */}
      <div className="px-4 py-2.5 bg-[#FFF5E9] border-b border-[#E0CFC4] flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest">
          Phase {String(phaseNum).padStart(2, '0')}
        </span>
        {/* Drag grip icon */}
        <svg className="w-4 h-4 text-[#BBA79C]" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

      {/* Phase info */}
      <div className="px-4 py-3">
        <h4 className="font-bold text-[#2D1E1A] text-[15px] leading-snug">
          {phase.title || <span className="text-[#BBA79C] font-normal italic">Unnamed phase</span>}
        </h4>
        {phase.description && (
          <p className="text-xs text-[#8A7265] mt-1 line-clamp-2">{phase.description}</p>
        )}
        {phase.dueDate && (
          <p className="text-[10px] text-[#8A7265] mt-1.5 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Due {phase.dueDate}
          </p>
        )}
      </div>

      {/* Objectives */}
      {phase.objectives.length > 0 && (
        <div className="px-4 pb-3 border-t border-[#E0CFC4] pt-2 space-y-2.5">
          {phase.objectives.slice(0, 3).map((obj) => (
            <div key={obj.id} className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#54433A] font-medium truncate">{obj.title || <span className="text-[#BBA79C] italic">Untitled</span>}</p>
                {obj.description && <p className="text-[10px] text-[#8A7265] truncate mt-0.5">{obj.description}</p>}
                {obj.dueDate && (
                  <p className="text-[10px] text-[#8A7265] mt-0.5 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Due {obj.dueDate}
                  </p>
                )}
              </div>
            </div>
          ))}
          {phase.objectives.length > 3 && (
            <p className="text-[10px] text-[#8A7265] pl-5">+{phase.objectives.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
});

const nodeTypes = { phaseNode: PhaseNode };

// ── Custom edge with delete toolbar ───────────────────────────────────────────

function PhaseEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: selected ? '#3b82f6' : '#64748b', strokeWidth: selected ? 3 : 2, transition: 'stroke 0.15s, stroke-width 0.15s' }}
      />
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
            className="nodrag nopan"
          >
            <button
              onClick={e => { e.stopPropagation(); setEdges(es => es.filter(ex => ex.id !== id)); }}
              className="w-6 h-6 bg-[#ba1a1a] hover:bg-[#93000a] rounded-full text-white text-sm font-bold flex items-center justify-center shadow-lg transition-colors"
              title="Remove connection"
            >×</button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = { phaseEdge: PhaseEdge };

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep]   = useState<1 | 2>(1);
  const [form, setForm]   = useState({ title: '', description: '', targetEndDate: '' });
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const members = user ? [{ id: user.id, name: user.name }] : [];

  const [nodes, setNodes, onNodesChange] = useNodesState<PhaseNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const el = sidebarRef.current?.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      const t = setTimeout(() => rfInstance.fitView({ padding: 0.2, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
  }, [nodes.length, rfInstance]);

  // ── Phase mutations ──────────────────────────────────────────────────────────

  function addPhase() {
    const id = uid();
    const col = nodes.length % 3;
    const row = Math.floor(nodes.length / 3);
    const newNode: PhaseNodeType = {
      id,
      type: 'phaseNode',
      position: { x: 80 + col * 360, y: 80 + row * 280 },
      data: {
        phase: { id, title: '', description: '', dueDate: '', objectives: [] },
        phaseNum: nodes.length + 1,
      },
    };
    setNodes(prev => [...prev, newNode]);
  }

  function updatePhaseField(id: string, field: keyof Pick<CPhase, 'title' | 'description' | 'dueDate'>, value: string) {
    setNodes(prev => prev.map(n =>
      n.id === id
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, [field]: value } } }
        : n
    ));
  }

  function removePhase(id: string) {
    setNodes(prev =>
      prev.filter(n => n.id !== id).map((n, i) => ({ ...n, data: { ...n.data, phaseNum: i + 1 } }))
    );
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
  }

  function addObjective(phaseId: string) {
    const objId = uid();
    setNodes(prev => prev.map(n =>
      n.id === phaseId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: [...n.data.phase.objectives, { id: objId, title: '', description: '', dueDate: '', assigneeId: '', assigneeName: '' }] } } }
        : n
    ));
  }

  function updateObjective(phaseId: string, objId: string, field: keyof Pick<CObjective, 'title' | 'description' | 'dueDate'>, value: string) {
    setNodes(prev => prev.map(n =>
      n.id === phaseId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.map(o => o.id === objId ? { ...o, [field]: value } : o) } } }
        : n
    ));
  }

  function updateObjectiveAssignee(phaseId: string, objId: string, assigneeId: string, assigneeName: string) {
    setNodes(prev => prev.map(n =>
      n.id === phaseId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.map(o => o.id === objId ? { ...o, assigneeId, assigneeName } : o) } } }
        : n
    ));
  }

  function removeObjective(phaseId: string, objId: string) {
    setNodes(prev => prev.map(n =>
      n.id === phaseId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.filter(o => o.id !== objId) } } }
        : n
    ));
  }

  // ── React Flow connection ────────────────────────────────────────────────────

  const onConnect = useCallback((connection: Connection) => {
    setEdges(prev => addEdge({
      ...connection,
      type: 'phaseEdge',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 14, height: 14 },
    }, prev));
  }, [setEdges]);

  // ── Create project ───────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.title.trim()) { setSaveError('Project name is required.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const project = await createProject(
        form.title.trim(),
        form.description || undefined,
        form.targetEndDate || undefined,
      );

      const idMap = new Map<string, string>(); // localId → DB id
      const ordered = [...nodes].sort((a, b) => a.data.phaseNum - b.data.phaseNum);

      for (let i = 0; i < ordered.length; i++) {
        const { phase } = ordered[i].data;
        if (!phase.title.trim()) continue;
        const created = await createPhase(
          project.id, phase.title.trim(), i + 1,
          phase.description || undefined,
          phase.dueDate || undefined,
        );
        idMap.set(ordered[i].id, created.id);

        for (let j = 0; j < phase.objectives.length; j++) {
          const obj = phase.objectives[j];
          if (!obj.title.trim()) continue;
          const assigneeIds = obj.assigneeId ? [obj.assigneeId] : undefined;
          await createMilestone(created.id, obj.title.trim(), j + 1, obj.dueDate || undefined, assigneeIds, obj.description || undefined);
        }
      }

      // Set dependencies (map local edge IDs → real DB IDs)
      const depMap = new Map<string, string[]>(); // realTargetId → [realSourceId]
      for (const edge of edges) {
        const realSource = idMap.get(edge.source);
        const realTarget = idMap.get(edge.target);
        if (realSource && realTarget) {
          if (!depMap.has(realTarget)) depMap.set(realTarget, []);
          depMap.get(realTarget)!.push(realSource);
        }
      }
      for (const [targetId, sourceIds] of depMap) {
        try { await setDependencies(targetId, sourceIds); } catch { /* endpoint may not be deployed */ }
      }

      // Persist canvas layout so positions + edges are restored when the user edits
      const posMap: Record<string, { x: number; y: number }> = {};
      for (const node of ordered) {
        const realId = idMap.get(node.id);
        if (realId) posMap[realId] = node.position;
      }
      const edgeList: { source: string; target: string }[] = [];
      for (const edge of edges) {
        const rs = idMap.get(edge.source);
        const rt = idMap.get(edge.target);
        if (rs && rt) edgeList.push({ source: rs, target: rt });
      }
      if (Object.keys(posMap).length > 0) {
        localStorage.setItem(`steadily-canvas-${project.id}`, JSON.stringify({ positions: posMap, edges: edgeList }));
      }

      navigate(`/projects/${project.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function goToStep2() {
    if (!form.title.trim()) { setStep1Error('Project name is required.'); return; }
    setStep1Error(null);
    setStep(2);
  }

  // ── Step 1 render ────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="flex overflow-hidden bg-white h-full">

        {/* Left: form panel */}
        <section className="w-[460px] shrink-0 border-r border-[#E0CFC4] flex flex-col">

          {/* Step indicator + heading */}
          <div className="px-8 pt-8 pb-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-[3px] w-8 bg-[#C4601A] rounded-full" />
              <span className="h-[3px] w-8 bg-[#E0CFC4] rounded-full" />
            </div>
            <p className="text-[11px] font-bold text-[#46645c] uppercase tracking-widest mb-1.5">Step 1 of 2</p>
            <h2 className="text-2xl font-bold text-[#2D1E1A] tracking-tight">Project Details</h2>
            <p className="text-sm text-[#8A7265] mt-2 leading-relaxed">
              Define the core identity of your project. You can adjust these later from the dashboard.
            </p>
          </div>

          {/* Form */}
          <div className="px-8 flex-1 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-[#54433A] mb-1.5">Project Name</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. Q4 Growth Strategy"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && goToStep2()}
                className="w-full h-11 px-4 border border-[#E0CFC4] rounded-xl text-sm focus:outline-none focus:border-[#46645c] focus:ring-2 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#54433A] mb-1.5">Description</label>
              <textarea
                rows={5}
                placeholder="Briefly describe the objectives and scope of this project..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-3 border border-[#E0CFC4] rounded-xl text-sm focus:outline-none focus:border-[#46645c] focus:ring-2 focus:ring-[#c8eadf] transition-all resize-none placeholder:text-[#BBA79C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#54433A] mb-1.5">Completion Deadline</label>
              <div className="relative">
                <input
                  type="date"
                  value={form.targetEndDate}
                  onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))}
                  className="w-full h-11 pl-11 pr-4 border border-[#E0CFC4] rounded-xl text-sm focus:outline-none focus:border-[#46645c] focus:ring-2 focus:ring-[#c8eadf] transition-all"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7265] pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pt-5 pb-8 shrink-0">
            {step1Error && <p className="text-xs text-[#ba1a1a] mb-3">{step1Error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/projects')}
                className="px-5 py-2.5 text-sm text-[#8A7265] hover:text-[#54433A] transition-colors rounded-xl"
              >Cancel</button>
              <button
                onClick={goToStep2}
                className="flex-1 h-12 bg-[#C4601A] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-[#C4601A] transition-all"
              >
                Continue to Phases
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Right: preview panel */}
        <section
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          style={{
            background: '#f8fafc',
            backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="max-w-md w-full space-y-8 px-8 z-10">

            {/* Live preview card */}
            <div
              className="bg-white border border-[#E0CFC4] rounded-2xl p-6 shadow-lg"
              style={{ animation: 'floatCard 3s ease-in-out infinite' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#F0E9E0] rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-[#8A7265]" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                  </div>
                  <div>
                    {form.title ? (
                      <p className="font-semibold text-[#2D1E1A] text-sm leading-tight">{form.title}</p>
                    ) : (
                      <div className="h-3 w-28 bg-[#F0E9E0] rounded-full" />
                    )}
                    {form.targetEndDate ? (
                      <p className="text-[11px] text-[#8A7265] mt-1">Due {form.targetEndDate}</p>
                    ) : (
                      <div className="h-2.5 w-20 bg-[#F0E9E0] rounded-full mt-1.5" />
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-[#E8FAF7] text-[#46645c] px-3 py-1 rounded-full">Active</span>
              </div>

              <div className="border-t border-[#E0CFC4] pt-4 grid grid-cols-3 gap-4">
                {[['Status', 'On track'], ['Phases', '—'], ['Progress', '0%']].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] text-[#8A7265] uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xs font-semibold text-[#54433A]">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty state hint */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-white border-2 border-dashed border-[#E0CFC4] rounded-2xl mx-auto flex items-center justify-center">
                <svg className="w-6 h-6 text-[#8A7265]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-[#54433A] text-sm">Your Project Canvas</h4>
                <p className="text-xs text-[#8A7265] mt-1 max-w-xs mx-auto leading-relaxed">
                  Complete this step to unlock the phase editor — where you'll build your project's structure visually.
                </p>
              </div>
            </div>

            {/* Step chips */}
            <div className="flex justify-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#C4601A] text-white rounded-full text-xs font-semibold">
                <span className="w-4 h-4 rounded-full bg-white text-[#2D1E1A] flex items-center justify-center text-[10px] font-bold">1</span>
                Details
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E0CFC4] text-[#8A7265] rounded-full text-xs">
                <span className="w-4 h-4 rounded-full bg-[#E0CFC4] text-[#8A7265] flex items-center justify-center text-[10px] font-bold">2</span>
                Phases & Objectives
              </div>
            </div>
          </div>

          <style>{`
            @keyframes floatCard {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-8px); }
            }
          `}</style>
        </section>
      </div>
    );
  }

  // ── Step 2 render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden h-full">

      {/* Top nav */}
      <header className="shrink-0 h-14 bg-white border-b border-[#E0CFC4] flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-6">
          <span className="font-bold text-[#2D1E1A] text-sm">Steadily</span>
          <nav className="flex items-center gap-5 text-sm">
            <button onClick={() => setStep(1)} className="text-[#8A7265] hover:text-[#54433A] transition-colors">
              Project Info
            </button>
            <span className="text-[#2D1E1A] font-semibold border-b-2 border-[#2D1E1A] pb-px leading-none py-0.5">
              Phases & Objectives
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-1.5 text-sm text-[#54433A] hover:text-[#2D1E1A] rounded-lg hover:bg-[#F0E9E0] transition-all"
          >Back</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-5 py-1.5 bg-[#C4601A] text-white text-sm font-semibold rounded-lg hover:bg-[#C4601A] disabled:opacity-40 transition-all"
          >{saving ? 'Creating…' : 'Create Project'}</button>
        </div>
      </header>

      {saveError && (
        <div className="shrink-0 bg-[#ffdad6] border-b border-[#ffdad6] px-6 py-2 text-xs text-[#ba1a1a] flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {saveError}
        </div>
      )}

      {/* Main: sidebar + canvas */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: phase form cards */}
        <aside className="w-[420px] shrink-0 bg-white border-r border-[#E0CFC4] flex flex-col overflow-hidden">
          <div className="px-8 pt-7 pb-5 border-b border-[#E0CFC4] shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-[3px] w-8 bg-[#C4601A] rounded-full" />
              <span className="h-[3px] w-8 bg-[#C4601A] rounded-full" />
            </div>
            <p className="text-[11px] font-bold text-[#46645c] uppercase tracking-widest mb-1.5">Step 2 of 2</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#2D1E1A] tracking-tight">Phases &amp; Objectives</h2>
                <p className="text-sm text-[#8A7265] mt-1.5 leading-relaxed">
                  Map out the structure of your project — add phases and define their objectives.
                </p>
              </div>
              <button
                onClick={addPhase}
                className="mt-1 w-8 h-8 rounded-full bg-[#E8FAF7] text-[#46645c] hover:bg-[#FFE8D1] flex items-center justify-center transition-colors shrink-0"
                title="Add phase"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={sidebarRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {nodes.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-12 h-12 bg-[#F0E9E0] rounded-2xl mx-auto flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#8A7265]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#54433A]">No phases yet</p>
                <p className="text-xs text-[#8A7265] mt-1 max-w-[200px]">Click the + button above or use the button below to add your first phase.</p>
              </div>
            ) : (
              nodes.map((node, idx) => (
                <PhaseCard
                  key={node.id}
                  node={node}
                  phaseNum={idx + 1}
                  members={members}
                  onUpdate={updatePhaseField}
                  onRemove={removePhase}
                  onAddObjective={addObjective}
                  onUpdateObjective={updateObjective}
                  onUpdateObjectiveAssignee={updateObjectiveAssignee}
                  onRemoveObjective={removeObjective}
                />
              ))
            )}

            {/* Add phase button */}
            <button
              onClick={addPhase}
              className="w-full py-6 border-2 border-dashed border-[#E0CFC4] rounded-2xl flex flex-col items-center justify-center text-[#8A7265] hover:border-[#adcec3] hover:text-[#C4601A] transition-all group"
            >
              <svg className="w-7 h-7 mb-1.5 group-hover:scale-110 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Add New Phase Block</span>
            </button>
          </div>
        </aside>

        {/* Right: React Flow canvas */}
        <div className="flex-1 relative bg-[#FFF5E9]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as unknown as OnNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView={nodes.length > 0}
            deleteKeyCode="Delete"
            minZoom={0.35}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e2e8f0" />
            <Controls showInteractive={false} style={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 8 }} />
          </ReactFlow>

          {/* Empty canvas overlay */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white border-2 border-dashed border-[#E0CFC4] rounded-2xl mx-auto flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#BBA79C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#8A7265]">Add a phase to see it on the canvas</p>
                  <p className="text-xs text-[#BBA79C] mt-1">Drag the circle anchors between phase cards to create dependencies</p>
                </div>
              </div>
            </div>
          )}

          {/* Hint tooltip */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 border border-[#E0CFC4] rounded-full text-xs text-[#8A7265] shadow-sm pointer-events-none">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Drag anchor points to create dependencies · Press Delete to remove a connection
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Phase card (left sidebar) ─────────────────────────────────────────────────

interface PhaseCardProps {
  node: PhaseNodeType;
  phaseNum: number;
  members: { id: string; name: string }[];
  onUpdate: (id: string, field: keyof Pick<CPhase, 'title' | 'description' | 'dueDate'>, value: string) => void;
  onRemove: (id: string) => void;
  onAddObjective: (phaseId: string) => void;
  onUpdateObjective: (phaseId: string, objId: string, field: keyof Pick<CObjective, 'title' | 'description' | 'dueDate'>, value: string) => void;
  onUpdateObjectiveAssignee: (phaseId: string, objId: string, assigneeId: string, assigneeName: string) => void;
  onRemoveObjective: (phaseId: string, objId: string) => void;
}

function PhaseCard({ node, phaseNum, members, onUpdate, onRemove, onAddObjective, onUpdateObjective, onUpdateObjectiveAssignee, onRemoveObjective }: PhaseCardProps) {
  const ph = node.data.phase;

  return (
    <div data-node-id={node.id} className="bg-white border border-[#E0CFC4] rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 bg-[#FFF5E9] border-b border-[#E0CFC4] flex items-center justify-between">
        <span className="text-sm font-bold text-[#54433A] uppercase tracking-widest">
          Phase {String(phaseNum).padStart(2, '0')}
        </span>
        <button
          onClick={() => onRemove(node.id)}
          className="w-6 h-6 flex items-center justify-center text-[#BBA79C] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Fields */}
      <div className="px-4 pt-3 pb-2 space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#8A7265] mb-1">Phase Name</label>
          <input
            type="text"
            value={ph.title}
            onChange={e => onUpdate(node.id, 'title', e.target.value)}
            placeholder="e.g. Discovery & Research"
            className="w-full h-9 px-3 border border-[#E0CFC4] rounded-lg text-sm focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8A7265] mb-1">Description</label>
          <textarea
            rows={2}
            value={ph.description}
            onChange={e => onUpdate(node.id, 'description', e.target.value)}
            placeholder="What happens in this phase?"
            className="w-full px-3 py-2 border border-[#E0CFC4] rounded-lg text-xs resize-none focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8A7265] mb-1">Due Date</label>
          <input
            type="date"
            value={ph.dueDate}
            onChange={e => onUpdate(node.id, 'dueDate', e.target.value)}
            className="w-full h-9 px-3 border border-[#E0CFC4] rounded-lg text-xs focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all"
          />
        </div>
      </div>

      {/* Objectives */}
      <div className="border-t border-[#E0CFC4] px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold text-[#8A7265]">Objectives</span>
          <button
            onClick={() => onAddObjective(node.id)}
            className="text-[11px] text-[#46645c] hover:text-[#16342d] font-semibold flex items-center gap-1 transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 2a1 1 0 011 1v2h2a1 1 0 110 2H7v2a1 1 0 11-2 0V7H3a1 1 0 110-2h2V3a1 1 0 011-1z" />
            </svg>
            Add Objective
          </button>
        </div>

        {ph.objectives.length === 0 ? (
          <p className="text-xs text-[#BBA79C] italic py-1">No objectives yet.</p>
        ) : (
          <div className="space-y-2.5">
            {ph.objectives.map((obj, j) => (
              <ObjectiveRow
                key={obj.id}
                phaseId={node.id}
                obj={obj}
                idx={j}
                members={members}
                onUpdate={onUpdateObjective}
                onUpdateAssignee={onUpdateObjectiveAssignee}
                onRemove={onRemoveObjective}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Objective row ──────────────────────────────────────────────────────────────

function ObjectiveRow({ phaseId, obj, idx, members, onUpdate, onUpdateAssignee, onRemove }: {
  phaseId: string;
  obj: CObjective;
  idx: number;
  members: { id: string; name: string }[];
  onUpdate: (phaseId: string, objId: string, field: keyof Pick<CObjective, 'title' | 'description' | 'dueDate'>, value: string) => void;
  onUpdateAssignee: (phaseId: string, objId: string, assigneeId: string, assigneeName: string) => void;
  onRemove: (phaseId: string, objId: string) => void;
}) {
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openAssignee() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedH = 48 + Math.min(members.length + 1, 6) * 32;
    const top = window.innerHeight - rect.bottom < estimatedH
      ? rect.top - estimatedH - 4
      : rect.bottom + 4;
    setDropPos({ top, left: rect.left, width: Math.max(rect.width, 220) });
    setAssigneeSearch('');
    setAssigneeOpen(true);
  }

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  return (
    <div className="flex items-start gap-2 group">
      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] mt-2.5 shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <input
          type="text"
          value={obj.title}
          onChange={e => onUpdate(phaseId, obj.id, 'title', e.target.value)}
          placeholder={`Objective ${idx + 1}`}
          className="w-full h-8 px-2.5 border border-[#E0CFC4] rounded-lg text-xs focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
        />
        <textarea
          rows={2}
          value={obj.description}
          onChange={e => onUpdate(phaseId, obj.id, 'description', e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2.5 py-1.5 border border-[#E0CFC4] rounded-lg text-xs resize-none focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
        />
        <div className="flex gap-1.5">
          <input
            type="date"
            value={obj.dueDate}
            onChange={e => onUpdate(phaseId, obj.id, 'dueDate', e.target.value)}
            className="flex-1 h-7 px-2.5 border border-[#E0CFC4] rounded-lg text-xs focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all"
          />
          {members.length > 0 && (
            <div className="flex-1 min-w-0">
              <button
                ref={triggerRef}
                type="button"
                onClick={openAssignee}
                className="w-full h-7 flex items-center gap-1.5 px-2 border border-[#E0CFC4] rounded-lg text-xs text-[#54433A] bg-white hover:border-[#adcec3] transition-all min-w-0"
              >
                {obj.assigneeId && obj.assigneeName ? (
                  <AvatarCircle name={obj.assigneeName} size="xs" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#F0E9E0] border-2 border-dashed border-[#E0CFC4] shrink-0" />
                )}
                <span className="flex-1 text-left truncate min-w-0">{obj.assigneeName || 'Anyone'}</span>
                <svg className="w-3 h-3 text-[#BBA79C] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {assigneeOpen && createPortal(
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setAssigneeOpen(false)} />
                  <div
                    className="fixed z-[70] bg-white border border-[#E0CFC4] rounded-xl shadow-xl overflow-hidden"
                    style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
                  >
                    <div className="px-2.5 pt-2.5 pb-2 border-b border-[#E0CFC4]">
                      <div className="relative">
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8A7265] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                          autoFocus
                          value={assigneeSearch}
                          onChange={e => setAssigneeSearch(e.target.value)}
                          placeholder="Search members…"
                          className="w-full h-7 pl-6 pr-2.5 text-xs border border-[#E0CFC4] rounded-lg focus:outline-none focus:border-[#46645c]"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { onUpdateAssignee(phaseId, obj.id, '', ''); setAssigneeOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${!obj.assigneeId ? 'bg-[#E8FAF7] text-blue-700 font-medium' : 'text-[#8A7265] hover:bg-[#FFF5E9]'}`}
                      >
                        <div className="w-4 h-4 rounded-full bg-[#F0E9E0] border-2 border-dashed border-[#E0CFC4] shrink-0" />
                        Anyone
                      </button>
                      {filtered.length === 0 ? (
                        <p className="text-xs text-[#8A7265] text-center py-3 italic">No members found</p>
                      ) : filtered.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { onUpdateAssignee(phaseId, obj.id, m.id, m.name); setAssigneeOpen(false); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${obj.assigneeId === m.id ? 'bg-[#E8FAF7] text-blue-700 font-medium' : 'text-[#54433A] hover:bg-[#FFF5E9]'}`}
                        >
                          <AvatarCircle name={m.name} size="xs" />
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(phaseId, obj.id)}
        className="mt-2 text-[#BBA79C] hover:text-[#ba1a1a] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
