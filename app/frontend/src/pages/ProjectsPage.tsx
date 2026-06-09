import { useEffect, useState } from 'react';
import type { Project, Phase, Milestone } from '../types';
import {
  getProjects, createProject, createPhase, createMilestone,
  updateMilestone, updatePhase, updateProject,
} from '../api/client';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [newMilestoneTitles, setNewMilestoneTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    getProjects().then(setProjects);
  }, []);

  async function handleAddProject() {
    if (!newProjectTitle.trim()) return;
    const project = await createProject(newProjectTitle.trim());
    setProjects(prev => [...prev, { ...project, phases: [] }]);
    setNewProjectTitle('');
  }

  async function handleAddPhase(projectId: string) {
    if (!newPhaseTitle.trim()) return;
    const project = projects.find(p => p.id === projectId)!;
    const order = project.phases.length + 1;
    const phase = await createPhase(projectId, newPhaseTitle.trim(), order);
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, phases: [...p.phases, { ...phase, milestones: [] }] } : p
    ));
    setNewPhaseTitle('');
  }

  async function handleAddMilestone(phaseId: string, projectId: string) {
    const title = newMilestoneTitles[phaseId]?.trim();
    if (!title) return;
    const phase = projects.find(p => p.id === projectId)!.phases.find(ph => ph.id === phaseId)!;
    const order = phase.milestones.length + 1;
    const milestone = await createMilestone(phaseId, title, order);
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? {
            ...p,
            phases: p.phases.map(ph =>
              ph.id === phaseId ? { ...ph, milestones: [...ph.milestones, milestone] } : ph
            ),
          }
        : p
    ));
    setNewMilestoneTitles(prev => ({ ...prev, [phaseId]: '' }));
  }

  async function handleToggleMilestone(milestone: Milestone, phaseId: string, projectId: string) {
    const updated = await updateMilestone(milestone.id, { completed: !milestone.completed });
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? {
            ...p,
            phases: p.phases.map(ph =>
              ph.id === phaseId
                ? { ...ph, milestones: ph.milestones.map(m => m.id === updated.id ? updated : m) }
                : ph
            ),
          }
        : p
    ));
  }

  async function handleTogglePhase(phase: Phase, projectId: string) {
    const updated = await updatePhase(phase.id, { completed: !phase.completed });
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, phases: p.phases.map(ph => ph.id === updated.id ? { ...ph, completed: updated.completed } : ph) }
        : p
    ));
  }

  async function handleToggleProject(project: Project) {
    const updated = await updateProject(project.id, { completed: !project.completed });
    setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, completed: updated.completed } : p));
  }

  function getProgress(project: Project) {
    const total = project.phases.reduce((sum, ph) => sum + ph.milestones.length, 0);
    const done = project.phases.reduce((sum, ph) => sum + ph.milestones.filter(m => m.completed).length, 0);
    return { total, done };
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Projects</h1>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="New project title..."
          value={newProjectTitle}
          onChange={e => setNewProjectTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddProject()}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          onClick={handleAddProject}
        >
          Add
        </button>
      </div>

      <div className="space-y-4">
        {projects.map(project => {
          const { total, done } = getProgress(project);
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const isOpen = expandedProject === project.id;

          return (
            <div key={project.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={project.completed}
                  onChange={() => handleToggleProject(project)}
                  className="w-4 h-4"
                />
                <span
                  className={`flex-1 font-medium text-sm cursor-pointer ${project.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}
                  onClick={() => setExpandedProject(isOpen ? null : project.id)}
                >
                  {project.title}
                </span>
                <span className="text-xs text-gray-400">{done}/{total} milestones</span>
                <button
                  className="text-gray-400 text-xs"
                  onClick={() => setExpandedProject(isOpen ? null : project.id)}
                >
                  {isOpen ? '▲' : '▼'}
                </button>
              </div>

              {total > 0 && (
                <div className="h-1 bg-gray-100">
                  <div className="h-1 bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}

              {isOpen && (
                <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100">
                  {project.phases.sort((a, b) => a.order - b.order).map(phase => (
                    <div key={phase.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={phase.completed}
                          onChange={() => handleTogglePhase(phase, project.id)}
                          className="w-3.5 h-3.5"
                        />
                        <span className={`text-sm font-medium ${phase.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {phase.title}
                        </span>
                      </div>

                      <ul className="ml-5 space-y-1 mb-2">
                        {phase.milestones.sort((a, b) => a.order - b.order).map(milestone => (
                          <li key={milestone.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={milestone.completed}
                              onChange={() => handleToggleMilestone(milestone, phase.id, project.id)}
                              className="w-3.5 h-3.5"
                            />
                            <span className={`text-xs ${milestone.completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                              {milestone.title}
                            </span>
                            {milestone.dueDate && (
                              <span className="text-xs text-gray-400 ml-auto">{milestone.dueDate}</span>
                            )}
                          </li>
                        ))}
                      </ul>

                      <div className="flex gap-2 ml-5">
                        <input
                          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                          placeholder="Add milestone..."
                          value={newMilestoneTitles[phase.id] ?? ''}
                          onChange={e => setNewMilestoneTitles(prev => ({ ...prev, [phase.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAddMilestone(phase.id, project.id)}
                        />
                        <button
                          className="text-xs text-blue-600 hover:text-blue-800"
                          onClick={() => handleAddMilestone(phase.id, project.id)}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs"
                      placeholder="Add phase..."
                      value={newPhaseTitle}
                      onChange={e => setNewPhaseTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddPhase(project.id)}
                    />
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => handleAddPhase(project.id)}
                    >
                      + Phase
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No projects yet</p>
        )}
      </div>
    </div>
  );
}
