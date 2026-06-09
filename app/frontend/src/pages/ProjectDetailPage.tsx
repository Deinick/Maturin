import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Milestone } from '../types';
import { getProjects, updateMilestone } from '../api/client';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  useEffect(() => {
    getProjects().then(all => {
      const found = all.find(p => p.id === id);
      if (found) setProject(found);
    });
  }, [id]);

  async function handleToggleMilestone(milestone: Milestone, phaseId: string) {
    const updated = await updateMilestone(milestone.id, { completed: !milestone.completed });
    setProject(prev => prev ? {
      ...prev,
      phases: prev.phases.map(ph =>
        ph.id === phaseId
          ? { ...ph, milestones: ph.milestones.map(m => m.id === updated.id ? updated : m) }
          : ph
      )
    } : prev);
    setSelectedMilestone(prev => prev?.id === updated.id ? updated : prev);
  }

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
  );

  const allMilestones = project.phases
    .sort((a, b) => a.order - b.order)
    .flatMap(ph => ph.milestones.sort((a, b) => a.order - b.order).map(m => ({ ...m, phaseId: ph.id })));

  const currentIdx = allMilestones.findIndex(m => !m.completed);
  const totalMilestones = allMilestones.length;
  const completedCount = allMilestones.filter(m => m.completed).length;
  const pct = totalMilestones === 0 ? 0 : Math.round((completedCount / totalMilestones) * 100);

  return (
    <div className="max-w-lg mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
      >
        ← Back to projects
      </button>

      {/* Project header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 mb-8">
        <h1 className="text-2xl font-light text-gray-800 mb-1">{project.title}</h1>
        {project.description && (
          <div>
            <p className={`text-sm text-gray-400 ${descExpanded ? '' : 'line-clamp-2'}`}>
              {project.description}
            </p>
            {project.description.length > 100 && (
              <button
                onClick={() => setDescExpanded(e => !e)}
                className="text-xs text-blue-400 hover:text-blue-600 mt-1"
              >
                {descExpanded ? '▲ Show less' : '▼ Show more'}
              </button>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{completedCount} of {totalMilestones} milestones</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div className="h-1.5 bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {project.targetEndDate && (
          <p className="text-xs text-gray-400 mt-3">🎯 Target: {project.targetEndDate}</p>
        )}
      </div>

      {/* Duolingo-style ladder */}
      <div className="relative">
        {project.phases.sort((a, b) => a.order - b.order).map((phase, phaseIdx) => {
          const phaseMilestones = phase.milestones.sort((a, b) => a.order - b.order);

          return (
            <div key={phase.id}>
              {/* Section header — like Duolingo's section banner */}
              <div className={`relative z-10 flex items-center gap-3 rounded-2xl px-5 py-3 mb-6 ${phase.completed ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${phase.completed ? 'bg-emerald-400' : 'bg-blue-400'}`}>
                  {phaseIdx + 1}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${phase.completed ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {phase.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {phaseMilestones.filter(m => m.completed).length}/{phaseMilestones.length} completed
                  </p>
                </div>
                {phase.completed && <span className="ml-auto text-emerald-500 text-lg">✓</span>}
              </div>

              {/* Milestones as a vertical path */}
              <div className="relative ml-8 mb-8">
                {/* Vertical line */}
                {phaseMilestones.length > 0 && (
                  <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200 z-0" />
                )}

                <div className="space-y-4">
                  {phaseMilestones.map((milestone, mIdx) => {
                    const globalIdx = allMilestones.findIndex(m => m.id === milestone.id);
                    const isCurrent = globalIdx === currentIdx;
                    const isPast = milestone.completed;
                    const isFuture = !milestone.completed && globalIdx > currentIdx;

                    return (
                      <div key={milestone.id} className="relative z-10 flex items-center gap-4">
                        {/* Flag for current position */}
                        {isCurrent && (
                          <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-red-500 text-lg animate-bounce">
                            🚩
                          </div>
                        )}

                        {/* Milestone node */}
                        <button
                          onClick={() => setSelectedMilestone({ ...milestone, phaseId: phase.id } as Milestone & { phaseId: string })}
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all shadow-sm ${
                            isPast
                              ? 'bg-emerald-400 border-emerald-400 text-white hover:bg-emerald-500'
                              : isCurrent
                              ? 'bg-white border-blue-400 text-blue-500 hover:bg-blue-50 ring-4 ring-blue-100'
                              : 'bg-white border-gray-200 text-gray-300 hover:border-gray-300'
                          }`}
                        >
                          {isPast
                            ? <span className="text-sm">✓</span>
                            : <span className="text-xs font-bold">{mIdx + 1}</span>
                          }
                        </button>

                        {/* Milestone label */}
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedMilestone({ ...milestone, phaseId: phase.id } as Milestone & { phaseId: string })}
                        >
                          <p className={`text-sm font-medium ${isPast ? 'text-gray-400 line-through' : isCurrent ? 'text-gray-800' : 'text-gray-400'}`}>
                            {milestone.title}
                          </p>
                          {milestone.dueDate && (
                            <p className="text-xs text-gray-300 mt-0.5">Due {milestone.dueDate}</p>
                          )}
                        </div>

                        {isFuture && (
                          <span className="text-gray-200 text-xs">🔒</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Finish line */}
        {totalMilestones > 0 && (
          <div className="flex items-center gap-3 ml-8 mt-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${pct === 100 ? 'bg-amber-400 border-amber-400' : 'bg-gray-100 border-gray-200'}`}>
              🏁
            </div>
            <p className={`text-sm font-medium ${pct === 100 ? 'text-amber-600' : 'text-gray-300'}`}>
              {pct === 100 ? 'Project complete!' : 'Finish line'}
            </p>
          </div>
        )}
      </div>

      {/* Milestone detail popup */}
      {selectedMilestone && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-800 pr-4">{selectedMilestone.title}</h2>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-gray-300 hover:text-gray-500 text-xl leading-none shrink-0"
              >
                ×
              </button>
            </div>

            {selectedMilestone.description && (
              <p className="text-sm text-gray-500 mb-4">{selectedMilestone.description}</p>
            )}

            {selectedMilestone.dueDate && (
              <p className="text-xs text-gray-400 mb-4">📅 Due: {selectedMilestone.dueDate}</p>
            )}

            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-5 ${selectedMilestone.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              <span>{selectedMilestone.completed ? '✓ Completed' : '○ Not completed'}</span>
            </div>

            <button
              onClick={() => {
                const phaseId = (selectedMilestone as Milestone & { phaseId: string }).phaseId;
                handleToggleMilestone(selectedMilestone, phaseId);
              }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedMilestone.completed
                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {selectedMilestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
