import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Task, MyObjective } from '../types';
import {
  getTasks, createTask, updateTask, deleteTask, getCompletionRate,
  getMyObjectives, updateMilestone,
} from '../api/client';
import { localDate } from '../utils/date';

const TODAY      = localDate();
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// ── Design tokens ─────────────────────────────────────────────────────────────

const PRIORITY = {
  1: { label: 'Low',    bg: 'var(--c-teal-xlight)',    text: 'var(--c-teal)',    border: 'var(--c-teal-light)',    icon: 'down' as const },
  2: { label: 'Medium', bg: 'var(--c-primary-xlight)', text: 'var(--c-primary)', border: 'var(--c-primary-light)', icon: 'dash' as const },
  3: { label: 'High',   bg: 'var(--c-error-light)',    text: 'var(--c-error)',   border: 'var(--c-error-light)',   icon: 'up'   as const },
};

const TIME_OPTIONS = [
  { value: 'quick',  label: 'Quick',  sub: '~5 min'  },
  { value: 'medium', label: 'Medium', sub: '~30 min' },
  { value: 'deep',   label: 'Deep',   sub: '1.5h+'   },
] as const;

const TIME_MINUTES: Record<string, number> = { quick: 5, medium: 30, deep: 90 };

const MEMBER_COLORS = ['#008671','#00864D','#488427','#777E00','#A07200','#C4601A','#C24650','#A14574','#6F4D81','#414F74','#2F4858'];
function memberColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function dueLabelFor(dueDate: string): { text: string; cls: string } {
  const diff = Math.ceil((new Date(dueDate).getTime() - new Date(TODAY).getTime()) / 86_400_000);
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, cls: 'text-[#ba1a1a] font-medium' };
  if (diff === 0) return { text: 'Due today',                  cls: 'text-amber-500 font-medium' };
  if (diff <= 3)  return { text: `${diff}d left`,              cls: 'text-amber-500' };
  return                 { text: dueDate,                      cls: 'text-[#8A7265]' };
}

// ── Small shared components ───────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const p = PRIORITY[priority];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap"
      style={{ background: p.bg, color: p.text, borderColor: p.border }}>
      {p.icon === 'up' && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
        </svg>
      )}
      {p.icon === 'dash' && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      )}
      {p.icon === 'down' && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
        </svg>
      )}
      {p.label}
    </span>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <h2 className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest whitespace-nowrap">{label}</h2>
      <span className="text-[10px] bg-[#F0E9E0] text-[#8A7265] px-2 py-0.5 rounded-full font-semibold">{count}</span>
      <div className="flex-1 h-px bg-[#F0E9E0]" />
    </div>
  );
}

function CompletionRing({ done, total }: { done: number; total: number }) {
  const pct  = total === 0 ? 0 : Math.round(done / total * 100);
  const circ = 2 * Math.PI * 15.9155;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--c-surface-mid)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--c-text)" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-[#2D1E1A]">{pct}%</span>
      </div>
    </div>
  );
}

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'all' | 'active' | 'completed';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showModal,      setShowModal]      = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);
  const [editTask,       setEditTask]       = useState<Task | null>(null);
  const [editForm,       setEditForm]       = useState<{ text: string; description: string; priority: 1|2|3; timeEstimate: '' | 'quick' | 'medium' | 'deep' }>({
    text: '', description: '', priority: 2, timeEstimate: '',
  });
  const [form,           setForm]           = useState<{ text: string; description: string; priority: 1|2|3; timeEstimate: '' | 'quick' | 'medium' | 'deep' }>({
    text: '', description: '', priority: 2, timeEstimate: '',
  });
  const [view,           setView]           = useState<ViewMode>('all');
  const [search,         setSearch]         = useState('');

  const tasksKey = ['tasks', TODAY];
  const objectivesKey = ['myObjectives'];

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({ queryKey: tasksKey, queryFn: () => getTasks(TODAY) });
  const { data: completionData } = useQuery({ queryKey: ['completionRate'], queryFn: getCompletionRate });
  const { data: objectives = [], isLoading: objLoading } = useQuery({ queryKey: objectivesKey, queryFn: getMyObjectives });

  const completionRate = completionData?.rate ?? 0.6;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!form.text.trim()) return;
    const task = await createTask(form.text.trim(), TODAY, form.priority, form.timeEstimate || undefined);
    queryClient.setQueryData<Task[]>(tasksKey, prev => [...(prev ?? []), task]);
    setForm({ text: '', description: '', priority: 2, timeEstimate: '' });
    setShowModal(false);
  }

  async function handleToggle(task: Task) {
    const next = !task.completed;
    queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      const updated = await updateTask(task.id, { completed: next });
      queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.map(t => t.id === updated.id ? updated : t));
    } catch {
      queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.map(t => t.id === task.id ? task : t));
    }
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.filter(t => t.id !== id));
    setDeleteConfirm(null);
  }

  function openEdit(task: Task) {
    setEditTask(task);
    setEditForm({ text: task.text, description: task.description ?? '', priority: task.priority as 1|2|3, timeEstimate: task.timeEstimate ?? '' });
  }

  async function handleSaveEdit() {
    if (!editTask || !editForm.text.trim()) return;
    const updated = await updateTask(editTask.id, {
      text: editForm.text.trim(),
      description: editForm.description || undefined,
      priority: editForm.priority,
      timeEstimate: editForm.timeEstimate || undefined,
    });
    queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.map(t => t.id === updated.id ? updated : t));
    setEditTask(null);
  }

  async function handleToggleObjective(obj: MyObjective) {
    const next = !obj.completed;
    queryClient.setQueryData<MyObjective[]>(objectivesKey, prev => prev?.map(o => o.id === obj.id ? { ...o, completed: next } : o));
    try {
      await updateMilestone(obj.id, { completed: next });
    } catch {
      queryClient.setQueryData<MyObjective[]>(objectivesKey, prev => prev?.map(o => o.id === obj.id ? obj : o));
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const activeTasks    = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const rolledOver     = activeTasks.filter(t => t.rolloverCount > 0).sort((a, b) => b.rolloverCount - a.rolloverCount);
  const overdueObjs    = objectives.filter(o => !o.completed && o.dueDate && o.dueDate < TODAY);

  const estimatedMins  = activeTasks.reduce((s, t) => s + (t.timeEstimate ? (TIME_MINUTES[t.timeEstimate] ?? 0) : 0), 0);
  const taggedCount    = activeTasks.filter(t => t.timeEstimate).length;
  const predicted      = Math.round(activeTasks.length * completionRate);

  const priCount = useMemo(() => ({
    high:   tasks.filter(t => t.priority === 3).length,
    medium: tasks.filter(t => t.priority === 2).length,
    low:    tasks.filter(t => t.priority === 1).length,
  }), [tasks]);

  // Tasks to show in list based on view
  const shownTasks = useMemo(() => {
    const base = view === 'active' ? activeTasks : view === 'completed' ? completedTasks : [...activeTasks, ...completedTasks];
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(t => t.text.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [tasks, view, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Objectives to show based on view
  const shownObjectives = useMemo(() => {
    let base = [...objectives].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.dueDate ? -1 : b.dueDate ? 1 : 0;
    });
    if (view === 'active')    base = base.filter(o => !o.completed);
    if (view === 'completed') base = base.filter(o => o.completed);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.projectTitle.toLowerCase().includes(q) ||
        o.phaseName.toLowerCase().includes(q)
      );
    }
    return base;
  }, [objectives, view, search]);

  const pendingObjs = objectives.filter(o => !o.completed).length;
  const doneObjs    = objectives.filter(o => o.completed).length;

  const totalItems     = tasks.length + objectives.length;
  const completedItems = completedTasks.length + doneObjs;

  const TABS: { key: ViewMode; label: string; count: number }[] = [
    { key: 'all',       label: 'All Tasks',  count: totalItems                              },
    { key: 'active',    label: 'Active',     count: activeTasks.length + pendingObjs        },
    { key: 'completed', label: 'Completed',  count: completedTasks.length + doneObjs        },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">Tasks</h1>
          <p className="text-sm text-[#8A7265] mt-0.5">{DATE_LABEL}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#C4601A] hover:bg-[#A84E14] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Task
        </button>
      </div>

      {/* ── Main 2-column layout ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Left: task list */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Search + tabs (underline style from reference) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="w-4 h-4 text-[#8A7265] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 border border-[#E0CFC4] rounded-xl text-sm text-[#54433A] bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Search tasks and objectives…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Underline tabs */}
            <div className="flex gap-0 border-b border-[#E0CFC4] overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setView(tab.key); setSearch(''); }}
                  className={`px-4 py-2.5 border-b-2 text-sm font-medium whitespace-nowrap transition-colors -mb-px ${
                    view === tab.key
                      ? 'border-[#2D1E1A] text-[#2D1E1A]'
                      : 'border-transparent text-[#8A7265] hover:text-[#54433A]'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      view === tab.key ? 'bg-[#F0E9E0] text-[#54433A]' : 'bg-[#F0E9E0] text-[#8A7265]'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Load indicator (only for active/all if tagged) */}
          {(view === 'all' || view === 'active') && taggedCount > 0 && (
            <div className="bg-white rounded-2xl border border-[#E0CFC4] px-5 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Today's Load</p>
                <p className="text-xs text-[#8A7265]">{formatMinutes(estimatedMins)} · {taggedCount}/{activeTasks.length} tagged</p>
              </div>
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-[#F0E9E0] mb-2">
                {activeTasks.map(t => (
                  <div key={t.id} className={`flex-1 h-full ${
                    t.timeEstimate === 'quick'  ? 'bg-[#4C8077]' :
                    t.timeEstimate === 'medium' ? 'bg-violet-400' :
                    t.timeEstimate === 'deep'   ? 'bg-rose-400' : 'bg-[#E0CFC4]'
                  }`} />
                ))}
              </div>
              <p className="text-xs text-[#8A7265]">
                {activeTasks.length} active tasks · ~<span className="font-semibold text-[#54433A]">{predicted}</span> expected completions today
              </p>
            </div>
          )}

          {/* ── Personal Tasks section ───────────────────────────── */}
          <div>
            <SectionHeader label="Personal Tasks" count={shownTasks.length} />

            {tasksLoading ? null : shownTasks.length > 0 ? (
              <div className="space-y-1.5">
                {shownTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={setDeleteConfirm} onEdit={openEdit} />
                ))}
              </div>
            ) : tasks.length === 0 && view !== 'completed' ? (
              <div className="flex flex-col items-center py-10 gap-3 bg-white rounded-2xl border border-[#E0CFC4]">
                <div className="w-11 h-11 rounded-full bg-[#F0E9E0] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#BBA79C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#54433A]">No personal tasks yet</p>
                  <p className="text-xs text-[#8A7265] mt-0.5">Add a task and get the ball rolling.</p>
                </div>
                <button onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-[#C4601A] text-white text-sm font-medium rounded-xl hover:bg-[#A84E14] transition-colors">
                  Add first task
                </button>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-[#8A7265]">
                  {search ? 'No tasks match your search.' : view === 'completed' ? 'No completed personal tasks.' : 'No active personal tasks.'}
                </p>
                {!search && view !== 'completed' && (
                  <button onClick={() => setShowModal(true)}
                    className="mt-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors">
                    + Add a personal task
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Project Objectives section ───────────────────────── */}
          <div>
            <SectionHeader label="Project Objectives" count={shownObjectives.length} />

            {objLoading ? (
              <div className="flex items-center justify-center py-8 text-[#8A7265] text-sm gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading…
              </div>
            ) : shownObjectives.length > 0 ? (
              <div className="space-y-1.5">
                {shownObjectives.map(obj => (
                  <ObjectiveRow
                    key={obj.id}
                    obj={obj}
                    today={TODAY}
                    onToggle={handleToggleObjective}
                    onNavigate={() => navigate(`/projects/${obj.projectId}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center bg-white rounded-2xl border border-[#E0CFC4]">
                <p className="text-sm text-[#8A7265]">
                  {objectives.length === 0
                    ? 'No objectives assigned to you from projects.'
                    : search
                    ? 'No objectives match your search.'
                    : view === 'completed'
                    ? 'No completed objectives.'
                    : 'No active objectives.'}
                </p>
                {objectives.length === 0 && (
                  <button onClick={() => navigate('/projects')}
                    className="mt-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors">
                    Browse projects →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <h3 className="text-[10px] font-bold text-[#8A7265] uppercase tracking-widest">Task Insights</h3>

          {/* Daily Completion ring */}
          <div className="bg-white border border-[#E0CFC4] rounded-2xl p-5">
            <p className="text-xs font-semibold text-[#2D1E1A] mb-4">Daily Completion</p>
            <div className="flex items-center gap-4">
              <CompletionRing done={completedItems} total={totalItems} />
              <div>
                <p className="text-2xl font-semibold text-[#2D1E1A] font-serif">
                  {completedItems}<span className="text-[#8A7265] font-normal text-base">/{totalItems}</span>
                </p>
                <p className="text-xs text-[#8A7265] mt-0.5">Items completed</p>
                {totalItems > 0 && completedItems === totalItems && (
                  <p className="text-xs text-[#4C8077] font-medium mt-1">All done!</p>
                )}
              </div>
            </div>
          </div>

          {/* Priority Breakdown */}
          {tasks.length > 0 && (
            <div className="bg-white border border-[#E0CFC4] rounded-2xl p-5">
              <p className="text-xs font-semibold text-[#2D1E1A] mb-4">Priority Breakdown</p>
              <div className="space-y-3">
                {([
                  { label: 'High',   count: priCount.high,   dot: 'bg-red-400',   bar: 'bg-red-400'   },
                  { label: 'Medium', count: priCount.medium, dot: 'bg-[#717976]',  bar: 'bg-[#717976]'  },
                  { label: 'Low',    count: priCount.low,    dot: 'bg-[#E0CFC4]',  bar: 'bg-[#E0CFC4]'  },
                ] as const).map(row => {
                  const pct = tasks.length === 0 ? 0 : Math.round(row.count / tasks.length * 100);
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                          <span className="text-xs text-[#8A7265]">{row.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-[#54433A]">{row.count}</span>
                      </div>
                      <div className="h-1.5 bg-[#F0E9E0] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${row.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overdue / rolled-over alert (reference style) */}
          {rolledOver.length > 0 || overdueObjs.length > 0 ? (
            <div className="bg-[#ffdad6]/60 border border-[#ffdad6] rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <svg className="w-4 h-4 text-[#ba1a1a] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#93000a]">
                    {rolledOver.length + overdueObjs.length} Overdue
                  </p>
                  <p className="text-xs text-[#8A7265] mt-0.5">Requires attention to prevent blockages.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {rolledOver.slice(0, 2).map(t => (
                  <div key={t.id} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between gap-2 border border-[#ffdad6]">
                    <p className="text-xs text-[#54433A] font-medium truncate">{t.text}</p>
                    <span className="text-[10px] text-[#ba1a1a] shrink-0">↩{t.rolloverCount}×</span>
                  </div>
                ))}
                {overdueObjs.slice(0, 2).map(o => (
                  <div key={o.id} className="bg-white rounded-xl px-3 py-2 flex items-center justify-between gap-2 border border-[#ffdad6]">
                    <p className="text-xs text-[#54433A] font-medium truncate">{o.title}</p>
                    <span className="text-[10px] text-[#ba1a1a] shrink-0 truncate max-w-[60px]">{o.projectTitle}</span>
                  </div>
                ))}
              </div>
              {rolledOver.length + overdueObjs.length > 4 && (
                <button onClick={() => { setView('active'); setSearch(''); }}
                  className="mt-2 text-xs text-[#ba1a1a] hover:text-[#93000a] transition-colors">
                  +{rolledOver.length + overdueObjs.length - 4} more →
                </button>
              )}
            </div>
          ) : tasks.length > 0 && activeTasks.length === 0 ? (
            <div className="bg-[#E8FAF7] border border-[#E0CFC4] rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-[#16342d]">All clear!</p>
              <p className="text-xs text-[#46645c] mt-0.5">No overdue or rolled-over items.</p>
            </div>
          ) : null}
        </aside>
      </div>

      {/* ── Add Task Modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-[#E0CFC4]">
            <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Title</label>
                <input autoFocus
                  className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-slate-200 bg-[#FFF5E9]"
                  placeholder="What needs to be done?"
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Note (optional)</label>
                <textarea
                  className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-slate-200 bg-[#FFF5E9] resize-none"
                  placeholder="Add details…"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        form.priority === p
                          ? p === 3 ? 'bg-[#ba1a1a] text-white border-red-500'
                            : p === 2 ? 'bg-[#414846] text-white border-[#414846]'
                            : 'bg-[#c1c8c4] text-white border-[#E0CFC4]'
                          : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4] hover:bg-[#F0E9E0]'
                      }`}>
                      {PRIORITY[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Time estimate</label>
                <div className="flex gap-2 mt-1.5">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setForm(f => ({ ...f, timeEstimate: f.timeEstimate === opt.value ? '' : opt.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                        form.timeEstimate === opt.value
                          ? 'bg-[#C4601A] text-white border-[#2D1E1A]'
                          : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4] hover:bg-[#F0E9E0]'
                      }`}>
                      <div className="font-semibold">{opt.label}</div>
                      <div className="opacity-70">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setForm({ text: '', description: '', priority: 2, timeEstimate: '' }); }}
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors font-medium">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ───────────────────────────────────────── */}
      {editTask && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-[#E0CFC4]">
            <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">Edit Task</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Title</label>
                <input autoFocus
                  className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-slate-200 bg-[#FFF5E9]"
                  placeholder="What needs to be done?"
                  value={editForm.text}
                  onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Note (optional)</label>
                <textarea
                  className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-slate-200 bg-[#FFF5E9] resize-none"
                  placeholder="Add details…"
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button key={p} onClick={() => setEditForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        editForm.priority === p
                          ? p === 3 ? 'bg-[#ba1a1a] text-white border-red-500'
                            : p === 2 ? 'bg-[#414846] text-white border-[#414846]'
                            : 'bg-[#c1c8c4] text-white border-[#E0CFC4]'
                          : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4] hover:bg-[#F0E9E0]'
                      }`}>
                      {PRIORITY[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">Time estimate</label>
                <div className="flex gap-2 mt-1.5">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setEditForm(f => ({ ...f, timeEstimate: f.timeEstimate === opt.value ? '' : opt.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                        editForm.timeEstimate === opt.value
                          ? 'bg-[#C4601A] text-white border-[#2D1E1A]'
                          : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4] hover:bg-[#F0E9E0]'
                      }`}>
                      <div className="font-semibold">{opt.label}</div>
                      <div className="opacity-70">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditTask(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors font-medium">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-[#E0CFC4]">
            <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#ba1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[#2D1E1A] mb-1">Delete this task?</h2>
            <p className="text-sm text-[#8A7265] mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#ba1a1a] hover:bg-[#93000a] transition-colors font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete, onEdit }: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  onEdit: (t: Task) => void;
}) {
  const timeOpt = TIME_OPTIONS.find(o => o.value === task.timeEstimate);
  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#E0CFC4] hover:border-[#E0CFC4] transition-all group ${task.completed ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(task)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          task.completed ? 'bg-[#E8FAF7]0 border-[#46645c]' : 'border-[#E0CFC4] hover:border-emerald-400'
        }`}
      >
        {task.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-[#8A7265]' : 'text-[#2D1E1A]'}`}>
          {task.text}
        </p>
        {task.description && (
          <p className="text-xs text-[#8A7265] mt-0.5 truncate">{task.description}</p>
        )}
        {task.rolloverCount > 0 && (
          <p className="text-[10px] text-[#ba1a1a] font-medium mt-0.5">↩ {task.rolloverCount}× rolled over</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {timeOpt && (
          <span className="text-[10px] text-[#8A7265] font-medium">{timeOpt.sub}</span>
        )}
        <PriorityBadge priority={task.priority as 1|2|3} />
        {!task.completed && (
          <button
            onClick={() => onEdit(task)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[#BBA79C] hover:text-[#C4601A] hover:bg-[#FFF5E9] transition-colors opacity-0 group-hover:opacity-100"
            title="Edit task"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#BBA79C] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors opacity-0 group-hover:opacity-100 ml-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── ObjectiveRow ──────────────────────────────────────────────────────────────

function ObjectiveRow({
  obj, today, onToggle, onNavigate,
}: {
  obj: MyObjective;
  today: string;
  onToggle: (o: MyObjective) => void;
  onNavigate: () => void;
}) {
  const isOverdue = !obj.completed && obj.dueDate && obj.dueDate < today;
  const due       = obj.dueDate ? dueLabelFor(obj.dueDate) : null;

  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border transition-all group ${
      obj.completed ? 'border-[#E0CFC4] opacity-60'
      : isOverdue   ? 'border-[#ffdad6] hover:border-red-300'
      : 'border-[#E0CFC4] hover:border-[#E0CFC4]'
    }`}>
      <button
        onClick={() => onToggle(obj)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          obj.completed ? 'bg-[#E8FAF7]0 border-[#46645c]' : 'border-[#E0CFC4] hover:border-emerald-400'
        }`}
      >
        {obj.completed && (
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${obj.completed ? 'line-through text-[#8A7265]' : 'text-[#2D1E1A]'}`}>
          {obj.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <button
            onClick={onNavigate}
            className="text-xs text-[#46645c] hover:text-[#16342d] font-medium transition-colors truncate max-w-[140px]"
          >
            {obj.projectTitle}
          </button>
          <span className="text-[#BBA79C] text-[10px]">·</span>
          <span className="text-xs text-[#8A7265] truncate">{obj.phaseName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {obj.assignees.length > 1 && (
          <div className="flex -space-x-1">
            {obj.assignees.slice(0, 3).map(a => (
              <div key={a.id} title={a.name}
                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                style={{ background: memberColor(a.name) }}>
                {a.name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}
        {due && (
          <span className={`text-xs whitespace-nowrap ${due.cls}`}>{due.text}</span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
          obj.completed ? 'bg-[#E8FAF7] text-[#4C8077] border-[#c8eadf]'
          : isOverdue   ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffdad6]'
          : 'bg-[#FFF5E9] text-[#8A7265] border-[#E0CFC4]'
        }`}>
          {obj.completed ? 'Done' : isOverdue ? 'Overdue' : 'Active'}
        </span>
        <button
          onClick={onNavigate}
          className="w-6 h-6 flex items-center justify-center text-[#BBA79C] hover:text-[#8A7265] transition-colors opacity-0 group-hover:opacity-100"
          title="Open project"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>
      </div>
    </div>
  );
}
