import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Milestone, ProjectMember } from '../types';
import { getProjects, updateMilestone, getProjectInsights } from '../api/client';
import { useAuth } from '../context/AuthContext';
import EditProjectModal from '../components/EditProjectModal';
import InviteModal     from '../components/InviteModal';

type MilestoneWithPhase = Milestone & { phaseId: string };

type VelocityData=
{
  available: false;
} | {
  available: true;
  weeksElapsed: number;
  completedCount: number;
  actualPerWeek: number;
  plannedPerWeek: number | null;
  remainingCount: number;
  revisedFinishDate: string | null;
  targetFinishDate: string | null;
};

interface Insights
{
  healthScore: number;
  velocity: VelocityData;
}

const TODAY=new Date().toISOString().split('T')[0];
const BLOCK_OPTIONS:{ value: 'no_time' | 'unclear' | 'external' | 'motivation'; label: string; icon: string }[] = [
  { value: 'no_time',    label: 'Not enough time',     icon: '⏱' },
  { value: 'unclear',   label: 'Unclear next step',    icon: '❓' },
  { value: 'external',  label: 'Waiting on something', icon: '⏳' },
  { value: 'motivation',label: 'Lost motivation',      icon: '😶' },
];

const EFFORT_OPTIONS:{ value: 'easier' | 'as_expected' | 'harder'; label: string; color: string }[] = [
  { value: 'easier',      label: 'Easier',      color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  { value: 'as_expected', label: 'About right', color: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
  { value: 'harder',      label: 'Harder',      color: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
];
const BLOCK_LABELS: Record<string, string>=
{
  no_time: 'Not enough time', unclear: 'Unclear next step',
  external: 'Waiting on something', motivation: 'Lost motivation',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPhase | null>(null);
  const [effortPending, setEffortPending] = useState<string | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [showEdit,   setShowEdit]   = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const currentMilestoneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    Promise.all([getProjects(), getProjectInsights(id!)])
      .then(([all, ins]) => {
        const found = all.find(p => p.id === id);
        if (found) setProject(found);
        setInsights(ins);
      });
  }, [id]);

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
    if(next) setEffortPending(m.id);
    try {
      const updated = await updateMilestone(m.id, { completed: next });
      setProject(prev => prev ? {
        ...prev,
        phases: prev.phases.map(ph =>
          ph.id === m.phaseId
            ? { ...ph, milestones: ph.milestones.map(ms => ms.id === m.id ? { ...ms, ...updated } : ms) }
            : ph
        )
      } : prev);
      setSelectedMilestone(prev => prev?.id === m.id ? { ...prev, ...updated } : prev);
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
    currentMilestoneRef.current?.scrollIntoView({
      behavior: 'smooth', inline: 'center', block: 'nearest',
    });
  }

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading…</div>
  );

  const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);
  const allMilestones: MilestoneWithPhase[] = sortedPhases.flatMap(ph =>
    [...ph.milestones].sort((a, b) => a.order - b.order).map(m => ({ ...m, phaseId: ph.id }))
  );

  const totalMilestones = allMilestones.length;
  const completedCount = allMilestones.filter(m => m.completed).length;
  const pct = totalMilestones === 0 ? 0 : Math.round((completedCount / totalMilestones) * 100);
  const totalPhases = sortedPhases.length;
  const completedPhases = sortedPhases.filter(ph =>
    ph.milestones.length > 0 && ph.milestones.every(m => m.completed)
  ).length;

  const currentIdx = allMilestones.findIndex(m => !m.completed);
  const currentMilestone = currentIdx >= 0 ? allMilestones[currentIdx] : null;
  const currentPhase = currentMilestone
    ? sortedPhases.find(ph => ph.id === currentMilestone.phaseId)
    : null;
  const nextMilestoneWithDate = allMilestones.find(m => !m.completed && m.dueDate);
  const activePhase = sortedPhases.find(ph => ph.milestones.some(m => !m.completed));

  const myRole    = project.members?.find(m => m.user.id === user?.id)?.role ?? 'viewer';
  const canEdit   = myRole === 'owner' || myRole === 'contributor';
  const isOwner   = myRole === 'owner';

  const healthScore=insights?.healthScore ?? null;
  const healthColor=healthScore === null ? 'text-stone-400'
    : healthScore >= 70 ? 'text-emerald-600'
    : healthScore >= 40 ? 'text-amber-600'
    : 'text-red-500';
  const healthBg=healthScore === null ? 'bg-stone-50 border-stone-100'
    : healthScore >= 70 ? 'bg-emerald-50 border-emerald-100'
    : healthScore >= 40 ? 'bg-amber-50 border-amber-100'
    : 'bg-red-50 border-red-100';

  const vel=insights?.velocity;
  const showVelocity=vel?.available === true;

  return (
    <div className="max-w-4xl mx-auto">

      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 mb-6 transition-colors"
      >
        ← Back to projects
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-semibold text-stone-800 truncate">{project.title}</h1>
          {healthScore !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${healthBg} ${healthColor} shrink-0`}>
              {healthScore} health
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            ✎ Edit
          </button>
        )}
      </div>

      {/* Velocity banner */}
      {showVelocity && vel && vel.available && (
        <div className={`rounded-2xl border p-4 mb-6 ${healthBg}`}>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Velocity</p>
          <p className="text-sm text-stone-700 leading-relaxed">
            Completing <span className="font-semibold">{vel.actualPerWeek}</span> milestone{vel.actualPerWeek !== 1 ? 's' : ''}/week
            {vel.plannedPerWeek !== null && (
              vel.actualPerWeek < vel.plannedPerWeek * 0.8
                ? <span className="text-amber-600"> (planned {vel.plannedPerWeek}/wk — you're behind)</span>
                : vel.actualPerWeek >= vel.plannedPerWeek * 1.1
                ? <span className="text-emerald-600"> (planned {vel.plannedPerWeek}/wk — ahead of schedule)</span>
                : <span className="text-stone-400"> (on track)</span>
            )}.
            {' '}
            {vel.remainingCount === 0
              ? 'All milestones complete.'
              : vel.revisedFinishDate
              ? <>At this pace, finishing around <span className="font-semibold">{vel.revisedFinishDate}</span>
                {vel.targetFinishDate && vel.revisedFinishDate > vel.targetFinishDate && (
                  <span className="text-amber-600"> (target was {vel.targetFinishDate})</span>
                )}.
                </>
              : 'Pace too slow to project a finish date.'
            }
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">Overview</p>
          <div className="space-y-3">
            <Row label="Phases"     value={`${completedPhases} / ${totalPhases} complete`} />
            <Row label="Milestones" value={`${completedCount} / ${totalMilestones} complete`} />
            {currentPhase    && <Row label="Current phase"     value={currentPhase.title}     truncate />}
            {currentMilestone && <Row label="Current milestone" value={currentMilestone.title} truncate />}
            {project.targetEndDate && <Row label="Target date" value={project.targetEndDate} />}
            {pct === 100 && <p className="text-sm text-emerald-600 font-semibold pt-1">Project complete 🎉</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">Up Next</p>
          <div className="space-y-3">
            {nextMilestoneWithDate ? (
              <>
                <Row label="Next milestone due" value={nextMilestoneWithDate.dueDate!} />
                <p className="text-xs text-stone-400 truncate">{nextMilestoneWithDate.title}</p>
              </>
            ) : (
              <p className="text-xs text-stone-400">No upcoming due dates set</p>
            )}
            {activePhase && (
              <div className="pt-2 border-t border-stone-100 mt-2">
                <Row label="Active phase" value={activePhase.title} truncate />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fence track */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
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
                  {phaseIdx > 0 && <div className="w-5 h-0.5 bg-stone-200 shrink-0" />}

                  <div
                    onClick={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
                    className={`shrink-0 rounded-xl border-2 p-3 cursor-pointer transition-all select-none
                      ${phaseComplete
                        ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                        : 'bg-white border-stone-200 hover:border-blue-200 hover:shadow-md'}
                      ${isExpanded ? 'w-52' : 'w-40'}`}
                  >
                    <div className={`w-2 h-2 rounded-full mb-2 shrink-0 ${phaseComplete ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    <p className="text-xs font-bold text-stone-800 leading-tight line-clamp-2">{phase.title}</p>
                    {!isExpanded && (
                      <>
                        {phase.description && <p className="text-xs text-stone-400 mt-1 line-clamp-1">{phase.description}</p>}
                        {nextDue && <p className="text-xs text-stone-400 mt-1.5">📅 {nextDue}</p>}
                        <p className="text-xs text-stone-400 mt-1.5">{phaseDone}/{phaseMilestones.length} done</p>
                      </>
                    )}
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {phase.description && <p className="text-xs text-stone-500 leading-relaxed">{phase.description}</p>}
                        <div className="pt-1.5 border-t border-stone-100 space-y-1">
                          <p className="text-xs text-stone-500"><span className="font-medium">{phaseDone}</span> / {phaseMilestones.length} milestones</p>
                          {nextDue && <p className="text-xs text-stone-400">Next due: {nextDue}</p>}
                          {phaseComplete && <p className="text-xs text-emerald-600 font-medium">✓ Phase complete</p>}
                        </div>
                      </div>
                    )}
                  </div>

                  {phaseMilestones.map((m) => {
                    const globalIdx = allMilestones.findIndex(am => am.id === m.id);
                    const isCurrent = globalIdx === currentIdx;
                    const isOverdue = !m.completed && m.dueDate && m.dueDate < TODAY;

                    return (
                      <Fragment key={m.id}>
                        <div className="w-5 h-0.5 bg-stone-200 shrink-0" />
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
                                : 'bg-white border-stone-200 text-stone-500'}`}
                          >
                            <span className="text-[10px] font-medium text-center leading-tight px-2 line-clamp-4">
                              {m.title}
                            </span>
                          </button>
                          {m.dueDate && (
                            <p className={`text-[10px] mt-1.5 text-center w-20 leading-tight ${isOverdue ? 'text-amber-500 font-medium' : 'text-stone-400'}`}>
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

            <div className="w-5 h-0.5 bg-stone-200 shrink-0" />
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base shrink-0
              ${pct === 100 ? 'bg-amber-400 border-amber-400' : 'bg-stone-100 border-stone-200'}`}>
              🏁
            </div>
          </div>
        </div>

        <div className="relative h-1 bg-stone-100 rounded-full mx-6 mb-4">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-stone-400 rounded-full transition-[left] duration-75"
            style={{ left: `calc(${scrollPct * 100}% - 6px)` }}
          />
        </div>

        <div className="px-6 pb-5">
          <div className="flex justify-between text-xs text-stone-400 mb-1.5">
            <span>{completedCount}/{totalMilestones} milestones complete</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full">
            <div className="h-1.5 bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Members */}
      {project.members && project.members.length > 0 && (
        <MembersSection
          members={project.members}
          currentUserId={user?.id ?? ''}
          isOwner={isOwner}
          onInvite={() => setShowInvite(true)}
        />
      )}

      {showInvite && (
        <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />
      )}

      {showEdit && (
        <EditProjectModal
          project={project}
          isOwner={isOwner}
          onClose={() => setShowEdit(false)}
          onSaved={updated => {
            const fresh = updated.find(p => p.id === project.id);
            if (fresh) setProject(fresh);
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
                <p className="text-base font-semibold text-stone-800 mb-1">Marked complete!</p>
                <p className="text-sm text-stone-400 mb-5">How did this compare to your estimate?</p>
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
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                  Skip
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-lg font-medium text-stone-800 pr-4">{selectedMilestone.title}</h2>
                  <button
                    onClick={() => { setSelectedMilestone(null); setEffortPending(null); }}
                    className="text-stone-300 hover:text-stone-500 text-xl leading-none shrink-0"
                  >×</button>
                </div>

                {selectedMilestone.description && (
                  <p className="text-sm text-stone-500 mb-4">{selectedMilestone.description}</p>
                )}
                {selectedMilestone.dueDate && (
                  <p className={`text-xs mb-4 ${!selectedMilestone.completed && selectedMilestone.dueDate < TODAY ? 'text-amber-500 font-medium' : 'text-stone-400'}`}>
                    📅 Due: {selectedMilestone.dueDate}
                    {!selectedMilestone.completed && selectedMilestone.dueDate < TODAY && ' (overdue)'}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                    ${selectedMilestone.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
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
                        <p className="text-xs font-semibold text-stone-500 mb-2">Blocked by:</p>
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
                        <p className="text-xs font-semibold text-stone-500 mb-2.5">What's blocking this?</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BLOCK_OPTIONS.map(opt => (
                            <button key={opt.value}
                              onClick={() => handleBlockReason(selectedMilestone.id, opt.value)}
                              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white border border-amber-200 text-xs text-stone-700 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left font-medium">
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
                        ? 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                        : 'bg-blue-500 text-white hover:bg-blue-600'}`}
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

const ROLE_COLORS: Record<string, string> = {
  owner:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  contributor: 'bg-blue-50 text-blue-700 border-blue-200',
  viewer:      'bg-stone-50 text-stone-500 border-stone-200',
};

function MembersSection({ members, currentUserId, isOwner, onInvite }: {
  members: ProjectMember[];
  currentUserId: string;
  isOwner: boolean;
  onInvite: () => void;
}) {
  const myMember = members.find(m => m.user.id === currentUserId);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mt-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Team</p>
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
            + Invite
          </button>
        ) : (
          <span className="text-xs text-stone-300">{members.length} member{members.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      <ul className="divide-y divide-stone-50">
        {members.map(m => (
          <li key={m.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm font-semibold text-stone-600 shrink-0">
                {m.user.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">
                  {m.user.name}
                  {m.user.id === currentUserId && <span className="text-stone-400 font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-stone-400">{m.user.email}</p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>
              {m.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-stone-500 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-stone-800 ${truncate ? 'truncate' : ''}`}>{value}</span>
    </div>
  );
}
