import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Phase, Milestone } from '../types';
import {
  getProjects, createProject, createPhase, createMilestone,
  updateMilestone, updatePhase, updateProject,
} from '../api/client';

type Step = 'project' | 'phases' | 'milestones';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<Step>('project');
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  // Step 1 form
  const [form, setForm] = useState({ title: '', description: '', targetEndDate: '' });

  // Step 2 — phases being built
  const [phases, setPhases] = useState<{ title: string; description: string }[]>([
    { title: '', description: '' },
  ]);

  // Step 3 — milestones per phase (by index)
  const [milestonesMap, setMilestonesMap] = useState<Record<number, { title: string; dueDate: string }[]>>({});

  useEffect(() => {
    getProjects().then(setProjects);
  }, []);

  function resetModal() {
    setStep('project');
    setForm({ title: '', description: '', targetEndDate: '' });
    setPhases([{ title: '', description: '' }]);
    setMilestonesMap({});
    setCreatedProject(null);
    setActivePhaseIdx(0);
    setShowModal(false);
  }

  async function handleStep1() {
    if (!form.title.trim()) return;
    const project = await createProject(form.title.trim(), form.description || undefined, form.targetEndDate || undefined);
    setCreatedProject({ ...project, phases: [] });
    setStep('phases');
  }

  async function handleStep2() {
    const valid = phases.filter(p => p.title.trim());
    if (valid.length === 0) return;
    const created: Phase[] = [];
    for (let i = 0; i < valid.length; i++) {
      const phase = await createPhase(createdProject!.id, valid[i].title.trim(), i + 1);
      created.push({ ...phase, milestones: [] });
    }
    setCreatedProject(prev => prev ? { ...prev, phases: created } : prev);
    const initial: Record<number, { title: string; dueDate: string }[]> = {};
    created.forEach((_, i) => { initial[i] = [{ title: '', dueDate: '' }]; });
    setMilestonesMap(initial);
    setStep('milestones');
    setActivePhaseIdx(0);
  }

  async function handleStep3() {
    const proj = createdProject!;
    const updatedPhases: Phase[] = [];
    for (let i = 0; i < proj.phases.length; i++) {
      const phase = proj.phases[i];
      const items = (milestonesMap[i] ?? []).filter(m => m.title.trim());
      const milestones: Milestone[] = [];
      for (let j = 0; j < items.length; j++) {
        const m = await createMilestone(phase.id, items[j].title.trim(), j + 1, items[j].dueDate || undefined);
        milestones.push(m);
      }
      updatedPhases.push({ ...phase, milestones });
    }
    const finalProject = { ...proj, phases: updatedPhases };
    setProjects(prev => [...prev, finalProject]);
    resetModal();
  }

  async function handleToggleMilestone(m: Milestone, phaseId: string, projectId: string) {
    const updated = await updateMilestone(m.id, { completed: !m.completed });
    setProjects(prev => prev.map(p =>
      p.id === projectId ? {
        ...p, phases: p.phases.map(ph =>
          ph.id === phaseId ? { ...ph, milestones: ph.milestones.map(ms => ms.id === updated.id ? updated : ms) } : ph
        )
      } : p
    ));
  }

  async function handleTogglePhase(phase: Phase, projectId: string) {
    const updated = await updatePhase(phase.id, { completed: !phase.completed });
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, phases: p.phases.map(ph => ph.id === phase.id ? { ...ph, completed: updated.completed } : ph) } : p
    ));
  }

  async function handleToggleProject(project: Project) {
    const updated = await updateProject(project.id, { completed: !project.completed });
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, completed: updated.completed } : p));
  }

  function getProgress(project: Project) {
    const total = project.phases.reduce((s, ph) => s + ph.milestones.length, 0);
    const done = project.phases.reduce((s, ph) => s + ph.milestones.filter(m => m.completed).length, 0);
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function phaseHasNoMilestones(idx: number) {
    return !(milestonesMap[idx] ?? []).some(m => m.title.trim());
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-800">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">◇</p>
          <p className="text-gray-400 text-sm">No projects yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-500 text-sm hover:underline"
          >
            Create your first project →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const { total, done, pct } = getProgress(project);
            const isOpen = expandedId === project.id;
            return (
              <div key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleProject(project); }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${project.completed ? 'bg-emerald-400 border-emerald-400' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    {project.completed && <span className="text-white text-xs">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${project.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {project.title}
                    </p>
                    {total > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full">
                          <div className="h-1 bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{done}/{total}</span>
                      </div>
                    )}
                  </div>

                  {project.targetEndDate && (
                    <span className="text-xs text-gray-400 shrink-0">{project.targetEndDate}</span>
                  )}
                  <span className="text-gray-300 text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-50 px-5 pb-5 pt-4">
                    {project.description && (
                      <p className="text-xs text-gray-400 mb-4">{project.description}</p>
                    )}
                    <div className="space-y-4">
                      {project.phases.sort((a, b) => a.order - b.order).map(phase => (
                        <div key={phase.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => handleTogglePhase(phase, project.id)}
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${phase.completed ? 'bg-emerald-400 border-emerald-400' : 'border-gray-300 hover:border-blue-400'}`}
                            >
                              {phase.completed && <span className="text-white" style={{ fontSize: 8 }}>✓</span>}
                            </button>
                            <span className={`text-xs font-semibold uppercase tracking-wide ${phase.completed ? 'line-through text-gray-300' : 'text-gray-500'}`}>
                              {phase.title}
                            </span>
                          </div>
                          <div className="ml-6 space-y-1.5">
                            {phase.milestones.sort((a, b) => a.order - b.order).map(m => (
                              <div key={m.id} className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleMilestone(m, phase.id, project.id)}
                                  className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${m.completed ? 'bg-emerald-400 border-emerald-400' : 'border-gray-200 hover:border-blue-400'}`}
                                >
                                  {m.completed && <span className="text-white" style={{ fontSize: 7 }}>✓</span>}
                                </button>
                                <span className={`text-xs ${m.completed ? 'line-through text-gray-300' : 'text-gray-600'}`}>{m.title}</span>
                                {m.dueDate && <span className="text-xs text-gray-300 ml-auto">{m.dueDate}</span>}
                              </div>
                            ))}
                            {phase.milestones.length === 0 && (
                              <p className="text-xs text-gray-300 italic">No milestones</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Step indicator */}
            <div className="flex items-center gap-2 px-6 pt-6 pb-4 border-b border-gray-100">
              {(['project', 'phases', 'milestones'] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${step === s ? 'bg-blue-500 text-white' : ['project', 'phases', 'milestones'].indexOf(step) > i ? 'bg-emerald-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {['project', 'phases', 'milestones'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs ${step === s ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                  {i < 2 && <div className="w-6 h-px bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>

            <div className="px-6 py-5">

              {/* Step 1 — Project info */}
              {step === 'project' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-800">Project details</h2>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title *</label>
                    <input
                      autoFocus
                      className="w-full mt-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="e.g. Build personal website"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                    <textarea
                      className="w-full mt-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                      placeholder="What is this project about?"
                      rows={3}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Target end date</label>
                    <input
                      type="date"
                      className="w-full mt-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.targetEndDate}
                      onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 — Phases */}
              {step === 'phases' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-800">Add phases</h2>
                  <p className="text-xs text-gray-400">Break your project into stages, e.g. Research, Design, Build.</p>
                  <div className="space-y-3">
                    {phases.map((phase, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 relative">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Phase {i + 1}</p>
                        <input
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                          placeholder="Phase title"
                          value={phase.title}
                          onChange={e => setPhases(prev => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                        />
                        {phases.length > 1 && (
                          <button
                            onClick={() => setPhases(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-3 right-3 text-gray-300 hover:text-red-400 text-lg leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setPhases(prev => [...prev, { title: '', description: '' }])}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
                  >
                    + Add another phase
                  </button>
                </div>
              )}

              {/* Step 3 — Milestones */}
              {step === 'milestones' && createdProject && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-800">Add milestones</h2>
                  <p className="text-xs text-gray-400">Add milestones to each phase. At least one per phase is required.</p>

                  {/* Phase tabs */}
                  <div className="flex gap-2 flex-wrap">
                    {createdProject.phases.map((phase, i) => (
                      <button
                        key={phase.id}
                        onClick={() => setActivePhaseIdx(i)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          activePhaseIdx === i
                            ? 'bg-blue-500 text-white'
                            : phaseHasNoMilestones(i)
                            ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-300'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {phase.title}
                        {phaseHasNoMilestones(i) && <span className="ml-1">!</span>}
                      </button>
                    ))}
                  </div>

                  {/* Milestones for active phase */}
                  <div className="space-y-3">
                    {(milestonesMap[activePhaseIdx] ?? []).map((m, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 relative">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Milestone {i + 1}</p>
                        <input
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white mb-2"
                          placeholder="Milestone title"
                          value={m.title}
                          onChange={e => setMilestonesMap(prev => ({
                            ...prev,
                            [activePhaseIdx]: prev[activePhaseIdx].map((ms, j) => j === i ? { ...ms, title: e.target.value } : ms),
                          }))}
                        />
                        <input
                          type="date"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                          value={m.dueDate}
                          onChange={e => setMilestonesMap(prev => ({
                            ...prev,
                            [activePhaseIdx]: prev[activePhaseIdx].map((ms, j) => j === i ? { ...ms, dueDate: e.target.value } : ms),
                          }))}
                        />
                        {(milestonesMap[activePhaseIdx] ?? []).length > 1 && (
                          <button
                            onClick={() => setMilestonesMap(prev => ({
                              ...prev,
                              [activePhaseIdx]: prev[activePhaseIdx].filter((_, j) => j !== i),
                            }))}
                            className="absolute top-3 right-3 text-gray-300 hover:text-red-400 text-lg leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setMilestonesMap(prev => ({
                      ...prev,
                      [activePhaseIdx]: [...(prev[activePhaseIdx] ?? []), { title: '', dueDate: '' }],
                    }))}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
                  >
                    + Add another milestone
                  </button>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={resetModal}
                className="flex-1 py-2.5 rounded-lg text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={step === 'project' ? handleStep1 : step === 'phases' ? handleStep2 : handleStep3}
                className="flex-1 py-2.5 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 transition-colors font-medium"
              >
                {step === 'milestones' ? 'Create Project' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
