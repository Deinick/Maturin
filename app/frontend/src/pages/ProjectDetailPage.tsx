import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Phase, Milestone } from '../types';
import { getProjects, updateMilestone } from '../api/client';
import EditProjectModal from '../components/EditProjectModal';

type MilestoneWithPhase = Milestone & { phaseId: string };

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithPhase | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const currentMilestoneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getProjects().then(all => {
      const found = all.find(p => p.id === id);
      if (found) setProject(found);
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
    try {
      await updateMilestone(m.id, { completed: next });
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
    }
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

  return (
    <div className="max-w-4xl mx-auto">

      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 mb-6 transition-colors"
      >
        ← Back to projects
      </button>

      {/* Title + Edit */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">{project.title}</h1>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          ✎ Edit
        </button>
      </div>

      {/* Two-column overview */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">Overview</p>
          <div className="space-y-3">
            <Row label="Phases" value={`${completedPhases} / ${totalPhases} complete`} />
            <Row label="Milestones" value={`${completedCount} / ${totalMilestones} complete`} />
            {currentPhase && <Row label="Current phase" value={currentPhase.title} truncate />}
            {currentMilestone && <Row label="Current milestone" value={currentMilestone.title} truncate />}
            {project.targetEndDate && <Row label="Target date" value={project.targetEndDate} />}
            {pct === 100 && (
              <p className="text-sm text-emerald-600 font-semibold pt-1">Project complete 🎉</p>
            )}
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

      {/* ── Fence track ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">

        {/* Go to current */}
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

        {/* Scrollable fence */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="overflow-x-auto"
        >
          <div className="flex items-center min-w-max px-6 py-10 gap-0">

            {sortedPhases.map((phase, phaseIdx) => {
              const phaseMilestones = allMilestones.filter(m => m.phaseId === phase.id);
              const phaseDone = phaseMilestones.filter(m => m.completed).length;
              const phaseComplete = phaseMilestones.length > 0 && phaseDone === phaseMilestones.length;
              const isExpanded = expandedPhaseId === phase.id;
              const nextDue = phaseMilestones.find(m => !m.completed && m.dueDate)?.dueDate;

              return (
                <Fragment key={phase.id}>
                  {/* Connector between phases (not before first) */}
                  {phaseIdx > 0 && <div className="w-5 h-0.5 bg-stone-200 shrink-0" />}

                  {/* Phase card */}
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
                        {phase.description && (
                          <p className="text-xs text-stone-400 mt-1 line-clamp-1">{phase.description}</p>
                        )}
                        {nextDue && (
                          <p className="text-xs text-stone-400 mt-1.5">📅 {nextDue}</p>
                        )}
                        <p className="text-xs text-stone-400 mt-1.5">{phaseDone}/{phaseMilestones.length} done</p>
                      </>
                    )}

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {phase.description && (
                          <p className="text-xs text-stone-500 leading-relaxed">{phase.description}</p>
                        )}
                        <div className="pt-1.5 border-t border-stone-100 space-y-1">
                          <p className="text-xs text-stone-500">
                            <span className="font-medium">{phaseDone}</span> / {phaseMilestones.length} milestones complete
                          </p>
                          {nextDue && (
                            <p className="text-xs text-stone-400">Next due: {nextDue}</p>
                          )}
                          {phaseComplete && (
                            <p className="text-xs text-emerald-600 font-medium">✓ Phase complete</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Milestones belonging to this phase */}
                  {phaseMilestones.map((m) => {
                    const globalIdx = allMilestones.findIndex(am => am.id === m.id);
                    const isCurrent = globalIdx === currentIdx;

                    return (
                      <Fragment key={m.id}>
                        {/* Connector line */}
                        <div className="w-5 h-0.5 bg-stone-200 shrink-0" />

                        {/* Milestone node */}
                        <div className="relative flex flex-col items-center shrink-0">
                          {/* Current flag — absolutely positioned above */}
                          {isCurrent && (
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-base pointer-events-none select-none">
                              🚩
                            </span>
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
                                : 'bg-white border-stone-200 text-stone-500'}`}
                          >
                            <span className="text-[10px] font-medium text-center leading-tight px-2 line-clamp-4">
                              {m.title}
                            </span>
                          </button>
                          {/* Due date below circle */}
                          {m.dueDate && (
                            <p className="text-[10px] text-stone-400 mt-1.5 text-center w-20 leading-tight">
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

            {/* Finish flag */}
            <div className="w-5 h-0.5 bg-stone-200 shrink-0" />
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base shrink-0
              ${pct === 100 ? 'bg-amber-400 border-amber-400' : 'bg-stone-100 border-stone-200'}`}>
              🏁
            </div>

          </div>
        </div>

        {/* Scroll position dot */}
        <div className="relative h-1 bg-stone-100 rounded-full mx-6 mb-4">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-stone-400 rounded-full transition-[left] duration-75"
            style={{ left: `calc(${scrollPct * 100}% - 6px)` }}
          />
        </div>

        {/* Completion bar */}
        <div className="px-6 pb-5">
          <div className="flex justify-between text-xs text-stone-400 mb-1.5">
            <span>{completedCount}/{totalMilestones} milestones complete</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full">
            <div
              className="h-1.5 bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Edit project modal */}
      {showEdit && (
        <EditProjectModal
          project={project}
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
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-medium text-stone-800 pr-4">{selectedMilestone.title}</h2>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-stone-300 hover:text-stone-500 text-xl leading-none shrink-0"
              >
                ×
              </button>
            </div>
            {selectedMilestone.description && (
              <p className="text-sm text-stone-500 mb-4">{selectedMilestone.description}</p>
            )}
            {selectedMilestone.dueDate && (
              <p className="text-xs text-stone-400 mb-4">📅 Due: {selectedMilestone.dueDate}</p>
            )}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-5
              ${selectedMilestone.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
              {selectedMilestone.completed ? '✓ Completed' : '○ Not completed'}
            </div>
            <button
              onClick={() => handleToggleMilestone(selectedMilestone)}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                ${selectedMilestone.completed
                  ? 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            >
              {selectedMilestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
            </button>
          </div>
        </div>
      )}
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
