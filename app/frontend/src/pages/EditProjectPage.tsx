import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import {
  getProjects, updateProject, createPhase, updatePhase, deletePhase,
  createMilestone, updateMilestone, deleteMilestone, setDependencies,
  deleteProject,
} from '../api/client';
import type { Phase } from '../types';

// ── Local types ────────────────────────────────────────────────────────────────

interface EObjective {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
  isNew: boolean;
  completed: boolean;
}

interface EPhase {
  realId: string | null;
  title: string;
  description: string;
  dueDate: string;
  objectives: EObjective[];
  isExisting: boolean;
}

interface EPhaseNodeData extends Record<string, unknown> {
  phase: EPhase;
  phaseNum: number;
}

type EPhaseNodeType = Node<EPhaseNodeData, 'phaseNode'>;

// ── ID generator ───────────────────────────────────────────────────────────────

let _euid = 0;
function uid() { return `loc-${++_euid}-${Date.now()}`; }

// ── Avatar circle ─────────────────────────────────────────────────────────────

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

const PhaseNode = memo(function PhaseNode({ data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<EPhaseNodeType>) {
  const { phase, phaseNum } = data;
  const { setCenter } = useReactFlow();
  return (
    <div
      className={`w-80 bg-white rounded-2xl overflow-hidden shadow-xl border transition-all duration-150 ${selected ? 'border-[#46645c] shadow-blue-100/60' : 'border-[#E0CFC4] shadow-slate-200/60'}`}
      onClick={() => setCenter(positionAbsoluteX + 160, positionAbsoluteY + 90, { duration: 600 })}
    >
      <Handle type="source" position={Position.Top}    id="t" style={HS} />
      <Handle type="source" position={Position.Bottom} id="b" style={HS} />

      <div className="px-4 py-2.5 bg-[#FFF5E9] border-b border-[#E0CFC4] flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest">
          Phase {String(phaseNum).padStart(2, '0')}
        </span>
        <svg className="w-4 h-4 text-[#BBA79C]" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

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

      {phase.objectives.length > 0 && (
        <div className="px-4 pb-3 border-t border-[#E0CFC4] pt-2 space-y-2.5">
          {phase.objectives.slice(0, 3).map(obj => (
            <div key={obj.id} className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#54433A] font-medium truncate">{obj.title || <span className="text-[#BBA79C] italic">Untitled</span>}</p>
                {obj.description && <p className="text-[10px] text-[#8A7265] truncate mt-0.5">{obj.description}</p>}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {obj.dueDate && (
                    <span className="text-[10px] text-[#8A7265] flex items-center gap-0.5">
                      <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      {obj.dueDate}
                    </span>
                  )}
                  {obj.assigneeName && (
                    <span className="flex items-center gap-1">
                      <AvatarCircle name={obj.assigneeName} size="xs" />
                      <span className="text-[10px] text-[#54433A] font-medium">{obj.assigneeName}</span>
                    </span>
                  )}
                </div>
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

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user }  = useAuth();

  const [loading,     setLoading]    = useState(true);
  const [projectTitle, setProjectTitle] = useState('');
  const [step,        setStep]       = useState<1 | 2>((location.state as { step?: number } | null)?.step === 2 ? 2 : 1);
  const [form,        setForm]       = useState({ title: '', description: '', targetEndDate: '' });
  const [step1Error,  setStep1Error] = useState<string | null>(null);
  const [saving,      setSaving]     = useState(false);
  const [saveError,   setSaveError]  = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTyped,   setDeleteTyped]   = useState('');
  const [deleting,    setDeleting]   = useState(false);

  const originalPhasesRef = useRef<Phase[]>([]);
  const [members,    setMembers]   = useState<{ id: string; name: string }[]>([]);
  const [canAssign,  setCanAssign] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<EPhaseNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const el = sidebarRef.current?.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    getProjects()
      .then(all => {
        const found = all.find(p => p.id === id);
        if (!found) { navigate('/projects'); return; }
        setProjectTitle(found.title);
        setForm({ title: found.title, description: found.description ?? '', targetEndDate: found.targetEndDate ?? '' });
        // Viewers cannot be assigned — filter them out of the assignee picker.
        const assignableMembers = (found.members ?? []).filter((m: { role: string }) => m.role !== 'viewer');
        setMembers(assignableMembers.map((m: { user: { id: string; name: string } }) => ({ id: m.user.id, name: m.user.name })));
        // Only owner or contributor-with-canApprove can set assignments.
        const myEntry = (found.members ?? []).find((m: { user: { id: string }; role: string; canApprove: boolean }) => m.user.id === user?.id);
        const myCanAssign = myEntry?.role === 'owner' || (myEntry?.role === 'contributor' && myEntry?.canApprove);
        setCanAssign(!!myCanAssign);

        const sorted = [...found.phases].sort((a, b) => a.order - b.order);
        originalPhasesRef.current = sorted;

        // Restore saved canvas layout from localStorage (positions + edges)
        const storageKey = `steadily-canvas-${id}`;
        let stored: { positions?: Record<string, { x: number; y: number }>; edges?: { source: string; target: string }[] } | null = null;
        try { stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); } catch { /* ignore */ }

        setNodes(sorted.map((ph, i) => {
          const savedPos = stored?.positions?.[ph.id];
          return {
            id: ph.id,
            type: 'phaseNode',
            position: savedPos ?? { x: 80 + (i % 3) * 360, y: 80 + Math.floor(i / 3) * 280 },
            data: {
              phase: {
                realId: ph.id,
                title: ph.title,
                description: ph.description ?? '',
                dueDate: ph.dueDate ?? '',
                objectives: [...ph.milestones].sort((a, b) => a.order - b.order).map(m => ({
                  id: m.id,
                  title: m.title,
                  description: m.description ?? '',
                  dueDate: m.dueDate ?? '',
                  assigneeId: m.assignees?.[0]?.id ?? '',
                  assigneeName: m.assignees?.[0]?.name ?? '',
                  isNew: false,
                  completed: m.completed,
                })),
                isExisting: true,
              },
              phaseNum: i + 1,
            },
          };
        }));

        // Prefer stored edges; fall back to backend dependencies
        const storedEdges = stored?.edges;
        if (storedEdges && storedEdges.length > 0) {
          setEdges(storedEdges.map(e => ({
            id: `${e.source}→${e.target}`,
            source: e.source,
            target: e.target,
            type: 'phaseEdge',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 14, height: 14 },
          })));
        } else {
          setEdges(sorted.flatMap(ph =>
            (ph.dependencies ?? []).map(dep => ({
              id: `${dep.dependsOnId}→${ph.id}`,
              source: dep.dependsOnId,
              target: ph.id,
              type: 'phaseEdge',
              animated: false,
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 14, height: 14 },
            }))
          ));
        }

        setLoading(false);
      })
      .catch(() => navigate('/projects'));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      const t = setTimeout(() => rfInstance.fitView({ padding: 0.2, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
  }, [nodes.length, rfInstance]);

  // ── Phase mutations ────────────────────────────────────────────────────────

  function addPhase() {
    const tempId = uid();
    const col = nodes.length % 3;
    const row = Math.floor(nodes.length / 3);
    setNodes(prev => [...prev, {
      id: tempId,
      type: 'phaseNode',
      position: { x: 80 + col * 360, y: 80 + row * 280 },
      data: {
        phase: { realId: null, title: '', description: '', dueDate: '', objectives: [], isExisting: false },
        phaseNum: prev.length + 1,
      },
    }]);
  }

  function updatePhaseField(nodeId: string, field: keyof Pick<EPhase, 'title' | 'description' | 'dueDate'>, value: string) {
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, [field]: value } } }
        : n
    ));
  }

  function removePhase(nodeId: string) {
    setNodes(prev =>
      prev.filter(n => n.id !== nodeId).map((n, i) => ({ ...n, data: { ...n.data, phaseNum: i + 1 } }))
    );
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }

  function addObjective(nodeId: string) {
    const objId = uid();
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: [...n.data.phase.objectives, { id: objId, title: '', description: '', dueDate: '', assigneeId: '', assigneeName: '', isNew: true, completed: false }] } } }
        : n
    ));
  }

  function updateObjective(nodeId: string, objId: string, field: keyof Pick<EObjective, 'title' | 'description' | 'dueDate' | 'assigneeId' | 'assigneeName'>, value: string) {
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.map(o => o.id === objId ? { ...o, [field]: value } : o) } } }
        : n
    ));
  }

  function removeObjective(nodeId: string, objId: string) {
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.filter(o => o.id !== objId) } } }
        : n
    ));
  }

  function updateObjectiveAssignee(nodeId: string, objId: string, assigneeId: string, assigneeName: string) {
    setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, phase: { ...n.data.phase, objectives: n.data.phase.objectives.map(o => o.id === objId ? { ...o, assigneeId, assigneeName } : o) } } }
        : n
    ));
  }

  const onConnect = useCallback((connection: Connection) => {
    setEdges(prev => addEdge({
      ...connection,
      type: 'phaseEdge',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 14, height: 14 },
    }, prev));
  }, [setEdges]);

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim()) { setSaveError('Project name is required.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await updateProject(id!, {
        title: form.title.trim(),
        description: form.description || null,
        targetEndDate: form.targetEndDate || null,
      });

      const sortedNodes = [...nodes].sort((a, b) => a.data.phaseNum - b.data.phaseNum);
      const realIdMap = new Map<string, string>(); // nodeId → real phase DB id

      // Delete phases that were removed
      const currentNodeIds = new Set(nodes.map(n => n.id));
      for (const origPh of originalPhasesRef.current) {
        if (!currentNodeIds.has(origPh.id)) {
          await deletePhase(origPh.id);
        }
      }

      // Create/update phases
      for (let i = 0; i < sortedNodes.length; i++) {
        const n = sortedNodes[i];
        const pd = n.data.phase;
        if (pd.isExisting && pd.realId) {
          await updatePhase(pd.realId, { title: pd.title.trim() || 'Untitled', description: pd.description || undefined, dueDate: pd.dueDate || undefined, order: i + 1 });
          realIdMap.set(n.id, pd.realId);
        } else {
          const created = await createPhase(id!, pd.title.trim() || 'Untitled', i + 1, pd.description || undefined, pd.dueDate || undefined);
          realIdMap.set(n.id, created.id);
        }
      }

      // Handle objectives per phase
      for (const n of sortedNodes) {
        const pd = n.data.phase;
        const realPhaseId = realIdMap.get(n.id)!;
        const origPhase = originalPhasesRef.current.find(p => p.id === pd.realId);
        const origMsIds = origPhase?.milestones.map(m => m.id) ?? [];
        const currExistingIds = pd.objectives.filter(o => !o.isNew).map(o => o.id);

        // Delete removed milestones
        for (const oid of origMsIds) {
          if (!currExistingIds.includes(oid)) {
            await deleteMilestone(oid);
          }
        }

        // Create/update objectives
        for (let j = 0; j < pd.objectives.length; j++) {
          const obj = pd.objectives[j];
          const assigneeIds = obj.assigneeId ? [obj.assigneeId] : [];
          if (!obj.isNew) {
            await updateMilestone(obj.id, { title: obj.title.trim() || 'Untitled', description: obj.description || undefined, dueDate: obj.dueDate || undefined, order: j + 1, assigneeIds: assigneeIds.length ? assigneeIds : undefined });
          } else if (obj.title.trim()) {
            await createMilestone(realPhaseId, obj.title.trim(), j + 1, obj.dueDate || undefined, assigneeIds.length ? assigneeIds : undefined, obj.description || undefined);
          }
        }
      }

      // Set dependencies from edges (skip gracefully if endpoint not yet deployed)
      let depsSkipped = false;
      for (const [nodeId, realId] of realIdMap) {
        if (depsSkipped) break;
        const deps = edges
          .filter(e => e.target === nodeId)
          .map(e => realIdMap.get(e.source))
          .filter(Boolean) as string[];
        try {
          await setDependencies(realId, deps);
        } catch (e) {
          const status = (e as { response?: { status?: number } })?.response?.status;
          if (status === 404) { depsSkipped = true; break; }
          throw e;
        }
      }

      // Persist canvas layout (positions + edges) to localStorage
      const posMap: Record<string, { x: number; y: number }> = {};
      for (const node of nodes) {
        const realId = realIdMap.get(node.id) ?? node.id;
        posMap[realId] = node.position;
      }
      const edgeList = edges.map(e => ({
        source: realIdMap.get(e.source) ?? e.source,
        target: realIdMap.get(e.target) ?? e.target,
      }));
      localStorage.setItem(`steadily-canvas-${id}`, JSON.stringify({ positions: posMap, edges: edgeList }));

      navigate(`/projects/${id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const deleteTarget = `delete ${form.title}`;

  async function handleDelete() {
    if (deleteTyped.trim().toLowerCase() !== deleteTarget.toLowerCase()) return;
    setDeleting(true);
    try {
      await deleteProject(id!);
      localStorage.removeItem(`steadily-canvas-${id}`);
      navigate('/projects');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function goToStep2() {
    if (!form.title.trim()) { setStep1Error('Project name is required.'); return; }
    setStep1Error(null);
    setStep(2);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-sm text-[#8A7265]">Loading project…</div>
    </div>
  );

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="flex overflow-hidden bg-white h-full">

        {/* Left: form panel */}
        <section className="w-[460px] shrink-0 border-r border-[#E0CFC4] flex flex-col">
          <div className="px-8 pt-8 pb-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-[3px] w-8 bg-[#C4601A] rounded-full" />
              <span className="h-[3px] w-8 bg-[#E0CFC4] rounded-full" />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[11px] font-bold text-[#46645c] uppercase tracking-widest">Step 1 of 2</p>
              <span className="text-[11px] text-[#BBA79C]">·</span>
              <span className="text-[11px] text-[#8A7265] font-medium truncate max-w-[180px]">{projectTitle}</span>
            </div>
            <h2 className="text-2xl font-bold text-[#2D1E1A] tracking-tight">Edit Project</h2>
            <p className="text-sm text-[#8A7265] mt-2 leading-relaxed">
              Update the core details of your project.
            </p>
          </div>

          <div className="px-8 flex-1 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-[#54433A] mb-1.5">Project Name</label>
              <input
                autoFocus
                type="text"
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
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Briefly describe the objectives and scope of this project..."
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

            {/* Danger zone */}
            <div className="pt-2 border-t border-[#E0CFC4]">
              <label className="block text-xs font-semibold text-[#ba1a1a] mb-2 uppercase tracking-widest">Danger Zone</label>
              {!confirmDelete ? (
                <button
                  onClick={() => { setDeleteTyped(''); setConfirmDelete(true); }}
                  className="text-xs text-[#ba1a1a] hover:text-[#93000a] hover:bg-[#ffdad6] px-3 py-2 rounded-lg border border-[#ffdad6] transition-colors"
                >
                  Delete this project
                </button>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#8A7265]">
                    To confirm, type{' '}
                    <span className="font-mono text-[#ba1a1a] bg-[#ffdad6] px-1.5 py-0.5 rounded">{deleteTarget}</span>{' '}
                    below.
                  </p>
                  <input
                    autoFocus
                    className="w-full border border-[#E0CFC4] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ffdad6] font-mono"
                    placeholder={deleteTarget}
                    value={deleteTyped}
                    onChange={e => setDeleteTyped(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleDelete()}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleteTyped.trim().toLowerCase() !== deleteTarget.toLowerCase() || deleting}
                      className="text-xs bg-[#ba1a1a] text-white hover:bg-[#93000a] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 font-medium"
                    >{deleting ? 'Deleting…' : 'Delete this project'}</button>
                    <button onClick={() => { setConfirmDelete(false); setDeleteTyped(''); }} className="text-xs text-[#8A7265] hover:text-[#54433A]">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 pt-5 pb-8 shrink-0">
            {step1Error && <p className="text-xs text-[#ba1a1a] mb-3">{step1Error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/projects/${id}`)}
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
                {[['Status', 'On track'], ['Phases', String(nodes.length)], ['Progress', '—']].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] text-[#8A7265] uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xs font-semibold text-[#54433A]">{val}</p>
                  </div>
                ))}
              </div>
            </div>

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

  // ── Step 2 ─────────────────────────────────────────────────────────────────

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
          {saveError && <p className="text-xs text-[#ba1a1a]">{saveError}</p>}
          <button
            onClick={() => setStep(1)}
            className="px-4 py-1.5 text-sm text-[#54433A] hover:text-[#2D1E1A] rounded-lg hover:bg-[#F0E9E0] transition-all"
          >Back</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 bg-[#C4601A] text-white text-sm font-semibold rounded-lg hover:bg-[#C4601A] disabled:opacity-40 transition-all"
          >{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </header>

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
                  Adjust phases and objectives — changes will be saved to your project.
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
                <p className="text-xs text-[#8A7265] mt-1 max-w-[200px]">Click the + button to add your first phase.</p>
              </div>
            ) : (
              nodes.map((node, idx) => (
                <EditPhaseCard
                  key={node.id}
                  node={node}
                  phaseNum={idx + 1}
                  members={members}
                  canAssign={canAssign}
                  onUpdate={updatePhaseField}
                  onRemove={removePhase}
                  onAddObjective={addObjective}
                  onUpdateObjective={updateObjective}
                  onUpdateObjectiveAssignee={updateObjectiveAssignee}
                  onRemoveObjective={removeObjective}
                />
              ))
            )}

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

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-white border-2 border-dashed border-[#E0CFC4] rounded-2xl mx-auto flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#BBA79C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#8A7265]">Add a phase to see it on the canvas</p>
                <p className="text-xs text-[#BBA79C]">Drag the circle anchors to create dependencies</p>
              </div>
            </div>
          )}

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

interface EditPhaseCardProps {
  node: EPhaseNodeType;
  phaseNum: number;
  members: { id: string; name: string }[];
  canAssign: boolean;
  onUpdate: (id: string, field: keyof Pick<EPhase, 'title' | 'description' | 'dueDate'>, value: string) => void;
  onRemove: (id: string) => void;
  onAddObjective: (phaseId: string) => void;
  onUpdateObjective: (phaseId: string, objId: string, field: keyof Pick<EObjective, 'title' | 'description' | 'dueDate' | 'assigneeId' | 'assigneeName'>, value: string) => void;
  onUpdateObjectiveAssignee: (phaseId: string, objId: string, assigneeId: string, assigneeName: string) => void;
  onRemoveObjective: (phaseId: string, objId: string) => void;
}

function EditPhaseCard({ node, phaseNum, members, canAssign, onUpdate, onRemove, onAddObjective, onUpdateObjective, onUpdateObjectiveAssignee, onRemoveObjective }: EditPhaseCardProps) {
  const ph = node.data.phase;

  return (
    <div data-node-id={node.id} className="bg-white border border-[#E0CFC4] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 bg-[#FFF5E9] border-b border-[#E0CFC4] flex items-center justify-between">
        <span className="text-sm font-bold text-[#54433A] uppercase tracking-widest">
          Phase {String(phaseNum).padStart(2, '0')}
          {ph.isExisting && <span className="ml-2 text-[#46645c]">existing</span>}
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
              <EditObjectiveRow
                key={obj.id}
                nodeId={node.id}
                obj={obj}
                idx={j}
                members={members}
                canAssign={canAssign}
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

function EditObjectiveRow({ nodeId, obj, idx, members, canAssign, onUpdate, onUpdateAssignee, onRemove }: {
  nodeId: string;
  obj: EObjective;
  idx: number;
  members: { id: string; name: string }[];
  canAssign: boolean;
  onUpdate: (nodeId: string, objId: string, field: keyof Pick<EObjective, 'title' | 'description' | 'dueDate'>, value: string) => void;
  onUpdateAssignee: (nodeId: string, objId: string, assigneeId: string, assigneeName: string) => void;
  onRemove: (nodeId: string, objId: string) => void;
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
      {obj.completed ? (
        <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 mt-2.5 shrink-0 flex items-center justify-center" title="Completed">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] mt-2.5 shrink-0" title="Not completed" />
      )}
      <div className="flex-1 space-y-1.5 min-w-0">
        <input
          type="text"
          value={obj.title}
          onChange={e => onUpdate(nodeId, obj.id, 'title', e.target.value)}
          placeholder={`Objective ${idx + 1}`}
          className="w-full h-8 px-2.5 border border-[#E0CFC4] rounded-lg text-xs focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
        />
        <textarea
          rows={2}
          value={obj.description}
          onChange={e => onUpdate(nodeId, obj.id, 'description', e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2.5 py-1.5 border border-[#E0CFC4] rounded-lg text-xs resize-none focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all placeholder:text-[#BBA79C]"
        />
        <div className="flex gap-1.5">
          <input
            type="date"
            value={obj.dueDate}
            onChange={e => onUpdate(nodeId, obj.id, 'dueDate', e.target.value)}
            className="flex-1 h-7 px-2.5 border border-[#E0CFC4] rounded-lg text-xs focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] transition-all"
          />
          {canAssign && members.length > 0 && (
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
                    {/* Search */}
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
                    {/* Options */}
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { onUpdateAssignee(nodeId, obj.id, '', ''); setAssigneeOpen(false); }}
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
                          onClick={() => { onUpdateAssignee(nodeId, obj.id, m.id, m.name); setAssigneeOpen(false); }}
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
        onClick={() => onRemove(nodeId, obj.id)}
        className="mt-2 text-[#BBA79C] hover:text-[#ba1a1a] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
