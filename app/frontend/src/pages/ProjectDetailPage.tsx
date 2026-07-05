import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Milestone, ProjectMember, PendingChange } from '../types';
import {
  getProjects, updateMilestone, getProjectInsights,
  getPendingChanges, setMemberPermission,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import EditProjectModal    from '../components/EditProjectModal';
import InviteModal         from '../components/InviteModal';
import PendingChangesModal from '../components/PendingChangesModal';

type Tab = 'overview' | 'milestones' | 'team';

type MilestoneWithPhase = Milestone & { phaseId: string; phaseName: string };

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
  { value: 'easier',      label: 'Easier',      color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  { value: 'as_expected', label: 'About right', color: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
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

  const [project,          setProject]         = useState<Project | null>(null);
  const [insights,         setInsights]        = useState<Insights | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPhase | null>(null);
  const [effortPending,    setEffortPending]   = useState<string | null>(null);
  const [scrollPct,        setScrollPct]       = useState(0);
  const [expandedPhaseId,  setExpandedPhaseId] = useState<string | null>(null);
  const [activeTab,        setActiveTab]       = useState<Tab>('overview');
  const [showEdit,         setShowEdit]        = useState(false);
  const [showInvite,       setShowInvite]      = useState(false);
  const [showPending,      setShowPending]     = useState(false);
  const [pendingChanges,   setPendingChanges]  = useState<PendingChange[]>([]);

  const trackRef           = useRef<HTMLDivElement>(null);
  const currentMilestoneRef = useRef<HTMLButtonElement>(null);

  function refreshPending(role: string, canApprove: boolean) {
    if (role === 'owner' || (role === 'contributor' && canApprove)) {
      getPendingChanges(id!).then(list => {
        setPendingChanges(list);
        if (list.length > 0) setShowPending(true);
      }).catch(() => setPendingChanges([]));
    }
  }

  useEffect(() => {
    Promise.all([getProjects(), getProjectInsights(id!)])
      .then(([all, ins]) => {
        const found = all.find(p => p.id === id);
        if (found) {
          setProject(found);
          const me = found.members?.find(m => m.user.id === user?.id);
          if (me) refreshPending(me.role, me.canApprove);
        }
        setInsights(ins);
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollPct(max <= 0 ? 0 : el.scrollLeft / max);
  }, []);

  function scrollToCurrent() {
    currentMilestoneRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
  );

  const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);
  const allMilestones: MilestoneWithPhase[] = sortedPhases.flatMap(ph =>
    [...ph.milestones].sort((a, b) => a.order - b.order).map(m => ({ ...m, phaseId: ph.id, phaseName: ph.title }))
  );

  const totalMilestones  = allMilestones.length;
  const completedCount   = allMilestones.filter(m => m.completed).length;
  const remainingCount   = totalMilestones - completedCount;
  const pct              = totalMilestones === 0 ? 0 : Math.round(completedCount / totalMilestones * 100);
  const totalPhases      = sortedPhases.length;
  const completedPhases  = sortedPhases.filter(ph => ph.milestones.length > 0 && ph.milestones.every(m => m.completed)).length;

  const currentIdx        = allMilestones.findIndex(m => !m.completed);
  const currentMilestone  = currentIdx >= 0 ? allMilestones[currentIdx] : null;
  const currentPhase      = currentMilestone ? sortedPhases.find(ph => ph.id === currentMilestone.phaseId) : null;
  const nextDueMilestone  = allMilestones.find(m => !m.completed && m.dueDate);
  const activePhase       = sortedPhases.find(ph => ph.milestones.some(m => !m.completed));

  const myRole  = project.members?.find(m => m.user.id === user?.id)?.role ?? 'viewer';
  const canEdit = myRole === 'owner' || myRole === 'contributor';
  const isOwner = myRole === 'owner';

  const healthScore = insights?.healthScore ?? null;
  const healthBg    = healthScore === null ? 'bg-slate-50 border-slate-200 text-slate-400'
    : healthScore >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
    : healthScore >= 40 ? 'bg-amber-50 border-amber-200 text-amber-600'
    : 'bg-red-50 border-red-200 text-red-600';

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
  const statusStyle = pct === 100 || project.completed ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : overdueCount > 0 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : completedCount > 0 ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

  // Phase states for the progress stepper
  const activePhaseIdx = sortedPhases.findIndex(ph => !ph.milestones.every(m => m.completed) && !(ph.milestones.length === 0));
  const phasesWithState = sortedPhases.map((ph, i) => {
    const msDone = ph.milestones.filter(m => m.completed).length;
    const allDone = ph.milestones.length > 0 && msDone === ph.milestones.length;
    const state: 'done' | 'active' | 'pending' = allDone ? 'done' : i === activePhaseIdx ? 'active' : 'pending';
    return { ...ph, state };
  });

  // Kanban columns
  const activePhaseMilestones = activePhase
    ? allMilestones.filter(m => m.phaseId === activePhase.id && !m.completed)
    : [];
  const upcomingMilestones = allMilestones.filter(m => {
    if (m.completed) return false;
    if (activePhase && m.phaseId === activePhase.id) return false;
    const phIdx = sortedPhases.findIndex(ph => ph.id === m.phaseId);
    return phIdx > (activePhaseIdx === -1 ? 999 : activePhaseIdx);
  }).slice(0, 6);
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
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors"
        >
          ← Projects
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900 leading-tight">{project.title}</h1>
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
              <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{project.description}</p>
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
                  <div className="w-9 h-9 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold shrink-0">
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
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors"
              >
                ✎ Edit
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors"
              >
                + Invite
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className="flex items-end gap-6 border-b border-slate-200 mb-6">
        {(['overview', 'milestones', 'team'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">

          {/* Left column (2/3) */}
          <div className="col-span-2 space-y-5">

            {/* Phase Progress stepper */}
            {sortedPhases.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                  Phase Progress
                </h3>
                <div className="relative overflow-x-auto pb-2">
                  <div className="relative flex justify-between items-start min-w-max gap-2" style={{ minWidth: `${Math.max(phasesWithState.length * 100, 300)}px` }}>
                    {/* Progress line background */}
                    <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200" />
                    {/* Progress line fill */}
                    <div
                      className="absolute top-4 left-4 h-0.5 bg-slate-900 transition-all duration-500"
                      style={{
                        width: phasesWithState.length <= 1 ? '0%'
                          : `calc(${(completedPhases / Math.max(1, phasesWithState.length - 1)) * 100}% * (100% - 32px) / 100%)`
                      }}
                    />
                    {phasesWithState.map((ph) => (
                      <div key={ph.id} className="flex flex-col items-center gap-2 z-10" style={{ width: 90 }}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white transition-all ${
                          ph.state === 'done'   ? 'bg-slate-900 text-white'
                          : ph.state === 'active' ? 'bg-white border-2 border-slate-900 text-slate-900'
                          : 'bg-white border-2 border-slate-300 text-slate-300'
                        }`}>
                          {ph.state === 'done' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : ph.state === 'active' ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                          ) : null}
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-medium leading-tight line-clamp-2 ${ph.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}
                            style={{ maxWidth: 84 }}>{ph.title}</p>
                          <p className={`text-[10px] mt-0.5 capitalize ${ph.state === 'active' ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
                            {ph.state === 'done' ? `${ph.milestones.length} done`
                              : ph.state === 'active' ? 'Active'
                              : `${ph.milestones.length} upcoming`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Milestone Kanban */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Milestone Board
              </h3>
              <div className="grid grid-cols-3 gap-3">

                {/* To Do */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">To Do</span>
                    <span className="text-xs bg-white text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{upcomingMilestones.length}</span>
                  </div>
                  <div className="space-y-2">
                    {upcomingMilestones.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Nothing queued</p>
                    ) : upcomingMilestones.map(m => (
                      <KanbanCard key={m.id} m={m} today={TODAY} onClick={() => setSelectedMilestone(m)} />
                    ))}
                  </div>
                </div>

                {/* In Progress */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-blue-600">In Progress</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{activePhaseMilestones.length}</span>
                  </div>
                  <div className="space-y-2">
                    {activePhaseMilestones.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">
                        {totalMilestones === 0 ? 'No milestones yet' : 'All done 🎉'}
                      </p>
                    ) : activePhaseMilestones.map(m => (
                      <KanbanCard key={m.id} m={m} today={TODAY} onClick={() => setSelectedMilestone(m)} highlight />
                    ))}
                  </div>
                </div>

                {/* Done */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 opacity-90">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">Done</span>
                    <span className="text-xs bg-white text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{completedCount}</span>
                  </div>
                  <div className="space-y-2">
                    {recentlyDone.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">None completed yet</p>
                    ) : recentlyDone.map(m => (
                      <div key={m.id}
                        onClick={() => setSelectedMilestone(m)}
                        className="bg-white p-3 rounded-lg border border-slate-100 cursor-pointer hover:border-slate-200 transition-colors">
                        <p className="text-xs text-slate-400 line-through leading-snug">{m.title}</p>
                        <span className="text-[10px] text-emerald-600 mt-1 block">{m.phaseName}</span>
                      </div>
                    ))}
                    {completedCount > 5 && (
                      <p className="text-xs text-slate-400 text-center">+{completedCount - 5} more</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-5">

            {/* Project Status */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Project Status</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-medium text-slate-700">Completion</span>
                    <span className="text-xl font-semibold text-slate-900">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-slate-900 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Phases</p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{completedPhases}/{totalPhases}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide">Remaining</p>
                    <p className="text-lg font-semibold text-slate-800 mt-0.5">{remainingCount}</p>
                  </div>
                  {daysLeft !== null && (
                    <div className="col-span-2 pt-1">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wide">Target date</p>
                      <p className={`text-base font-semibold mt-0.5 ${daysLeft < 0 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                      </p>
                    </div>
                  )}
                  {overdueCount > 0 && (
                    <div className="col-span-2">
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                        ⚠ {overdueCount} overdue milestone{overdueCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Velocity (if available) */}
            {showVelocity && vel && vel.available && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Velocity</h3>
                <p className="text-2xl font-light text-slate-900 mb-1">
                  {vel.actualPerWeek}<span className="text-sm text-slate-400 ml-1">/wk</span>
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {vel.plannedPerWeek !== null && (
                    vel.actualPerWeek < vel.plannedPerWeek * 0.8 ? <span className="text-amber-600">Behind — planned {vel.plannedPerWeek}/wk</span>
                    : vel.actualPerWeek >= vel.plannedPerWeek * 1.1 ? <span className="text-emerald-600">Ahead — planned {vel.plannedPerWeek}/wk</span>
                    : <span className="text-emerald-600">On track</span>
                  )}
                </p>
                {vel.revisedFinishDate && (
                  <p className="text-xs text-slate-400 mt-2">
                    Est. finish: <span className={`font-medium ${vel.targetFinishDate && vel.revisedFinishDate > vel.targetFinishDate ? 'text-amber-600' : 'text-slate-700'}`}>
                      {vel.revisedFinishDate}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Recent Activity */}
            {activityItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Activity</h3>
                <div className="relative space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {activityItems.map((item, i) => (
                    <div key={i} className="relative flex items-start gap-3 pl-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white mt-0.5 ${
                        item.type === 'change' ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                        {item.type === 'change' ? (
                          <svg className="w-2.5 h-2.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        ) : (
                          <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">{item.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.sub} · {relativeTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next up quick info */}
            {nextDueMilestone && (
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Next Due</h3>
                <p className="text-sm font-medium text-slate-800 leading-snug mb-1">{nextDueMilestone.title}</p>
                <p className={`text-xs font-medium ${nextDueMilestone.dueDate! < TODAY ? 'text-red-500' : 'text-slate-500'}`}>
                  {nextDueMilestone.dueDate}
                  {nextDueMilestone.dueDate! < TODAY && ' (overdue)'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">{nextDueMilestone.phaseName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Milestones tab (existing fence track) ────────────── */}
      {activeTab === 'milestones' && (
        <div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {currentIdx >= 0 && (
              <div className="flex justify-end px-5 pt-4">
                <button
                  onClick={scrollToCurrent}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
                >
                  ⌖ Go to current
                </button>
              </div>
            )}

            <div ref={trackRef} onScroll={handleScroll} className="overflow-x-auto">
              <div className="flex items-center min-w-max px-6 py-10 gap-0">
                {sortedPhases.map((phase, phaseIdx) => {
                  const phaseMilestones = allMilestones.filter(m => m.phaseId === phase.id);
                  const phaseDone = phaseMilestones.filter(m => m.completed).length;
                  const phaseComplete = phaseMilestones.length > 0 && phaseDone === phaseMilestones.length;
                  const isExpanded = expandedPhaseId === phase.id;
                  const nextDue = phaseMilestones.find(m => !m.completed && m.dueDate)?.dueDate;

                  return (
                    <Fragment key={phase.id}>
                      {phaseIdx > 0 && <div className="w-5 h-0.5 bg-slate-200 shrink-0" />}
                      <div
                        onClick={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
                        className={`shrink-0 rounded-xl border-2 p-3 cursor-pointer transition-all select-none
                          ${phaseComplete
                            ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                            : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'}
                          ${isExpanded ? 'w-52' : 'w-40'}`}
                      >
                        <div className={`w-2 h-2 rounded-full mb-2 shrink-0 ${phaseComplete ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                        <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{phase.title}</p>
                        {!isExpanded && (
                          <>
                            {phase.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{phase.description}</p>}
                            {nextDue && <p className="text-xs text-slate-400 mt-1.5">📅 {nextDue}</p>}
                            <p className="text-xs text-slate-400 mt-1.5">{phaseDone}/{phaseMilestones.length} done</p>
                          </>
                        )}
                        {isExpanded && (
                          <div className="mt-2 space-y-1.5">
                            {phase.description && <p className="text-xs text-slate-500 leading-relaxed">{phase.description}</p>}
                            <div className="pt-1.5 border-t border-slate-100 space-y-1">
                              <p className="text-xs text-slate-500"><span className="font-medium">{phaseDone}</span> / {phaseMilestones.length} milestones</p>
                              {nextDue && <p className="text-xs text-slate-400">Next due: {nextDue}</p>}
                              {phaseComplete && <p className="text-xs text-emerald-600 font-medium">✓ Phase complete</p>}
                            </div>
                          </div>
                        )}
                      </div>

                      {phaseMilestones.map(m => {
                        const globalIdx = allMilestones.findIndex(am => am.id === m.id);
                        const isCurrent = globalIdx === currentIdx;
                        const isOverdue = !m.completed && m.dueDate && m.dueDate < TODAY;

                        return (
                          <Fragment key={m.id}>
                            <div className="w-5 h-0.5 bg-slate-200 shrink-0" />
                            <div className="relative flex flex-col items-center shrink-0">
                              {isCurrent && (
                                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-base pointer-events-none select-none">🚩</span>
                              )}
                              <button
                                ref={isCurrent ? currentMilestoneRef : undefined}
                                onClick={() => setSelectedMilestone(m)}
                                title={m.title}
                                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center
                                  transition-all hover:scale-105 active:scale-95 shrink-0
                                  ${m.completed
                                    ? 'bg-emerald-400 border-emerald-400 text-white'
                                    : isCurrent
                                    ? 'bg-white border-blue-400 text-blue-600 ring-4 ring-blue-100'
                                    : isOverdue
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-white border-slate-200 text-slate-500'}`}
                              >
                                <span className="text-[10px] font-medium text-center leading-tight px-2 line-clamp-4">
                                  {m.title}
                                </span>
                              </button>
                              {m.dueDate && (
                                <p className={`text-[10px] mt-1.5 text-center w-20 leading-tight ${isOverdue ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
                                  {m.dueDate}
                                </p>
                              )}
                            </div>
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                <div className="w-5 h-0.5 bg-slate-200 shrink-0" />
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base shrink-0
                  ${pct === 100 ? 'bg-amber-400 border-amber-400' : 'bg-slate-100 border-slate-200'}`}>
                  🏁
                </div>
              </div>
            </div>

            <div className="relative h-1 bg-slate-100 rounded-full mx-6 mb-4">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-400 rounded-full transition-[left] duration-75"
                style={{ left: `calc(${scrollPct * 100}% - 6px)` }}
              />
            </div>

            <div className="px-6 pb-5">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>{completedCount}/{totalMilestones} milestones complete</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full">
                <div className="h-1.5 bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Quick stats below fence track */}
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Overview</p>
              <div className="space-y-2.5">
                <Row label="Phases"     value={`${completedPhases} / ${totalPhases} complete`} />
                <Row label="Milestones" value={`${completedCount} / ${totalMilestones} complete`} />
                {currentPhase      && <Row label="Current phase"     value={currentPhase.title}     truncate />}
                {currentMilestone  && <Row label="Current milestone" value={currentMilestone.title} truncate />}
                {project.targetEndDate && <Row label="Target date" value={project.targetEndDate} />}
                {pct === 100 && <p className="text-sm text-emerald-600 font-semibold pt-1">Project complete 🎉</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Up Next</p>
              <div className="space-y-2.5">
                {nextDueMilestone ? (
                  <>
                    <Row label="Next due" value={nextDueMilestone.dueDate!} />
                    <p className="text-xs text-slate-400 truncate">{nextDueMilestone.title}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">No upcoming due dates set</p>
                )}
                {activePhase && (
                  <div className="pt-2 border-t border-slate-100">
                    <Row label="Active phase" value={activePhase.title} truncate />
                  </div>
                )}
              </div>
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
          onInvite={() => setShowInvite(true)}
          onToggleCanApprove={async (memberId, val) => {
            await setMemberPermission(project.id, memberId, val);
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

      {showEdit && (
        <EditProjectModal
          project={project}
          isOwner={isOwner}
          onClose={() => setShowEdit(false)}
          onSaved={(updated, _pendingCount) => {
            const fresh = updated.find(p => p.id === project.id);
            if (fresh) {
              setProject(fresh);
              const me = fresh.members?.find(m => m.user.id === user?.id);
              if (me) refreshPending(me.role, me.canApprove);
            }
            setShowEdit(false);
          }}
          onDeleted={() => navigate('/projects')}
        />
      )}

      {/* Milestone detail popup */}
      {selectedMilestone && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

            {effortPending === selectedMilestone.id ? (
              <div className="text-center">
                <p className="text-2xl mb-2">✓</p>
                <p className="text-base font-semibold text-slate-800 mb-1">Marked complete!</p>
                <p className="text-sm text-slate-400 mb-5">How did this compare to your estimate?</p>
                <div className="flex gap-2 mb-4">
                  {EFFORT_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => handleEffortRating(selectedMilestone.id, opt.value)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${opt.color}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setEffortPending(null); setSelectedMilestone(null); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  Skip
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="pr-4">
                    <h2 className="text-base font-semibold text-slate-800">{selectedMilestone.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedMilestone.phaseName}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedMilestone(null); setEffortPending(null); }}
                    className="text-slate-300 hover:text-slate-500 text-xl leading-none shrink-0"
                  >×</button>
                </div>

                {selectedMilestone.description && (
                  <p className="text-sm text-slate-500 mb-4">{selectedMilestone.description}</p>
                )}
                {selectedMilestone.dueDate && (
                  <p className={`text-xs mb-4 ${!selectedMilestone.completed && selectedMilestone.dueDate < TODAY ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
                    📅 Due: {selectedMilestone.dueDate}
                    {!selectedMilestone.completed && selectedMilestone.dueDate < TODAY && ' (overdue)'}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                    ${selectedMilestone.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedMilestone.completed ? '✓ Completed' : '○ Not completed'}
                  </div>
                  {selectedMilestone.effortRating && (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                      ${selectedMilestone.effortRating === 'easier' ? 'bg-emerald-50 text-emerald-600'
                        : selectedMilestone.effortRating === 'harder' ? 'bg-rose-50 text-rose-600'
                        : 'bg-sky-50 text-sky-600'}`}>
                      {selectedMilestone.effortRating === 'easier' ? 'Easier than expected'
                        : selectedMilestone.effortRating === 'harder' ? 'Harder than expected'
                        : 'About right'}
                    </div>
                  )}
                </div>

                {!selectedMilestone.completed && selectedMilestone.dueDate && selectedMilestone.dueDate < TODAY && (
                  <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    {selectedMilestone.blockReason ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2">Blocked by:</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-amber-800">
                            {BLOCK_LABELS[selectedMilestone.blockReason] ?? selectedMilestone.blockReason}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleBlockReason(selectedMilestone.id, selectedMilestone.blockReason!)}
                              className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      </div>
                    ) : canEdit ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-2.5">What's blocking this?</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BLOCK_OPTIONS.map(opt => (
                            <button key={opt.value}
                              onClick={() => handleBlockReason(selectedMilestone.id, opt.value)}
                              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white border border-amber-200 text-xs text-slate-700 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left font-medium">
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

                {canEdit && (
                  <button
                    onClick={() => handleToggleMilestone(selectedMilestone)}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                      ${selectedMilestone.completed
                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        : 'bg-[#0f172a] text-white hover:bg-[#1e293b]'}`}
                  >
                    {selectedMilestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ m, today, onClick, highlight = false }: {
  m: MilestoneWithPhase;
  today: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  const isOverdue = !m.completed && m.dueDate && m.dueDate < today;
  return (
    <div
      onClick={onClick}
      className={`bg-white p-3 rounded-lg border shadow-sm cursor-pointer transition-colors ${
        highlight ? 'border-l-2 border-l-blue-400 border-slate-100 hover:border-blue-200' : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <p className="text-xs text-slate-800 leading-snug mb-2">{m.title}</p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[80px]">{m.phaseName}</span>
        {m.dueDate && (
          <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            {isOverdue ? '⚠ ' : ''}{m.dueDate}
          </span>
        )}
      </div>
      {m.blockReason && (
        <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
          <span>⚠</span>{BLOCK_LABELS[m.blockReason]}
        </p>
      )}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  owner:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  contributor: 'bg-blue-50 text-blue-700 border-blue-200',
  viewer:      'bg-slate-50 text-slate-500 border-slate-200',
};

function MembersSection({ members, currentUserId, isOwner, onInvite, onToggleCanApprove }: {
  members: ProjectMember[];
  currentUserId: string;
  isOwner: boolean;
  onInvite: () => void;
  onToggleCanApprove: (memberId: string, val: boolean) => void;
}) {
  const myMember = members.find(m => m.user.id === currentUserId);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Team</p>
          {myMember && (
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[myMember.role] ?? ROLE_COLORS.viewer}`}>
              You — {myMember.role}
            </span>
          )}
        </div>
        {isOwner ? (
          <button
            onClick={onInvite}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Invite member
          </button>
        ) : (
          <span className="text-xs text-slate-300">{members.length} member{members.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      <ul className="divide-y divide-slate-50">
        {members.map(m => (
          <li key={m.id} className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${memberColor(m.user.name)}`}>
                {m.user.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {m.user.name}
                  {m.user.id === currentUserId && <span className="text-slate-400 font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
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
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-violet-300 hover:text-violet-500'
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
  );
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-slate-800 ${truncate ? 'truncate' : ''}`}>{value}</span>
    </div>
  );
}
