import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Phase, Milestone } from '../types';
import {
  getProjects, createProject, createPhase, createMilestone, getAllPendingChangeCounts,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import EditProjectModal from '../components/EditProjectModal';
import sleepingTurtle from '../assets/Turtles/0609 (1).png';

type CreateStep = 'project' | 'phases' | 'milestones';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<CreateStep>('project');
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [form, setForm] = useState({ title: '', description: '', targetEndDate: '' });
  const [phases, setPhases] = useState<{ title: string }[]>([{ title: '' }]);
  const [milestonesMap, setMilestonesMap] = useState<Record<number, { title: string; dueDate: string }[]>>({});

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getProjects().then(setProjects);
    getAllPendingChangeCounts()
      .then(counts => {
        const map: Record<string, number> = {};
        counts.forEach(c => { map[c.projectId] = c.count; });
        setPendingCounts(map);
      })
      .catch(() => {});
  }, []);

  function resetModal() {
    setStep('project'); setForm({ title: '', description: '', targetEndDate: '' });
    setPhases([{ title: '' }]); setMilestonesMap({});
    setCreatedProject(null); setActivePhaseIdx(0); setShowModal(false);
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
    setProjects(prev => [...prev, { ...proj, phases: updatedPhases }]);
    resetModal();
  }

  function goToCreateStep(s: CreateStep) {
    if (s === 'project') { setStep('project'); return; }
    if (s === 'phases' && createdProject) { setStep('phases'); return; }
    if (s === 'milestones' && (createdProject?.phases.length ?? 0) > 0) { setStep('milestones'); return; }
  }

  function phaseHasNoMilestones(idx: number) {
    return !(milestonesMap[idx] ?? []).some(m => m.title.trim());
  }

  function getProgress(project: Project) {
    const total = project.phases.reduce((s, ph) => s + ph.milestones.length, 0);
    const done = project.phases.reduce((s, ph) => s + ph.milestones.filter(m => m.completed).length, 0);
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function getHealthDot(project: Project): string {
    const milestones = project.phases.flatMap(ph => ph.milestones);
    const total = milestones.length;
    if (total === 0) return 'bg-stone-200';
    const today = new Date().toISOString().split('T')[0];
    const done = milestones.filter(m => m.completed).length;
    const dueable = milestones.filter(m => m.dueDate).length;
    const overdue = milestones.filter(m => !m.completed && m.dueDate && m.dueDate < today).length;
    const completionRate = done / total;
    const overdueScore = dueable === 0 ? 0.8 : 1 - (overdue / dueable);
    const score = Math.round((0.6 * completionRate + 0.4 * overdueScore) * 100);
    return score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400';
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-stone-800">Projects</h1>
          <p className="text-sm text-stone-400 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors">
          <span className="text-lg leading-none">+</span> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <img src={sleepingTurtle} alt="Resting turtle" className="turtle-img w-40 h-40 object-contain opacity-80" />
          <div className="text-center">
            <p className="serif text-xl font-semibold text-stone-700">No projects yet</p>
            <p className="text-stone-400 text-sm mt-1">Break your big goals into phases and milestones — start with one.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 transition-colors">
            Create your first project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const { total, done, pct } = getProgress(project);
            const myRole = project.members?.find(m => m.user.id === user?.id)?.role ?? 'viewer';
            const canEdit = myRole === 'owner' || myRole === 'contributor';
            return (
              <div key={project.id}
                className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${getHealthDot(project)}`}
                        title="Project health"
                      />
                      {pendingCounts[project.id] > 0 && (
                        <span
                          title={`${pendingCounts[project.id]} change${pendingCounts[project.id] !== 1 ? 's' : ''} need review`}
                          className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        >!</span>
                      )}
                      <p className="font-medium text-sm text-stone-800">{project.title}</p>
                      {myRole !== 'owner' && (
                        <span className="text-xs text-stone-400 border border-stone-200 px-1.5 py-0.5 rounded-full capitalize shrink-0">
                          {myRole}
                        </span>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-stone-100 rounded-full">
                          <div className="h-1 bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-stone-400 shrink-0">{done}/{total}</span>
                      </div>
                    )}
                  </div>

                  {project.targetEndDate && (
                    <span className="text-xs text-stone-400 shrink-0">{project.targetEndDate}</span>
                  )}

                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditingProject(project); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0 text-sm"
                      title="Edit project"
                    >
                      ✎
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CreateStepIndicator
              step={step}
              createdProject={createdProject}
              goToStep={goToCreateStep}
            />
            <div className="px-6 py-5">
              {step === 'project' && (
                <ProjectForm form={form} setForm={setForm} />
              )}
              {step === 'phases' && (
                <PhasesForm phases={phases} setPhases={setPhases} />
              )}
              {step === 'milestones' && createdProject && (
                <MilestonesForm
                  phaseTabs={createdProject.phases}
                  activeIdx={activePhaseIdx}
                  setActiveIdx={setActivePhaseIdx}
                  milestonesMap={milestonesMap}
                  setMilestonesMap={setMilestonesMap}
                  phaseHasNoMilestones={phaseHasNoMilestones}
                />
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={resetModal}
                className="flex-1 py-2.5 rounded-lg text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={step === 'project' ? handleStep1 : step === 'phases' ? handleStep2 : handleStep3}
                disabled={!form.title.trim() && step === 'project'}
                className="flex-1 py-2.5 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 transition-colors font-medium">
                {step === 'milestones' ? 'Create Project' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          isOwner={editingProject.members?.find(m => m.user.id === user?.id)?.role === 'owner'}
          onClose={() => setEditingProject(null)}
          onSaved={(updated, _pending) => { setProjects(updated); setEditingProject(null); }}
          onDeleted={id => { setProjects(prev => prev.filter(p => p.id !== id)); setEditingProject(null); }}
        />
      )}
    </div>
  );
}


function CreateStepIndicator({
  step, createdProject, goToStep,
}: {
  step: CreateStep;
  createdProject: Project | null;
  goToStep: (s: CreateStep) => void;
}) {
  const steps: CreateStep[] = ['project', 'phases', 'milestones'];
  const labels = ['Details', 'Phases', 'Milestones'];
  const cur = steps.indexOf(step);

  function canNavigate(s: CreateStep) {
    if (s === 'project') return true;
    if (s === 'phases') return createdProject !== null;
    if (s === 'milestones') return (createdProject?.phases.length ?? 0) > 0;
    return false;
  }

  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-stone-100">
      {steps.map((s, i) => {
        const enabled = canNavigate(s);
        return (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => enabled && goToStep(s)}
              disabled={!enabled}
              title={!enabled ? (s === 'milestones' ? 'Complete phases step first' : undefined) : undefined}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                ${!enabled
                  ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                  : cur === i
                  ? 'bg-blue-500 text-white'
                  : cur > i
                  ? 'bg-emerald-400 text-white hover:bg-emerald-500 cursor-pointer'
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
            >
              {cur > i ? '✓' : i + 1}
            </button>
            <span className={`text-xs ${cur === i ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>{labels[i]}</span>
            {i < 2 && <div className="w-6 h-px bg-stone-200 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}


function ProjectForm({
  form, setForm,
}: {
  form: { title: string; description: string; targetEndDate: string };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; targetEndDate: string }>>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-stone-800">Project details</h2>
      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Title *</label>
        <input autoFocus
          className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="e.g. Build personal website"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Description</label>
        <textarea
          className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
          placeholder="What is this project about?"
          rows={3}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Target end date</label>
        <input type="date"
          className="w-full mt-1.5 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={form.targetEndDate}
          onChange={e => setForm(f => ({ ...f, targetEndDate: e.target.value }))}
        />
      </div>
    </div>
  );
}

function PhasesForm({
  phases, setPhases,
}: {
  phases: { title: string }[];
  setPhases: React.Dispatch<React.SetStateAction<{ title: string }[]>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-800">Add phases</h2>
        <p className="text-xs text-stone-400 mt-0.5">Break your project into stages, e.g. Research, Design, Build.</p>
      </div>
      <div className="space-y-2">
        {phases.map((phase, i) => (
          <div key={i} className="bg-stone-50 rounded-xl p-3 flex items-center gap-2">
            <span className="text-xs text-stone-400 w-16 shrink-0">Phase {i + 1}</span>
            <input
              className="flex-1 bg-transparent border-none outline-none text-sm text-stone-800 focus:ring-0"
              placeholder="Phase title"
              value={phase.title}
              onChange={e => setPhases(prev => prev.map((p, j) => j === i ? { title: e.target.value } : p))}
            />
            {phases.length > 1 && (
              <button onClick={() => setPhases(prev => prev.filter((_, j) => j !== i))}
                className="text-stone-400 hover:text-red-400 text-base leading-none transition-colors">×</button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => setPhases(prev => [...prev, { title: '' }])}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm text-stone-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
        + Add another phase
      </button>
    </div>
  );
}

function MilestonesForm({
  phaseTabs, activeIdx, setActiveIdx, milestonesMap, setMilestonesMap, phaseHasNoMilestones,
}: {
  phaseTabs: Phase[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  milestonesMap: Record<number, { title: string; dueDate: string }[]>;
  setMilestonesMap: React.Dispatch<React.SetStateAction<Record<number, { title: string; dueDate: string }[]>>>;
  phaseHasNoMilestones: (i: number) => boolean;
}) {
  const activePhaseName = phaseTabs[activeIdx]?.title?.trim() || `Phase ${activeIdx + 1}`;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-stone-800">Milestones for {activePhaseName}:</h2>
      <div className="flex gap-2 flex-wrap">
        {phaseTabs.map((ph, i) => (
          <button key={ph.id} onClick={() => setActiveIdx(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${activeIdx === i ? 'bg-blue-500 text-white'
                : phaseHasNoMilestones(i) ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-300'
                : 'bg-stone-100 text-stone-500'}`}>
            {ph.title}{phaseHasNoMilestones(i) && <span className="ml-1">!</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {(milestonesMap[activeIdx] ?? []).map((m, i) => (
          <div key={i} className="bg-stone-50 rounded-xl p-3 relative">
            <input
              className="w-full bg-transparent border-none outline-none text-sm text-stone-800 focus:ring-0 mb-1.5"
              placeholder="Milestone title"
              value={m.title}
              onChange={e => setMilestonesMap(prev => ({
                ...prev,
                [activeIdx]: prev[activeIdx].map((ms, j) => j === i ? { ...ms, title: e.target.value } : ms),
              }))}
            />
            <input type="date"
              className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={m.dueDate}
              onChange={e => setMilestonesMap(prev => ({
                ...prev,
                [activeIdx]: prev[activeIdx].map((ms, j) => j === i ? { ...ms, dueDate: e.target.value } : ms),
              }))}
            />
            {(milestonesMap[activeIdx] ?? []).length > 1 && (
              <button
                onClick={() => setMilestonesMap(prev => ({
                  ...prev, [activeIdx]: prev[activeIdx].filter((_, j) => j !== i),
                }))}
                className="absolute top-2.5 right-2.5 text-stone-400 hover:text-red-400 text-base leading-none transition-colors">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => setMilestonesMap(prev => ({
          ...prev, [activeIdx]: [...(prev[activeIdx] ?? []), { title: '', dueDate: '' }],
        }))}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm text-stone-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
        + Add another milestone
      </button>
    </div>
  );
}
