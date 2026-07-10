import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Project, ProjectMember } from '../types';
import { getProjects, getAllPendingChangeCounts } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Plus } from '@/components/animate-ui/icons/plus';

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const { data: pendingCountsList = [] } = useQuery({
    queryKey: ['pendingChangeCounts'],
    queryFn: getAllPendingChangeCounts,
  });

  const pendingCounts: Record<string, number> = {};
  pendingCountsList.forEach(c => { pendingCounts[c.projectId] = c.count; });

  const navigate = useNavigate();
  const { user } = useAuth();

  function getProgress(project: Project) {
    const total = project.phases.reduce((s, ph) => s + ph.milestones.length, 0);
    const done  = project.phases.reduce((s, ph) => s + ph.milestones.filter(m => m.completed).length, 0);
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function getHealthDot(project: Project): string {
    const milestones = project.phases.flatMap(ph => ph.milestones);
    const total = milestones.length;
    if (total === 0) return 'bg-[#E0CFC4]';
    const today = new Date().toISOString().split('T')[0];
    const done    = milestones.filter(m => m.completed).length;
    const dueable = milestones.filter(m => m.dueDate).length;
    const overdue = milestones.filter(m => !m.completed && m.dueDate && m.dueDate < today).length;
    const score   = Math.round((0.6 * (done / total) + 0.4 * (dueable === 0 ? 0.8 : 1 - overdue / dueable)) * 100);
    return score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400';
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">Projects</h1>
          <p className="text-sm text-[#8A7265] mt-0.5">{dateLabel}</p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 btn-primary text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" animateOnHover="default" />
          New Project
        </button>
      </div>

      {isLoading ? null : projects.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F0E9E0] flex items-center justify-center">
            <svg className="w-7 h-7 text-[#BBA79C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-[#54433A]">No projects yet</p>
            <p className="text-[#8A7265] text-sm mt-1">Break your big goals into phases and objectives — start with one.</p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="mt-2 px-5 py-2 btn-primary text-white text-sm font-medium transition-colors"
          >Create your first project</button>
        </div>
      ) : (
        <ProjectSections
          projects={projects}
          userId={user?.id ?? ''}
          pendingCounts={pendingCounts}
          getProgress={getProgress}
          getHealthDot={getHealthDot}
          onNavigate={id => navigate(`/projects/${id}`)}
          onEdit={id => navigate(`/projects/${id}/edit`)}
        />
      )}
    </div>
  );
}

// ── Avatar helpers ─────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#008671','#00864D','#488427','#777E00','#A07200','#C4601A','#C24650','#A14574','#6F4D81','#414F74','#2F4858'];
function avatarColor(name: string): string { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(name: string) { const p = name.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length-1][0] : name.slice(0,2)).toUpperCase(); }

// ── Sub-components ─────────────────────────────────────────────────────────
interface SectionProps {
  projects: Project[];
  userId: string;
  pendingCounts: Record<string, number>;
  getProgress: (p: Project) => { total: number; done: number; pct: number };
  getHealthDot: (p: Project) => string;
  onNavigate: (id: string) => void;
  onEdit: (id: string) => void;
}

function ProjectSections(props: SectionProps) {
  const mine   = props.projects.filter(p => p.userId === props.userId);
  const shared = props.projects.filter(p => p.userId !== props.userId);

  return (
    <div className="space-y-8">
      {mine.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-3">My Projects</p>
          <div className="space-y-3">
            {mine.map(p => <ProjectCard key={p.id} project={p} isShared={false} {...props} />)}
          </div>
        </section>
      )}
      {shared.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-3">Shared with me</p>
          <div className="space-y-3">
            {shared.map(p => <ProjectCard key={p.id} project={p} isShared={true} {...props} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectCard({ project, isShared, userId, pendingCounts, getProgress, getHealthDot, onNavigate, onEdit }: SectionProps & { project: Project; isShared: boolean }) {
  const { total, done, pct } = getProgress(project);
  const myMember = project.members?.find(m => m.user.id === userId);
  const myRole   = myMember?.role ?? 'viewer';
  const canEdit  = myRole === 'owner' || myRole === 'contributor';

  // Other contributors (excluding self) shown in shared projects
  const others: ProjectMember[] = isShared
    ? (project.members ?? []).filter(m => m.user.id !== userId)
    : [];
  const MAX_SHOWN = 3;
  const shown   = others.slice(0, MAX_SHOWN);
  const overflow = others.length - MAX_SHOWN;

  const roleLabel = myRole === 'contributor'
    ? (myMember?.canApprove ? 'Contributor · approver' : 'Contributor')
    : myRole.charAt(0).toUpperCase() + myRole.slice(1);

  return (
    <div
      className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onNavigate(project.id)}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`w-2 h-2 rounded-full shrink-0 ${getHealthDot(project)}`} title="Project health" />
            {pendingCounts[project.id] > 0 && (
              <span
                title={`${pendingCounts[project.id]} change${pendingCounts[project.id] !== 1 ? 's' : ''} need review`}
                className="w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center shrink-0"
              >!</span>
            )}
            <p className="font-medium text-sm text-[#2D1E1A]">{project.title}</p>
          </div>

          {project.description && (
            <p className="text-xs text-[#8A7265] mt-0.5 truncate">{project.description}</p>
          )}

          {total > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--c-surface-mid)' }}>
                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--c-primary)' }} />
              </div>
              <span className="text-xs text-[#8A7265] shrink-0">{done}/{total}</span>
            </div>
          )}

          {isShared && (
            <div className="flex items-center gap-2 mt-2">
              {/* Role badge */}
              <span className="text-[11px] text-[#8A7265] border border-[#E0CFC4] px-1.5 py-0.5 rounded-full shrink-0">
                {roleLabel}
              </span>
              {/* Contributors */}
              {shown.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1.5">
                    {shown.map(m => (
                      <div
                        key={m.user.id}
                        title={m.user.name}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold ring-2 ring-white"
                        style={{ background: avatarColor(m.user.name) }}
                      >{initials(m.user.name)}</div>
                    ))}
                    {overflow > 0 && (
                      <div
                        title={`${overflow} more contributor${overflow > 1 ? 's' : ''}`}
                        className="w-5 h-5 rounded-full bg-[#E0CFC4] flex items-center justify-center text-[#8A7265] text-[8px] font-bold ring-2 ring-white"
                      >+{overflow}</div>
                    )}
                  </div>
                  <span className="text-[11px] text-[#8A7265]">
                    {shown.map(m => m.user.name.split(' ')[0]).join(', ')}
                    {overflow > 0 && ` +${overflow} more`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {project.targetEndDate && (
          <span className="text-xs text-[#8A7265] shrink-0">{project.targetEndDate}</span>
        )}

        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(project.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8A7265] hover:text-[#C4601A] hover:bg-[#FFF5E9] transition-colors shrink-0 text-sm"
            title="Edit project"
          >✎</button>
        )}
      </div>
    </div>
  );
}
