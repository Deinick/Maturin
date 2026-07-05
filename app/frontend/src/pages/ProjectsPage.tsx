import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { getProjects, getAllPendingChangeCounts } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  const navigate = useNavigate();
  const { user } = useAuth();

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

  function getProgress(project: Project) {
    const total = project.phases.reduce((s, ph) => s + ph.milestones.length, 0);
    const done  = project.phases.reduce((s, ph) => s + ph.milestones.filter(m => m.completed).length, 0);
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function getHealthDot(project: Project): string {
    const milestones = project.phases.flatMap(ph => ph.milestones);
    const total = milestones.length;
    if (total === 0) return 'bg-stone-200';
    const today = new Date().toISOString().split('T')[0];
    const done    = milestones.filter(m => m.completed).length;
    const dueable = milestones.filter(m => m.dueDate).length;
    const overdue = milestones.filter(m => !m.completed && m.dueDate && m.dueDate < today).length;
    const score   = Math.round((0.6 * (done / total) + 0.4 * (dueable === 0 ? 0.8 : 1 - overdue / dueable)) * 100);
    return score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400';
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-stone-800">Projects</h1>
          <p className="text-sm text-stone-400 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-700">No projects yet</p>
            <p className="text-stone-400 text-sm mt-1">Break your big goals into phases and objectives — start with one.</p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="mt-2 px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 transition-colors"
          >Create your first project</button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => {
            const { total, done, pct } = getProgress(project);
            const myRole = project.members?.find(m => m.user.id === user?.id)?.role ?? 'viewer';
            const canEdit = myRole === 'owner' || myRole === 'contributor';
            return (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${getHealthDot(project)}`} title="Project health" />
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
                    {project.description && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{project.description}</p>
                    )}
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
                      onClick={e => { e.stopPropagation(); navigate(`/projects/${project.id}/edit`); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0 text-sm"
                      title="Edit project"
                    >✎</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


