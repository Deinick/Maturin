import { useEffect, useState, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Milestone, Phase, ProjectMember, PendingChange, MemberPerformance } from '../types';
import {
  getProjects, updateMilestone, getProjectInsights,
  getPendingChanges, setMemberPermission, getProjectPerformance,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import InviteModal         from '../components/InviteModal';
import PendingChangesModal from '../components/PendingChangesModal';
import Modal                from '../components/Modal';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  getBezierPath,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Kanban } from '@/components/animate-ui/icons/kanban';
import { Expand } from '@/components/animate-ui/icons/expand';
import { Check } from '@/components/animate-ui/icons/check';
import { Lock } from '@/components/animate-ui/icons/lock';
import { ChevronRight } from '@/components/animate-ui/icons/chevron-right';

type Tab = 'overview' | 'team';

type MilestoneWithPhase = Milestone & {
  phaseId: string;
  phaseName: string;
  phaseLocked: boolean;
  blockingPhaseNames: string[];
};

function isPhaseComplete(ph: Phase): boolean {
  return ph.milestones.length === 0 || ph.milestones.every(m => m.completed);
}

function getLockedPhaseIds(phases: Phase[]): Set<string> {
  const locked = new Set<string>();
  for (const ph of phases) {
    if (ph.dependencies && ph.dependencies.length > 0) {
      const blocked = ph.dependencies.some(dep => {
        const dep_ph = phases.find(p => p.id === dep.dependsOnId);
        return dep_ph ? !isPhaseComplete(dep_ph) : false;
      });
      if (blocked) locked.add(ph.id);
    }
  }
  return locked;
}

function getBlockingPhaseNames(ph: Phase, phases: Phase[]): string[] {
  return (ph.dependencies ?? [])
    .filter(dep => {
      const dep_ph = phases.find(p => p.id === dep.dependsOnId);
      return dep_ph && !isPhaseComplete(dep_ph);
    })
    .map(dep => phases.find(p => p.id === dep.dependsOnId)?.title ?? 'Unknown phase');
}

function getCanvasEdges(projectId: string, phases: Phase[]): { source: string; target: string }[] {
  try {
    const stored = JSON.parse(localStorage.getItem(`steadily-canvas-${projectId}`) ?? 'null');
    if (stored?.edges?.length > 0) return stored.edges;
  } catch { /* ignore */ }
  return phases.flatMap(ph => (ph.dependencies ?? []).map(dep => ({ source: dep.dependsOnId, target: ph.id })));
}

function computeTracePath(targetId: string, phases: Phase[], edges: { source: string; target: string }[]): Phase[] {
  const edgeMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
    edgeMap.get(e.target)!.push(e.source);
  }
  const inChain = new Set<string>([targetId]);
  const queue = [targetId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const s of edgeMap.get(curr) ?? []) {
      if (!inChain.has(s)) { inChain.add(s); queue.push(s); }
    }
  }
  const phaseMap = new Map(phases.map(p => [p.id, p]));
  const visited = new Set<string>();
  const sorted: Phase[] = [];
  function dfs(id: string) {
    if (visited.has(id) || !inChain.has(id)) return;
    visited.add(id);
    for (const s of edgeMap.get(id) ?? []) dfs(s);
    const ph = phaseMap.get(id);
    if (ph) sorted.push(ph);
  }
  for (const id of inChain) dfs(id);
  return sorted; // topological: prerequisites first, target last
}

type VelocityData =
  | { available: false }
  | {
      available: true;
      weeksElapsed: number;
      completedCount: number;
      actualPerWeek: number;
      plannedPerWeek: number | null;
      remainingCount: number;
      revisedFinishDate: string | null;
      targetFinishDate: string | null;
    };

interface Insights {
  healthScore: number;
  velocity: VelocityData;
}

const TODAY = new Date().toISOString().split('T')[0];

const BLOCK_OPTIONS: { value: 'no_time' | 'unclear' | 'external' | 'motivation'; label: string; icon: string }[] = [
  { value: 'no_time',    label: 'Not enough time',     icon: '⏱' },
  { value: 'unclear',   label: 'Unclear next step',    icon: '❓' },
  { value: 'external',  label: 'Waiting on something', icon: '⏳' },
  { value: 'motivation',label: 'Lost motivation',      icon: '😶' },
];

const EFFORT_OPTIONS: { value: 'easier' | 'as_expected' | 'harder'; label: string; color: string }[] = [
  { value: 'easier',      label: 'Easier',      color: 'bg-[#c8eadf] text-[#16342d] hover:bg-[#adcec3]' },
  { value: 'as_expected', label: 'About right', color: 'bg-[#c8eadf] text-[#16342d] hover:bg-[#adcec3]' },
  { value: 'harder',      label: 'Harder',      color: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
];

const BLOCK_LABELS: Record<string, string> = {
  no_time: 'Not enough time', unclear: 'Unclear next step',
  external: 'Waiting on something', motivation: 'Lost motivation',
};

const MEMBER_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500',
];

function memberColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [project,          setProject]         = useState<Project | null>(null);
  const [insights,         setInsights]        = useState<Insights | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPhase | null>(null);
  const [milestoneCache,   setMilestoneCache]   = useState<MilestoneWithPhase | null>(null);
  const [effortPending,    setEffortPending]   = useState<string | null>(null);

  // Keep rendering the last-selected milestone's data while the modal fades out,
  // so the close animation doesn't try to read fields off a null value mid-transition.
  useEffect(() => { if (selectedMilestone) setMilestoneCache(selectedMilestone); }, [selectedMilestone]);

  const [editMode,        setEditMode]        = useState(false);
  const [editFields,      setEditFields]      = useState({ title: '', description: '', dueDate: '' });
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editSaving,      setEditSaving]      = useState(false);
  const [editResult,      setEditResult]      = useState<'saved' | 'pending' | null>(null);

  const [activeTab,        setActiveTab]       = useState<Tab>('overview');
  const [canvasExpanded,   setCanvasExpanded]  = useState(false);
  const [showInvite,       setShowInvite]      = useState(false);
  const [showPending,      setShowPending]     = useState(false);
  const [pendingChanges,   setPendingChanges]  = useState<PendingChange[]>([]);
  const [performance,      setPerformance]     = useState<MemberPerformance[] | null>(null);
  const [phaseDetail,      setPhaseDetail]     = useState<ONodeData | null>(null);
  const [phaseDetailCache, setPhaseDetailCache]= useState<ONodeData | null>(null);
  const [tracePathChain,   setTracePathChain]  = useState<Phase[] | null>(null);

  // Same rationale as milestoneCache: keep the last-selected phase's data around
  // while the modal fades out, so the exit animation isn't reading fields off null.
  useEffect(() => { if (phaseDetail) setPhaseDetailCache(phaseDetail); }, [phaseDetail]);


  const myMemberData = project?.members?.find(m => m.user.id === user?.id);
  const myRole       = myMemberData?.role ?? 'viewer';
  const myCanApprove = myMemberData?.canApprove ?? false;
  const canAssign    = myRole === 'owner' || (myRole === 'contributor' && myCanApprove);

  function refreshPending(role: string, canApprove: boolean) {
    if (role === 'owner' || (role === 'contributor' && canApprove)) {
      getPendingChanges(id!).then(list => {
        setPendingChanges(list);
        if (list.length > 0) setShowPending(true);
      }).catch(() => setPendingChanges([]));
    }
  }

  const { data: allProjects }    = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const { data: insightsData }   = useQuery({ queryKey: ['projectInsights', id], queryFn: () => getProjectInsights(id!), enabled: !!id });

  // project/insights are local editable copies (optimistic milestone edits, etc.) seeded
  // from the cached query data, so this sync can't be expressed as derived render state.
  useEffect(() => {
    if (!allProjects) return;
    const found = allProjects.find(p => p.id === id);
    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProject(found);
      const me = found.members?.find(m => m.user.id === user?.id);
      if (me) refreshPending(me.role, me.canApprove);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjects, id]);

  useEffect(() => {
    if (insightsData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInsights(insightsData);
    }
  }, [insightsData]);

  useEffect(() => {
    if (activeTab !== 'team' || !canAssign) return;
    getProjectPerformance(id!).then(setPerformance).catch(() => setPerformance(null));
  }, [activeTab, canAssign, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleMilestone(m: MilestoneWithPhase) {
    const next = !m.completed;
    setProject(prev => prev ? {
      ...prev,
      phases: prev.phases.map(ph =>
        ph.id === m.phaseId
          ? { ...ph, milestones: ph.milestones.map(ms => ms.id === m.id ? { ...ms, completed: next } : ms) }
          : ph
      )
    } : prev);
    setSelectedMilestone(prev => prev?.id === m.id ? { ...prev, completed: next } : prev);
    if (next) setEffortPending(m.id);
    try {
      const result = await updateMilestone(m.id, { completed: next });
      const updatedMs = result.applied ? result.data : null;
      if (updatedMs) {
        setProject(prev => prev ? {
          ...prev,
          phases: prev.phases.map(ph =>
            ph.id === m.phaseId
              ? { ...ph, milestones: ph.milestones.map(ms => ms.id === m.id ? { ...ms, ...updatedMs } : ms) }
              : ph
          )
        } : prev);
        setSelectedMilestone(prev => prev?.id === m.id ? { ...prev, ...updatedMs } : prev);
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    } catch {
      setProject(prev => prev ? {
        ...prev,
        phases: prev.phases.map(ph =>
          ph.id === m.phaseId
            ? { ...ph, milestones: ph.milestones.map(ms => ms.id === m.id ? { ...ms, completed: !next } : ms) }
            : ph
        )
      } : prev);
      setSelectedMilestone(prev => prev?.id === m.id ? { ...prev, completed: !next } : prev);
      if (next) setEffortPending(null);
    }
  }

  async function handleEffortRating(milestoneId: string, rating: 'easier' | 'as_expected' | 'harder') {
    setEffortPending(null);
    await updateMilestone(milestoneId, { effortRating: rating });
    setProject(prev => prev ? {
      ...prev,
      phases: prev.phases.map(ph => ({
        ...ph,
        milestones: ph.milestones.map(ms => ms.id === milestoneId ? { ...ms, effortRating: rating } : ms),
      }))
    } : prev);
    setSelectedMilestone(null);
  }

  async function handleBlockReason(milestoneId: string, reason: 'no_time' | 'unclear' | 'external' | 'motivation') {
    await updateMilestone(milestoneId, { blockReason: reason });
    setProject(prev => prev ? {
      ...prev,
      phases: prev.phases.map(ph => ({
        ...ph,
        milestones: ph.milestones.map(ms => ms.id === milestoneId ? { ...ms, blockReason: reason } : ms),
      }))
    } : prev);
    setSelectedMilestone(prev => prev?.id === milestoneId ? { ...prev, blockReason: reason } : prev);
  }

  function selectMilestone(m: MilestoneWithPhase | null) {
    setSelectedMilestone(m);
    setEditMode(false);
    setEditResult(null);
  }

  function enterEditMode() {
    if (!selectedMilestone) return;
    setEditFields({
      title: selectedMilestone.title,
      description: selectedMilestone.description ?? '',
      dueDate: selectedMilestone.dueDate ?? '',
    });
    setEditAssigneeIds((selectedMilestone.assignees ?? []).map(a => a.id));
    setEditResult(null);
    setEditMode(true);
  }

  async function handleEditSave() {
    if (!selectedMilestone) return;
    setEditSaving(true);
    try {
      const result = await updateMilestone(selectedMilestone.id, {
        title: editFields.title.trim() || selectedMilestone.title,
        description: editFields.description.trim() || null,
        dueDate: editFields.dueDate || null,
        assigneeIds: editAssigneeIds,
      });
      if (result.applied) {
        const updated: MilestoneWithPhase = {
          ...selectedMilestone,
          ...result.data,
          phaseId: selectedMilestone.phaseId,
          phaseName: selectedMilestone.phaseName,
        };
        setProject(prev => prev ? {
          ...prev,
          phases: prev.phases.map(ph =>
            ph.id === selectedMilestone.phaseId
              ? { ...ph, milestones: ph.milestones.map(ms => ms.id === selectedMilestone.id ? result.data : ms) }
              : ph
          ),
        } : prev);
        setSelectedMilestone(updated);
        setEditMode(false);
        setEditResult('saved');
      } else {
        setEditMode(false);
        setEditResult('pending');
      }
    } catch {
      // leave edit mode open so user can retry
    } finally {
      setEditSaving(false);
    }
  }

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-[#8A7265] text-sm">Loading…</div>
  );

  const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);
  const lockedPhaseIds = getLockedPhaseIds(sortedPhases);

  const allMilestones: MilestoneWithPhase[] = sortedPhases.flatMap(ph => {
    const locked = lockedPhaseIds.has(ph.id);
    const blockingPhaseNames = locked ? getBlockingPhaseNames(ph, sortedPhases) : [];
    return [...ph.milestones].sort((a, b) => a.order - b.order).map(m => ({
      ...m, phaseId: ph.id, phaseName: ph.title, phaseLocked: locked, blockingPhaseNames,
    }));
  });

  const totalMilestones  = allMilestones.length;
  const completedCount   = allMilestones.filter(m => m.completed).length;
  const remainingCount   = totalMilestones - completedCount;
  const pct              = totalMilestones === 0 ? 0 : Math.round(completedCount / totalMilestones * 100);
  const totalPhases      = sortedPhases.length;
  const completedPhases  = sortedPhases.filter(ph => ph.milestones.length > 0 && ph.milestones.every(m => m.completed)).length;

  const nextDueMilestone = allMilestones.find(m => !m.completed && !m.phaseLocked && m.dueDate);
  // Active phase: first non-locked phase with incomplete milestones
  const activePhase      = sortedPhases.find(ph => !lockedPhaseIds.has(ph.id) && ph.milestones.some(m => !m.completed));

  const canEdit = myRole === 'owner' || myRole === 'contributor';
  const isOwner = myRole === 'owner';

  const healthScore = insights?.healthScore ?? null;
  const healthBg    = healthScore === null ? 'bg-[#FFF5E9] border-[#E0CFC4] text-[#8A7265]'
    : healthScore >= 70 ? 'bg-[#E8FAF7] border-[#c8eadf] text-[#4C8077]'
    : healthScore >= 40 ? 'bg-amber-50 border-amber-200 text-amber-600'
    : 'bg-[#ffdad6] border-[#ffdad6] text-[#ba1a1a]';

  const vel         = insights?.velocity;
  const showVelocity = vel?.available === true;

  const daysLeft = project.targetEndDate
    ? Math.ceil((new Date(project.targetEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const overdueCount = allMilestones.filter(m => !m.completed && m.dueDate && m.dueDate < TODAY).length;

  const statusLabel = pct === 100 || project.completed ? 'Completed'
    : overdueCount > 0 ? 'At Risk'
    : completedCount > 0 ? 'In Progress'
    : 'Not Started';
  const statusStyle = pct === 100 || project.completed ? 'bg-[#c8eadf] text-[#16342d] border-[#c8eadf]'
    : overdueCount > 0 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : completedCount > 0 ? 'bg-blue-100 text-blue-700 border-[#c8eadf]'
    : 'bg-[#F0E9E0] text-[#54433A] border-[#E0CFC4]';

  // Kanban columns
  const activePhaseMilestones = activePhase
    ? allMilestones.filter(m => m.phaseId === activePhase.id && !m.completed)
    : [];
  // "To Do" = all incomplete milestones not in the active phase (locked ones included, shown differently)
  const upcomingMilestones = allMilestones.filter(m => {
    if (m.completed) return false;
    if (activePhase && m.phaseId === activePhase.id) return false;
    return true;
  }).slice(0, 9);
  const recentlyDone = [...allMilestones]
    .filter(m => m.completed)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5);

  // Activity feed: pending changes + recently completed milestones
  const activityItems: { type: 'change' | 'complete'; label: string; sub: string; date: string }[] = [
    ...pendingChanges.slice(0, 3).map(c => ({
      type: 'change' as const,
      label: `${c.author.name} changed ${Object.keys(c.newData)[0]} on ${c.entityLabel}`,
      sub: 'Pending review',
      date: c.createdAt,
    })),
    ...recentlyDone.filter(m => m.completedAt).map(m => ({
      type: 'complete' as const,
      label: m.title,
      sub: m.phaseName,
      date: m.completedAt!,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div>

      {/* ── Project Header ───────────────────────────────────── */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-[#8A7265] hover:text-[#54433A] mb-4 transition-colors"
        >
          ← Projects
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif leading-tight">{project.title}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${statusStyle}`}>
                {statusLabel}
              </span>
              {healthScore !== null && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${healthBg}`}>
                  {healthScore} health
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-[#8A7265] leading-relaxed max-w-2xl">{project.description}</p>
            )}
          </div>

          {/* Team avatars + actions */}
          <div className="flex items-center gap-3 shrink-0">
            {project.members && project.members.length > 0 && (
              <div className="flex items-center -space-x-2">
                {project.members.slice(0, 4).map(m => (
                  <div key={m.id}
                    title={m.user.name}
                    className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold shrink-0 ${memberColor(m.user.name)}`}
                  >
                    {m.user.name[0]?.toUpperCase()}
                  </div>
                ))}
                {project.members.length > 4 && (
                  <div className="w-9 h-9 rounded-full border-2 border-white bg-[#E0CFC4] flex items-center justify-center text-[#54433A] text-xs font-semibold shrink-0">
                    +{project.members.length - 4}
                  </div>
                )}
              </div>
            )}

            {pendingChanges.length > 0 && (
              <button
                onClick={() => setShowPending(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] font-bold">!</span>
                {pendingChanges.length} pending
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => navigate(`/projects/${id}/edit`)}
                className="flex items-center gap-1.5 text-sm text-[#8A7265] hover:text-[#C4601A] hover:bg-[#FFF5E9] px-3 py-1.5 rounded-lg border border-[#E0CFC4] hover:border-[#c8eadf] transition-colors"
              >
                ✎ Edit
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 text-sm text-[#8A7265] hover:text-[#4C8077] hover:bg-[#FFF5E9] px-3 py-1.5 rounded-lg border border-[#E0CFC4] hover:border-[#c8eadf] transition-colors"
              >
                + Invite
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className="flex items-end gap-6 border-b border-[#E0CFC4] mb-6">
        {(['overview', 'team'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#2D1E1A] text-[#2D1E1A]'
                : 'border-transparent text-[#8A7265] hover:text-[#54433A]'
            }`}
          >
            {{ overview: 'Overview', team: 'Team' }[tab]}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-3 gap-5 mb-5">

          {/* Left column (2/3) */}
          <div className="col-span-2 space-y-5">

            {/* Milestone Kanban */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-6">
              <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Kanban className="w-4 h-4" animateOnHover="default" />
                Objective Board
              </h3>

              <div className="grid grid-cols-3 gap-3">

                {/* To Do */}
                <div className="bg-[#FFF5E9] rounded-xl p-3 border border-[#E0CFC4]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#8A7265]">To Do</span>
                    <span className="text-xs bg-white text-[#8A7265] px-2 py-0.5 rounded-full border border-[#E0CFC4]">{upcomingMilestones.length}</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingMilestones.length === 0 ? (
                      <p className="text-xs text-[#8A7265] text-center py-3">Nothing queued</p>
                    ) : upcomingMilestones.map(m => (
                      <KanbanCard key={m.id} m={m} today={TODAY} onClick={() => selectMilestone(m)} />
                    ))}
                  </div>
                </div>

                {/* In Progress */}
                <div className="bg-[#FFF5E9] rounded-xl p-3 border border-[#E0CFC4]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#4C8077]">In Progress</span>
                    <span className="text-xs bg-blue-100 text-[#4C8077] px-2 py-0.5 rounded-full">{activePhaseMilestones.length}</span>
                  </div>
                  <div className="space-y-2">
                    {activePhaseMilestones.length === 0 ? (
                      <p className="text-xs text-[#8A7265] text-center py-3 leading-relaxed px-2">
                        {totalMilestones === 0 ? 'No objectives yet'
                          : lockedPhaseIds.size > 0 && completedCount === allMilestones.filter(m => !m.phaseLocked).length
                            ? 'Complete required phases to unlock the next ones'
                            : 'All done 🎉'}
                      </p>
                    ) : activePhaseMilestones.map(m => (
                      <KanbanCard key={m.id} m={m} today={TODAY} onClick={() => selectMilestone(m)} highlight />
                    ))}
                  </div>
                </div>

                {/* Done */}
                <div className="bg-[#FFF5E9] rounded-xl p-3 border border-[#E0CFC4] opacity-90">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#8A7265]">Done</span>
                    <span className="text-xs bg-white text-[#8A7265] px-2 py-0.5 rounded-full border border-[#E0CFC4]">{completedCount}</span>
                  </div>
                  <div className="space-y-2">
                    {recentlyDone.length === 0 ? (
                      <p className="text-xs text-[#8A7265] text-center py-3">None completed yet</p>
                    ) : recentlyDone.map(m => (
                      <div key={m.id}
                        onClick={() => selectMilestone(m)}
                        className="bg-white p-3 rounded-lg border border-[#E0CFC4] cursor-pointer hover:border-[#E0CFC4] transition-colors">
                        <p className="text-xs text-[#8A7265] line-through leading-snug">{m.title}</p>
                        <span className="text-[10px] text-[#4C8077] mt-1 block">{m.phaseName}</span>
                      </div>
                    ))}
                    {completedCount > 5 && (
                      <p className="text-xs text-[#8A7265] text-center">+{completedCount - 5} more</p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Phase Structure preview card */}
            {sortedPhases.length > 0 && (
              <div
                className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden cursor-pointer group hover:border-[#E0CFC4] hover:shadow-md transition-all"
                onClick={() => setCanvasExpanded(true)}
              >
                <div className="px-5 py-3 border-b border-[#E0CFC4] flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    Phase Structure
                  </h3>
                  <span className="text-[10px] text-[#8A7265] group-hover:text-[#C4601A] transition-colors flex items-center gap-1 font-medium">
                    <Expand className="w-3 h-3" animateOnHover="default" />
                    Click to expand
                  </span>
                </div>
                <div style={{ height: 220 }} className="pointer-events-none select-none">
                  <OverviewPhaseCanvas phases={sortedPhases} today={TODAY} preview projectId={id!} />
                </div>
              </div>
            )}
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-5">

            {/* Project Status */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-5">
              <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-4">Project Status</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-medium text-[#54433A]">Completion</span>
                    <span className="text-xl font-semibold text-[#2D1E1A]">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-mid)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ background: 'var(--c-primary)', width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E0CFC4]">
                  <div>
                    <p className="text-[11px] text-[#8A7265] uppercase tracking-wide">Phases</p>
                    <p className="text-lg font-semibold text-[#2D1E1A] mt-0.5">{completedPhases}/{totalPhases}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#8A7265] uppercase tracking-wide">Remaining</p>
                    <p className="text-lg font-semibold text-[#2D1E1A] mt-0.5">{remainingCount}</p>
                  </div>
                  {daysLeft !== null && (
                    <div className="col-span-2 pt-1">
                      <p className="text-[11px] text-[#8A7265] uppercase tracking-wide">Target date</p>
                      <p className={`text-base font-semibold mt-0.5 ${daysLeft < 0 ? 'text-[#ba1a1a]' : daysLeft <= 7 ? 'text-amber-600' : 'text-[#2D1E1A]'}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                      </p>
                    </div>
                  )}
                  {overdueCount > 0 && (
                    <div className="col-span-2">
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                        ⚠ {overdueCount} overdue objective{overdueCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Velocity (if available) */}
            {showVelocity && vel && vel.available && (
              <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-5">
                <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-3">Velocity</h3>
                <p className="text-2xl font-light text-[#2D1E1A] mb-1">
                  {vel.actualPerWeek}<span className="text-sm text-[#8A7265] ml-1">/wk</span>
                </p>
                <p className="text-xs text-[#8A7265] leading-relaxed">
                  {vel.plannedPerWeek !== null && (
                    vel.actualPerWeek < vel.plannedPerWeek * 0.8 ? <span className="text-amber-600">Behind — planned {vel.plannedPerWeek}/wk</span>
                    : vel.actualPerWeek >= vel.plannedPerWeek * 1.1 ? <span className="text-[#4C8077]">Ahead — planned {vel.plannedPerWeek}/wk</span>
                    : <span className="text-[#4C8077]">On track</span>
                  )}
                </p>
                {vel.revisedFinishDate && (
                  <p className="text-xs text-[#8A7265] mt-2">
                    Est. finish: <span className={`font-medium ${vel.targetFinishDate && vel.revisedFinishDate > vel.targetFinishDate ? 'text-amber-600' : 'text-[#54433A]'}`}>
                      {vel.revisedFinishDate}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Recent Activity */}
            {activityItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-5">
                <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-4">Activity</h3>
                <div className="relative space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#F0E9E0]">
                  {activityItems.map((item, i) => (
                    <div key={i} className="relative flex items-start gap-3 pl-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white mt-0.5 ${
                        item.type === 'change' ? 'bg-amber-100' : 'bg-[#c8eadf]'
                      }`}>
                        {item.type === 'change' ? (
                          <svg className="w-2.5 h-2.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        ) : (
                          <Check className="w-2.5 h-2.5 text-[#4C8077]" animateOnHover="default" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[#54433A] leading-snug">{item.label}</p>
                        <p className="text-[10px] text-[#8A7265] mt-0.5">{item.sub} · {relativeTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next up quick info */}
            {nextDueMilestone && (
              <div className="bg-[#FFF5E9] rounded-2xl border border-[#E0CFC4] p-5">
                <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-2">Next Due</h3>
                <p className="text-sm font-medium text-[#2D1E1A] leading-snug mb-1">{nextDueMilestone.title}</p>
                <p className={`text-xs font-medium ${nextDueMilestone.dueDate! < TODAY ? 'text-[#ba1a1a]' : 'text-[#8A7265]'}`}>
                  {nextDueMilestone.dueDate}
                  {nextDueMilestone.dueDate! < TODAY && ' (overdue)'}
                </p>
                <p className="text-[10px] text-[#8A7265] mt-1">{nextDueMilestone.phaseName}</p>
              </div>
            )}
          </div>
          </div>

        </div>
      )}


      {/* ── Team tab ─────────────────────────────────────────── */}
      {activeTab === 'team' && project.members && (
        <MembersSection
          members={project.members}
          currentUserId={user?.id ?? ''}
          isOwner={isOwner}
          canAssign={canAssign}
          performance={performance}
          onInvite={() => setShowInvite(true)}
          onToggleCanApprove={async (memberId, val) => {
            await setMemberPermission(project.id, memberId, val);
            await queryClient.invalidateQueries({ queryKey: ['projects'] });
            const all = await getProjects();
            const fresh = all.find(p => p.id === project.id);
            if (fresh) setProject(fresh);
          }}
        />
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      {showPending && (
        <PendingChangesModal
          project={project}
          changes={pendingChanges}
          onResolved={changeId => {
            setPendingChanges(prev => {
              const next = prev.filter(c => c.id !== changeId);
              if (next.length === 0) {
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                getProjects().then(all => {
                  const fresh = all.find(p => p.id === id);
                  if (fresh) setProject(fresh);
                });
              }
              return next;
            });
          }}
          onClose={() => setShowPending(false)}
        />
      )}

      {showInvite && <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />}

      {/* Phase Structure lightbox */}
      {canvasExpanded && sortedPhases.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          {/* Backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCanvasExpanded(false)}
          />
          {/* Canvas container */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ width: '90vw', height: '85vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E0CFC4] shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-semibold text-[#54433A]">Phase Structure</h2>
                <div className="flex items-center gap-4 text-[10px] text-[#8A7265]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Complete</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#4C8077] inline-block" />Active</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Overdue</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#c1c8c4] inline-block" />Pending</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E0CFC4] inline-block" />Locked</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => { setCanvasExpanded(false); navigate(`/projects/${id}/edit`, { state: { step: 2 } }); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#8A7265] hover:text-[#4C8077] hover:bg-[#FFF5E9] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setCanvasExpanded(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A7265] hover:text-[#54433A] hover:bg-[#F0E9E0] transition-colors text-xl leading-none"
                  aria-label="Close"
                >×</button>
              </div>
            </div>
            {/* Full canvas */}
            <div className="flex-1">
              <OverviewPhaseCanvas
                phases={sortedPhases}
                today={TODAY}
                projectId={id!}
                onPhaseClick={nodeData => setPhaseDetail(nodeData)}
                onEdgeClick={(_sourceId, targetId) => {
                  const edges = getCanvasEdges(id!, sortedPhases);
                  const chain = computeTracePath(targetId, sortedPhases, edges);
                  setTracePathChain(chain);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Phase detail modal ─────────────────────────────────── */}
      <Modal
        open={!!phaseDetail}
        backdropClassName="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onBackdropClick={() => setPhaseDetail(null)}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
          {phaseDetailCache && (
          <>
            {/* Header */}
            <div className={`px-6 py-4 border-b shrink-0 ${
              phaseDetailCache.locked ? 'bg-[#FFF5E9] border-[#E0CFC4]'
              : phaseDetailCache.complete ? 'bg-[#E8FAF7] border-[#E0CFC4]'
              : phaseDetailCache.overdue ? 'bg-amber-50 border-amber-100'
              : 'bg-white border-[#E0CFC4]'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest mb-1">
                    Phase {String(phaseDetailCache.phaseNum).padStart(2, '0')}
                  </p>
                  <h2 className="text-xl font-bold text-[#2D1E1A] leading-snug break-words">{phaseDetailCache.phase.title || 'Unnamed Phase'}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    phaseDetailCache.locked ? 'bg-[#F0E9E0] text-[#8A7265]'
                    : phaseDetailCache.complete ? 'bg-[#c8eadf] text-[#16342d]'
                    : phaseDetailCache.overdue ? 'bg-amber-100 text-amber-700'
                    : phaseDetailCache.active ? 'bg-blue-100 text-blue-700'
                    : 'bg-[#F0E9E0] text-[#8A7265]'
                  }`}>
                    {phaseDetailCache.locked ? 'Locked' : phaseDetailCache.complete ? 'Complete' : phaseDetailCache.overdue ? 'Overdue' : phaseDetailCache.active ? 'In Progress' : 'Pending'}
                  </span>
                  <button onClick={() => setPhaseDetail(null)} className="w-8 h-8 flex items-center justify-center text-[#8A7265] hover:text-[#54433A] hover:bg-[#F0E9E0] rounded-lg transition-colors text-xl leading-none">×</button>
                </div>
              </div>
              {phaseDetailCache.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-[#8A7265] mb-1.5">
                    <span>{phaseDetailCache.done}/{phaseDetailCache.total} objectives</span>
                    <span>{Math.round(phaseDetailCache.done / phaseDetailCache.total * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-mid)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(phaseDetailCache.done / phaseDetailCache.total * 100)}%`,
                        background: phaseDetailCache.complete ? '#4ade80' : phaseDetailCache.overdue ? '#fbbf24' : '#C4601A',
                      }} />
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {phaseDetailCache.phase.description && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wider mb-1.5">Description</p>
                    <p className="text-sm text-[#54433A] leading-relaxed break-words whitespace-pre-wrap">{phaseDetailCache.phase.description}</p>
                  </div>
                )}
                {phaseDetailCache.phase.dueDate && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wider mb-1.5">Due Date</p>
                    <p className={`text-sm font-medium ${!phaseDetailCache.complete && phaseDetailCache.phase.dueDate < TODAY ? 'text-amber-600' : 'text-[#54433A]'}`}>
                      {phaseDetailCache.phase.dueDate}{!phaseDetailCache.complete && phaseDetailCache.phase.dueDate < TODAY && ' (overdue)'}
                    </p>
                  </div>
                )}
                {phaseDetailCache.locked && phaseDetailCache.blockingNames.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wider mb-1.5">Waiting For</p>
                    <div className="flex flex-wrap gap-1.5">
                      {phaseDetailCache.blockingNames.map(name => (
                        <span key={name} className="text-xs px-2.5 py-1 bg-[#F0E9E0] text-[#54433A] rounded-full font-medium">{name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Objectives */}
              {phaseDetailCache.phase.milestones.length > 0 ? (
                <div>
                  <h3 className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest mb-3">
                    Objectives ({phaseDetailCache.phase.milestones.length})
                  </h3>
                  <div className="space-y-2.5">
                    {[...phaseDetailCache.phase.milestones].sort((a, b) => a.order - b.order).map(ms => {
                      const isOverdueMs = !ms.completed && ms.dueDate && ms.dueDate < TODAY;
                      return (
                        <div key={ms.id} className={`p-4 rounded-xl border ${ms.completed ? 'bg-[#E8FAF7] border-[#E0CFC4]' : isOverdueMs ? 'bg-amber-50 border-amber-100' : 'bg-white border-[#E0CFC4]'}`}>
                          <div className="flex items-start gap-3">
                            {ms.completed ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0 mt-px">
                                <Check className="w-3 h-3 text-white" animateOnHover="default" />
                              </div>
                            ) : phaseDetailCache.locked ? (
                              <Lock className="w-5 h-5 text-[#BBA79C] shrink-0 mt-px" animateOnHover="default" />
                            ) : (
                              <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-px ${isOverdueMs ? 'border-amber-400' : 'border-[#E0CFC4]'}`} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold leading-snug break-words ${ms.completed ? 'text-[#8A7265] line-through' : 'text-[#2D1E1A]'}`}>{ms.title}</p>
                              {ms.description && <p className="text-xs text-[#8A7265] mt-1 leading-relaxed break-words whitespace-pre-wrap">{ms.description}</p>}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                                {ms.dueDate && (
                                  <span className={`flex items-center gap-1 text-xs ${isOverdueMs ? 'text-amber-600 font-medium' : 'text-[#8A7265]'}`}>
                                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    {ms.dueDate}{isOverdueMs && ' · overdue'}
                                  </span>
                                )}
                                {ms.assignees && ms.assignees.length > 0 && (
                                  <span className="flex items-center gap-1.5 text-xs text-[#8A7265]">
                                    {ms.assignees.slice(0, 3).map(a => (
                                      <span key={a.id} className="flex items-center gap-1">
                                        <div className={`w-4 h-4 rounded-full ${memberColor(a.name)} flex items-center justify-center text-[8px] text-white font-bold shrink-0`}>{a.name[0]?.toUpperCase()}</div>
                                        <span>{a.name.split(' ')[0]}</span>
                                      </span>
                                    ))}
                                    {ms.assignees.length > 3 && <span className="text-[#8A7265]">+{ms.assignees.length - 3}</span>}
                                  </span>
                                )}
                                {ms.effortRating && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ms.effortRating === 'easier' ? 'bg-[#c8eadf] text-[#16342d]' : ms.effortRating === 'harder' ? 'bg-rose-100 text-rose-700' : 'bg-[#c8eadf] text-[#16342d]'}`}>
                                    {ms.effortRating === 'easier' ? 'Easier than expected' : ms.effortRating === 'harder' ? 'Harder than expected' : 'About right'}
                                  </span>
                                )}
                              </div>
                              {ms.blockReason && !ms.completed && (
                                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                  <span>⚠</span>{BLOCK_LABELS[ms.blockReason] ?? ms.blockReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#8A7265] italic text-center py-4">No objectives in this phase.</p>
              )}
            </div>
          </>
          )}
      </Modal>

      {/* ── Trace path modal ───────────────────────────────────── */}
      {tracePathChain && tracePathChain.length > 0 && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTracePathChain(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl z-10 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0CFC4] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#2D1E1A]">Dependency Chain</h2>
                <p className="text-xs text-[#8A7265] mt-0.5">
                  Complete in this order to unlock{' '}
                  <span className="font-semibold text-[#54433A]">{tracePathChain[tracePathChain.length - 1]?.title || 'this phase'}</span>
                </p>
              </div>
              <button onClick={() => setTracePathChain(null)} className="w-8 h-8 flex items-center justify-center text-[#8A7265] hover:text-[#54433A] hover:bg-[#F0E9E0] rounded-lg transition-colors text-xl leading-none">×</button>
            </div>

            {/* Phase chain */}
            <div className="px-6 py-6 overflow-x-auto">
              <div className="flex items-stretch gap-0 min-w-max">
                {tracePathChain.map((ph, i) => {
                  const isTarget = i === tracePathChain.length - 1;
                  const phComplete = ph.milestones.length > 0 && ph.milestones.every(m => m.completed);
                  const phNum = sortedPhases.findIndex(p => p.id === ph.id) + 1;
                  const doneMs = ph.milestones.filter(m => m.completed).length;
                  return (
                    <div key={ph.id} className="flex items-center gap-0">
                      <button
                        onClick={() => {
                          const lockedIds = getLockedPhaseIds(sortedPhases);
                          const locked = lockedIds.has(ph.id);
                          const pms = ph.milestones;
                          const done = pms.filter(m => m.completed).length;
                          const total = pms.length;
                          const complete = total > 0 && done === total;
                          const overdue = pms.some(m => !m.completed && m.dueDate && m.dueDate < TODAY);
                          const active = !complete && total > 0;
                          setTracePathChain(null);
                          setPhaseDetail({ phase: ph, phaseNum: phNum, done, total, complete, overdue, active, locked, blockingNames: locked ? getBlockingPhaseNames(ph, sortedPhases) : [], today: TODAY });
                        }}
                        className={`w-44 rounded-xl border p-3.5 text-left transition-all hover:shadow-md ${
                          isTarget ? 'border-[#adcec3] bg-[#E8FAF7] shadow-blue-100/60 shadow-sm'
                          : phComplete ? 'border-[#c8eadf] bg-[#E8FAF7]'
                          : 'border-[#E0CFC4] bg-white hover:border-[#E0CFC4]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold text-[#8A7265] uppercase tracking-widest">Phase {String(phNum).padStart(2, '0')}</p>
                          {isTarget && <span className="text-[8px] font-bold bg-blue-100 text-[#4C8077] px-1.5 py-0.5 rounded uppercase tracking-wide">Target</span>}
                        </div>
                        <p className="text-sm font-semibold text-[#2D1E1A] leading-snug truncate mb-2">{ph.title || 'Unnamed'}</p>
                        <div className="flex items-center gap-1.5">
                          {phComplete ? (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                                <Check className="w-2 h-2 text-white" animateOnHover="default" />
                              </div>
                              <span className="text-[10px] text-[#4C8077] font-medium">Complete</span>
                            </>
                          ) : (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] shrink-0" />
                              <span className="text-[10px] text-[#8A7265]">{doneMs}/{ph.milestones.length} done</span>
                            </>
                          )}
                        </div>
                      </button>
                      {i < tracePathChain.length - 1 && (
                        <div className="flex items-center px-2 shrink-0">
                          <ChevronRight className="w-5 h-5 text-[#BBA79C]" animateOnHover="default" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress summary */}
            <div className="px-6 pb-5 pt-1">
              <div className="bg-[#FFF5E9] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wider">Chain Progress</p>
                  <p className="text-sm text-[#54433A] mt-0.5">
                    <span className="font-bold text-[#2D1E1A]">
                      {tracePathChain.filter(ph => ph.milestones.length > 0 && ph.milestones.every(m => m.completed)).length}
                    </span>{' '}of {tracePathChain.length} phases complete
                  </p>
                </div>
                <div className="w-36 shrink-0">
                  {(() => {
                    const done = tracePathChain.filter(ph => ph.milestones.length > 0 && ph.milestones.every(m => m.completed)).length;
                    const pct = tracePathChain.length === 0 ? 0 : Math.round(done / tracePathChain.length * 100);
                    return (
                      <>
                        <div className="flex justify-between text-[10px] text-[#8A7265] mb-1"><span>Progress</span><span>{pct}%</span></div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-mid)' }}>
                          <div className="h-full rounded-full transition-all" style={{ background: 'var(--c-text-dim)', width: `${pct}%` }} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone detail popup */}
      <Modal open={!!selectedMilestone} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          {milestoneCache && (
            effortPending === milestoneCache.id ? (
              /* ── Effort rating ── */
              <div className="text-center p-8">
                <p className="text-2xl mb-2">✓</p>
                <p className="text-base font-semibold text-[#2D1E1A] mb-1">Marked complete!</p>
                <p className="text-sm text-[#8A7265] mb-5">How did this compare to your estimate?</p>
                <div className="flex gap-2 mb-4">
                  {EFFORT_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => handleEffortRating(milestoneCache.id, opt.value)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${opt.color}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setEffortPending(null); selectMilestone(null); }}
                  className="text-xs text-[#8A7265] hover:text-[#54433A] transition-colors">
                  Skip
                </button>
              </div>

            ) : editMode ? (
              /* ── Edit form ── */
              <>
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E0CFC4] shrink-0">
                  <h2 className="text-base font-bold text-[#2D1E1A]">Edit Objective</h2>
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-[#BBA79C] hover:text-[#8A7265] text-2xl leading-none shrink-0"
                  >×</button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-[#8A7265] block mb-1.5">Title</label>
                    <input
                      value={editFields.title}
                      onChange={e => setEditFields(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E0CFC4] text-sm text-[#2D1E1A] focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-semibold text-[#8A7265] block mb-1.5">Description</label>
                    <textarea
                      value={editFields.description}
                      onChange={e => setEditFields(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      placeholder="Add a description…"
                      className="w-full px-3 py-2 rounded-lg border border-[#E0CFC4] text-sm text-[#2D1E1A] focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf] resize-none placeholder:text-[#BBA79C]"
                    />
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="text-xs font-semibold text-[#8A7265] block mb-1.5">Due date</label>
                    <input
                      type="date"
                      value={editFields.dueDate}
                      onChange={e => setEditFields(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E0CFC4] text-sm text-[#2D1E1A] focus:outline-none focus:border-[#46645c] focus:ring-1 focus:ring-[#c8eadf]"
                    />
                  </div>

                  {/* Assignees — only owners and contributors with canApprove can set assignments; viewers cannot be assigned */}
                  {canAssign && project.members && project.members.filter(m => m.role !== 'viewer').length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-[#8A7265] block mb-1.5">Assign to</label>
                      <div className="space-y-1.5">
                        {project.members.filter(m => m.role !== 'viewer').map(m => {
                          const sel = editAssigneeIds.includes(m.user.id);
                          return (
                            <button
                              key={m.user.id}
                              type="button"
                              onClick={() => setEditAssigneeIds(prev =>
                                sel ? prev.filter(id => id !== m.user.id) : [...prev, m.user.id]
                              )}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                                sel ? 'border-[#c8eadf] bg-[#E8FAF7]' : 'border-[#E0CFC4] hover:border-[#E0CFC4] hover:bg-[#FFF5E9]'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${memberColor(m.user.name)}`}>
                                {m.user.name[0]?.toUpperCase()}
                              </div>
                              <span className="text-sm text-[#54433A] flex-1">{m.user.name}</span>
                              <span className="text-[10px] text-[#8A7265] capitalize shrink-0">{m.role}{m.canApprove ? ' · approver' : ''}</span>
                              {sel && (
                                <Check className="w-4 h-4 text-[#46645c] shrink-0" animateOnHover="default" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 pt-3 border-t border-[#E0CFC4] flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#F0E9E0] text-[#8A7265] hover:bg-[#E0CFC4] transition-colors"
                  >Cancel</button>
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving || !editFields.title.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#C4601A] text-white hover:bg-[#C4601A] transition-colors disabled:opacity-40"
                  >
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </>

            ) : (
              /* ── Detail view ── */
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#E0CFC4] shrink-0">
                  <h2 className="text-lg font-bold text-[#2D1E1A] pr-4 leading-snug">{milestoneCache.title}</h2>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                      <button
                        onClick={enterEditMode}
                        className="text-xs font-medium text-[#8A7265] hover:text-[#C4601A] hover:bg-[#FFF5E9] px-2.5 py-1 rounded-lg border border-[#E0CFC4] hover:border-[#c8eadf] transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => { selectMilestone(null); setEffortPending(null); }}
                      className="text-[#BBA79C] hover:text-[#8A7265] text-2xl leading-none mt-0.5"
                    >×</button>
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                  {/* Phase locked banner */}
                  {milestoneCache.phaseLocked && (
                    <div className="flex items-start gap-2.5 px-4 py-3 bg-[#FFF5E9] border border-[#E0CFC4] rounded-xl">
                      <Lock className="w-4 h-4 text-[#8A7265] shrink-0 mt-px" animateOnHover="default" />
                      <div>
                        <p className="text-xs font-semibold text-[#54433A]">Phase locked</p>
                        <p className="text-xs text-[#8A7265] mt-0.5 leading-relaxed">
                          Complete first: <span className="text-[#54433A] font-medium">{milestoneCache.blockingPhaseNames.join(', ')}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Saved / pending feedback */}
                  {editResult === 'saved' && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#E8FAF7] border border-[#E0CFC4] rounded-xl">
                      <Check className="w-4 h-4 text-[#46645c] shrink-0" animateOnHover="default" />
                      <p className="text-xs font-medium text-[#16342d]">Changes saved successfully.</p>
                    </div>
                  )}
                  {editResult === 'pending' && (
                    <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                      <span className="text-amber-400 text-sm shrink-0 mt-px">!</span>
                      <p className="text-xs font-medium text-amber-700 leading-relaxed">
                        Your change has been submitted for review. An owner or approved contributor will apply it.
                      </p>
                    </div>
                  )}

                  {/* Phase */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-[#8A7265] w-24 shrink-0 pt-0.5">Phase</span>
                    <span className="text-sm text-[#54433A] font-medium">{milestoneCache.phaseName}</span>
                  </div>

                  {/* Description */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-[#8A7265] w-24 shrink-0 pt-0.5">Description</span>
                    {milestoneCache.description ? (
                      <p className="text-sm text-[#54433A] leading-relaxed break-words whitespace-pre-wrap min-w-0">
                        {milestoneCache.description}
                      </p>
                    ) : (
                      <p className="text-sm text-[#BBA79C] italic">No description</p>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-[#8A7265] w-24 shrink-0 pt-0.5">Due date</span>
                    {milestoneCache.dueDate ? (
                      <span className={`text-sm font-medium ${!milestoneCache.completed && milestoneCache.dueDate < TODAY ? 'text-amber-600' : 'text-[#54433A]'}`}>
                        {milestoneCache.dueDate}
                        {!milestoneCache.completed && milestoneCache.dueDate < TODAY && <span className="ml-1.5 text-xs font-normal text-amber-500">(overdue)</span>}
                      </span>
                    ) : (
                      <p className="text-sm text-[#BBA79C] italic">No due date</p>
                    )}
                  </div>

                  {/* Assigned to */}
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-[#8A7265] w-24 shrink-0 pt-0.5">Assigned to</span>
                    {milestoneCache.assignees && milestoneCache.assignees.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {milestoneCache.assignees.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold ${memberColor(a.name)}`}>
                              {a.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-[#54433A]">{a.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#BBA79C] italic">Anyone</p>
                    )}
                  </div>

                  {/* Status + effort */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                      ${milestoneCache.completed ? 'bg-[#E8FAF7] text-[#4C8077]' : 'bg-[#F0E9E0] text-[#8A7265]'}`}>
                      {milestoneCache.completed ? '✓ Completed' : '○ Not completed'}
                    </div>
                    {milestoneCache.effortRating && (
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                        ${milestoneCache.effortRating === 'easier' ? 'bg-[#E8FAF7] text-[#4C8077]'
                          : milestoneCache.effortRating === 'harder' ? 'bg-rose-50 text-rose-600'
                          : 'bg-[#E8FAF7] text-[#4C8077]'}`}>
                        {milestoneCache.effortRating === 'easier' ? 'Easier than expected'
                          : milestoneCache.effortRating === 'harder' ? 'Harder than expected'
                          : 'About right'}
                      </div>
                    )}
                  </div>

                  {/* Block reason */}
                  {!milestoneCache.completed && milestoneCache.dueDate && milestoneCache.dueDate < TODAY && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      {milestoneCache.blockReason ? (
                        <div>
                          <p className="text-xs font-semibold text-[#8A7265] mb-2">Blocked by:</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-amber-800">
                              {BLOCK_LABELS[milestoneCache.blockReason] ?? milestoneCache.blockReason}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => handleBlockReason(milestoneCache.id, milestoneCache.blockReason!)}
                                className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                              >Change</button>
                            )}
                          </div>
                        </div>
                      ) : canEdit ? (
                        <div>
                          <p className="text-xs font-semibold text-[#8A7265] mb-2.5">What's blocking this?</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {BLOCK_OPTIONS.map(opt => (
                              <button key={opt.value}
                                onClick={() => handleBlockReason(milestoneCache.id, opt.value)}
                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white border border-amber-200 text-xs text-[#54433A] hover:border-amber-400 hover:bg-amber-50 transition-colors text-left font-medium">
                                <span>{opt.icon}</span> {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">This milestone is overdue.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: toggle button (hidden for locked phases) */}
                {canEdit && !milestoneCache.phaseLocked && (
                  <div className="px-6 pb-6 shrink-0">
                    <button
                      onClick={() => handleToggleMilestone(milestoneCache)}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                        ${milestoneCache.completed
                          ? 'bg-[#F0E9E0] text-[#8A7265] hover:bg-[#E0CFC4]'
                          : 'bg-[#C4601A] text-white hover:bg-[#C4601A]'}`}
                    >
                      {milestoneCache.completed ? 'Mark as incomplete' : 'Mark as complete'}
                    </button>
                  </div>
                )}
              </>
            )
          )}
      </Modal>
    </div>
  );
}

// ── Overview read-only React Flow canvas ─────────────────────────────────────

interface ONodeData extends Record<string, unknown> {
  phase: Phase;
  phaseNum: number;
  done: number;
  total: number;
  complete: boolean;
  overdue: boolean;
  active: boolean;
  locked: boolean;
  blockingNames: string[];
  today: string;
}
type ONode = Node<ONodeData, 'overviewPhaseNode'>;

const OverviewPhaseNode = memo(function OverviewPhaseNode({ data }: NodeProps<ONode>) {
  const { phase, phaseNum, done, total, complete, overdue, active, locked, blockingNames } = data;
  const pct        = total === 0 ? 0 : Math.round(done / total * 100);
  const statusText  = locked ? 'Locked' : complete ? 'Done' : overdue ? 'Overdue' : active ? `${pct}%` : 'Pending';
  const statusColor = locked ? 'text-[#8A7265] bg-[#F0E9E0]' : complete ? 'text-[#4C8077] bg-[#E8FAF7]' : overdue ? 'text-amber-600 bg-amber-50' : active ? 'text-[#4C8077] bg-[#E8FAF7]' : 'text-[#8A7265] bg-[#FFF5E9]';
  const invisibleHandle: React.CSSProperties = { opacity: 0, pointerEvents: 'none', width: 8, height: 8, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent' };
  return (
    <div
      className={`w-80 bg-white rounded-2xl overflow-hidden shadow-xl border transition-shadow cursor-pointer hover:shadow-2xl ${locked ? 'border-[#E0CFC4] shadow-slate-100/60 opacity-60' : 'border-[#E0CFC4] shadow-slate-200/60'}`}
    >
      {/* Invisible handles so React Flow can route edges between nodes */}
      <Handle type="target" position={Position.Top}    style={invisibleHandle} />
      <Handle type="source" position={Position.Bottom} style={invisibleHandle} />
      {/* Header */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${locked ? 'bg-[#F0E9E0] border-[#E0CFC4]' : 'bg-[#FFF5E9] border-[#E0CFC4]'}`}>
        <div className="flex items-center gap-2">
          {locked && (
            <Lock className="w-3 h-3 text-[#8A7265] shrink-0" animateOnHover="default" />
          )}
          <span className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest">
            Phase {String(phaseNum).padStart(2, '0')}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{statusText}</span>
      </div>
      {/* Phase info */}
      <div className="px-4 py-3">
        <h4 className={`font-bold text-[15px] leading-snug ${locked ? 'text-[#8A7265]' : 'text-[#2D1E1A]'}`}>
          {phase.title || <span className="text-[#BBA79C] font-normal italic">Unnamed phase</span>}
        </h4>
        {locked && blockingNames.length > 0 && (
          <p className="text-[10px] text-[#8A7265] mt-1.5 leading-relaxed">
            Waiting for: <span className="font-medium text-[#8A7265]">{blockingNames.join(', ')}</span>
          </p>
        )}
        {!locked && phase.description && <p className="text-xs text-[#8A7265] mt-1 line-clamp-2">{phase.description}</p>}
        {!locked && phase.dueDate && (
          <p className="text-[10px] text-[#8A7265] mt-1.5 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Due {phase.dueDate}
          </p>
        )}
      </div>
      {/* Objectives */}
      {phase.milestones.length > 0 && (
        <div className="px-4 pb-3 border-t border-[#E0CFC4] pt-2 space-y-2">
          {phase.milestones.slice(0, 3).map(ms => (
            <div key={ms.id} className="flex items-center gap-2">
              {ms.completed ? (
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shrink-0 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" animateOnHover="default" />
                </div>
              ) : locked ? (
                <Lock className="w-3.5 h-3.5 text-[#BBA79C] shrink-0" animateOnHover="default" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#E0CFC4] shrink-0" />
              )}
              <p className={`text-xs truncate ${ms.completed ? 'text-[#8A7265] line-through' : locked ? 'text-[#BBA79C]' : 'text-[#54433A]'}`}>
                {ms.title || 'Untitled'}
              </p>
            </div>
          ))}
          {phase.milestones.length > 3 && (
            <p className="text-[10px] text-[#8A7265] pl-5">+{phase.milestones.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
});

const overviewNodeTypes = { overviewPhaseNode: OverviewPhaseNode };

function OverviewEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <g style={{ cursor: 'pointer' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd}
        style={{ stroke: hovered ? '#94a3b8' : '#cbd5e1', strokeWidth: hovered ? 2.5 : 1.5, transition: 'stroke 0.15s, stroke-width 0.15s' }} />
    </g>
  );
}
const overviewEdgeTypes = { overviewEdge: OverviewEdge };

function OverviewPhaseCanvas({ phases, today, preview = false, projectId = '', onPhaseClick, onEdgeClick }: {
  phases: Phase[]; today: string; preview?: boolean; projectId?: string;
  onPhaseClick?: (data: ONodeData) => void;
  onEdgeClick?: (sourceId: string, targetId: string) => void;
}) {
  const readStored = useCallback((): { positions?: Record<string, { x: number; y: number }>; edges?: { source: string; target: string }[] } | null => {
    if (!projectId) return null;
    try { return JSON.parse(localStorage.getItem(`steadily-canvas-${projectId}`) ?? 'null'); } catch { return null; }
  }, [projectId]);

  const buildNodes = useCallback((): ONode[] => {
    const lockedIds = getLockedPhaseIds(phases);
    const stored = readStored();
    return phases.map((ph, i) => {
      const pms = ph.milestones;
      const done = pms.filter(m => m.completed).length;
      const total = pms.length;
      const complete = total > 0 && done === total;
      const overdue = pms.some(m => !m.completed && m.dueDate && m.dueDate < today);
      const active = !complete && total > 0;
      const locked = lockedIds.has(ph.id);
      const blockingNames = locked ? getBlockingPhaseNames(ph, phases) : [];
      const savedPos = stored?.positions?.[ph.id];
      return {
        id: ph.id,
        type: 'overviewPhaseNode',
        position: savedPos ?? { x: 80 + (i % 3) * 360, y: 80 + Math.floor(i / 3) * 280 },
        data: { phase: ph, phaseNum: i + 1, done, total, complete, overdue, active, locked, blockingNames, today },
        draggable: false,
        connectable: false,
        selectable: false,
      };
    });
  }, [phases, today, readStored]);

  const buildEdges = useCallback(() => {
    const stored = readStored();
    // Prefer localStorage edges (saved by edit/create page); fall back to backend ph.dependencies
    const markerEnd = { type: MarkerType.ArrowClosed, color: '#cbd5e1', width: 14, height: 14 };
    if (stored?.edges && stored.edges.length > 0) {
      return stored.edges.map((e: { source: string; target: string }) => ({
        id: `${e.source}→${e.target}`,
        source: e.source,
        target: e.target,
        type: 'overviewEdge',
        markerEnd,
      }));
    }
    return phases.flatMap(ph =>
      (ph.dependencies ?? []).map(dep => ({
        id: `${dep.dependsOnId}→${ph.id}`,
        source: dep.dependsOnId,
        target: ph.id,
        type: 'overviewEdge',
        markerEnd,
      }))
    );
  }, [phases, readStored]);

  const [nodes, setNodes, onNodesChange] = useNodesState<ONode>(buildNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges());

  useEffect(() => { setNodes(buildNodes()); }, [phases, buildNodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEdges(buildEdges()); }, [phases, buildEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={overviewNodeTypes}
      edgeTypes={overviewEdgeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
      zoomOnScroll={!preview}
      panOnDrag={!preview}
      zoomOnPinch={!preview}
      zoomOnDoubleClick={!preview}
      onNodeClick={onPhaseClick ? (_, node) => onPhaseClick(node.data as ONodeData) : undefined}
      onEdgeClick={onEdgeClick ? (_, edge) => onEdgeClick(edge.source, edge.target) : undefined}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#f1f5f9" />
      {!preview && (
        <Controls showInteractive={false} style={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 8 }} />
      )}
    </ReactFlow>
  );
}

function KanbanCard({ m, today, onClick, highlight = false }: {
  m: MilestoneWithPhase;
  today: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  const isOverdue = !m.completed && !m.phaseLocked && m.dueDate && m.dueDate < today;
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border shadow-sm cursor-pointer transition-colors ${
        m.phaseLocked
          ? 'bg-[#FFF5E9] border-[#E0CFC4] opacity-65 hover:opacity-80'
          : highlight
            ? 'bg-white border-l-2 border-l-blue-400 border-[#E0CFC4] hover:border-[#c8eadf]'
            : 'bg-white border-[#E0CFC4] hover:border-[#E0CFC4]'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <p className={`text-xs leading-snug flex-1 ${m.phaseLocked ? 'text-[#8A7265]' : 'text-[#2D1E1A]'}`}>{m.title}</p>
        {m.phaseLocked && (
          <Lock className="w-3.5 h-3.5 text-[#8A7265] shrink-0 mt-px" animateOnHover="default" />
        )}
      </div>
      {m.phaseLocked ? (
        <p className="text-[10px] text-[#8A7265] leading-relaxed">
          Requires: <span className="font-medium">{m.blockingPhaseNames.join(', ')}</span>
        </p>
      ) : (
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10px] bg-[#F0E9E0] text-[#8A7265] px-1.5 py-0.5 rounded truncate max-w-[80px]">{m.phaseName}</span>
          <div className="flex items-center gap-1.5">
            {m.assignees && m.assignees.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex items-center -space-x-1 shrink-0">
                  {m.assignees.slice(0, 2).map(a => (
                    <div key={a.id} title={a.name}
                      className={`w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[8px] font-semibold shrink-0 ${memberColor(a.name)}`}>
                      {a.name[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-[#8A7265] leading-none">
                  {m.assignees[0].name.split(' ')[0]}{m.assignees.length > 1 ? ` +${m.assignees.length - 1}` : ''}
                </span>
              </div>
            )}
            {m.dueDate && (
              <span className={`text-[10px] font-medium ${isOverdue ? 'text-[#ba1a1a]' : 'text-[#8A7265]'}`}>
                {isOverdue ? '⚠ ' : ''}{m.dueDate}
              </span>
            )}
          </div>
        </div>
      )}
      {!m.phaseLocked && m.blockReason && (
        <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
          <span>⚠</span>{BLOCK_LABELS[m.blockReason]}
        </p>
      )}
    </div>
  );
}


const ROLE_COLORS: Record<string, string> = {
  owner:       'bg-[#E8FAF7] text-[#16342d] border-[#c8eadf]',
  contributor: 'bg-[#E8FAF7] text-blue-700 border-[#c8eadf]',
  viewer:      'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4]',
};

function scoreColor(score: number) {
  if (score >= 75) return { ring: 'text-[#4C8077]', bg: 'bg-[#E8FAF7] text-[#16342d] border-[#c8eadf]' };
  if (score >= 45) return { ring: 'text-amber-500',   bg: 'bg-amber-50 text-amber-700 border-amber-200'     };
  return               { ring: 'text-[#ba1a1a]',        bg: 'bg-[#ffdad6] text-[#93000a] border-[#ffdad6]'           };
}

function MembersSection({ members, currentUserId, isOwner, canAssign, performance, onInvite, onToggleCanApprove }: {
  members: ProjectMember[];
  currentUserId: string;
  isOwner: boolean;
  canAssign: boolean;
  performance: MemberPerformance[] | null;
  onInvite: () => void;
  onToggleCanApprove: (memberId: string, val: boolean) => void;
}) {
  const myMember = members.find(m => m.user.id === currentUserId);

  return (
    <div className="space-y-5">
      {/* Member list */}
      <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0CFC4]">
          <div>
            <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest">Team</p>
            {myMember && (
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[myMember.role] ?? ROLE_COLORS.viewer}`}>
                You — {myMember.role}
              </span>
            )}
          </div>
          {isOwner ? (
            <button
              onClick={onInvite}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4C8077] border border-[#c8eadf] hover:bg-[#FFF5E9] px-3 py-1.5 rounded-lg transition-colors"
            >
              + Invite member
            </button>
          ) : (
            <span className="text-xs text-[#BBA79C]">{members.length} member{members.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <ul className="divide-y divide-[#e4e2e2]">
          {members.map(m => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${memberColor(m.user.name)}`}>
                  {m.user.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#2D1E1A] truncate">
                    {m.user.name}
                    {m.user.id === currentUserId && <span className="text-[#8A7265] font-normal"> (you)</span>}
                  </p>
                  <p className="text-xs text-[#8A7265] truncate">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {isOwner && m.role === 'contributor' && m.user.id !== currentUserId && (
                  <button
                    onClick={() => onToggleCanApprove(m.userId, !m.canApprove)}
                    title={m.canApprove ? 'Revoke approval permission' : 'Grant approval permission'}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                      m.canApprove
                        ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                        : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4] hover:border-violet-300 hover:text-violet-500'
                    }`}
                  >
                    {m.canApprove ? '✓ can approve' : 'can approve?'}
                  </button>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>
                  {m.role}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Performance panel — visible only to owner / canApprove contributors */}
      {canAssign && (
        <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E0CFC4]">
            <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest">Member Performance</p>
            <p className="text-xs text-[#8A7265] mt-0.5">Based on assigned milestones and deadline adherence</p>
          </div>

          {!performance ? (
            <div className="px-5 py-8 text-center text-sm text-[#8A7265]">Loading…</div>
          ) : performance.every(p => p.assigned === 0) ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[#8A7265] font-medium">No milestones assigned yet</p>
              <p className="text-xs text-[#8A7265] mt-1">Assign objectives to team members from the Objectives tab to track performance.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#e4e2e2]">
              {performance.map(p => {
                const colors  = scoreColor(p.score);
                const onTimePct = (p.completedOnTime + p.completedLate) > 0
                  ? Math.round(p.completedOnTime / (p.completedOnTime + p.completedLate) * 100)
                  : null;
                return (
                  <li key={p.userId} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${memberColor(p.name)}`}>
                        {p.name[0]?.toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#2D1E1A] truncate">{p.name}</p>
                            <p className="text-xs text-[#8A7265] capitalize">{p.role}{p.canApprove ? ' · can approve' : ''}</p>
                          </div>
                          {/* Score badge */}
                          {p.assigned > 0 && (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${colors.bg}`}>
                              {p.score} score
                            </span>
                          )}
                        </div>

                        {p.assigned === 0 ? (
                          <p className="text-xs text-[#8A7265]">No milestones assigned</p>
                        ) : (
                          <>
                            {/* Stats row */}
                            <div className="grid grid-cols-4 gap-2 mb-2.5">
                              <div className="text-center">
                                <p className="text-base font-semibold text-[#2D1E1A]">{p.assigned}</p>
                                <p className="text-[10px] text-[#8A7265] uppercase tracking-wide">Assigned</p>
                              </div>
                              <div className="text-center">
                                <p className="text-base font-semibold text-[#2D1E1A]">{p.completed}</p>
                                <p className="text-[10px] text-[#8A7265] uppercase tracking-wide">Done</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-base font-semibold ${p.overdue > 0 ? 'text-amber-600' : 'text-[#2D1E1A]'}`}>{p.overdue}</p>
                                <p className="text-[10px] text-[#8A7265] uppercase tracking-wide">Overdue</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-base font-semibold ${onTimePct !== null && onTimePct < 60 ? 'text-amber-600' : 'text-[#2D1E1A]'}`}>
                                  {onTimePct !== null ? `${onTimePct}%` : '—'}
                                </p>
                                <p className="text-[10px] text-[#8A7265] uppercase tracking-wide">On time</p>
                              </div>
                            </div>

                            {/* Completion bar */}
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-mid)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.round(p.completed / p.assigned * 100)}%`,
                                  background: p.score >= 75 ? '#4ade80' : p.score >= 45 ? '#fbbf24' : '#f87171',
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-[#8A7265]">{p.completed}/{p.assigned} completed</span>
                              {p.completedLate > 0 && (
                                <span className="text-[10px] text-amber-500">{p.completedLate} late · avg {p.avgDaysLate}d</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
