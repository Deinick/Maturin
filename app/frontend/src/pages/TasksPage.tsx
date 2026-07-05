import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, MyObjective, Project } from '../types';
import {
  getTasks, createTask, updateTask, deleteTask, getCompletionRate,
  getMyObjectives, updateMilestone, getProjects,
} from '../api/client';
import { localDate } from '../utils/date';

const TODAY      = localDate();
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PRIORITY: Record<number, { label: string; dot: string; bar: string; badge: string }> = {
  1: { label: 'Low',    dot: 'bg-slate-300',  bar: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500'  },
  2: { label: 'Medium', dot: 'bg-sky-400',    bar: 'bg-sky-400',    badge: 'bg-sky-50 text-sky-600'       },
  3: { label: 'High',   dot: 'bg-rose-400',   bar: 'bg-rose-400',   badge: 'bg-rose-50 text-rose-600'     },
};

const TIME_OPTIONS = [
  { value: 'quick',  label: 'Quick',  sub: '~5 min',  color: 'bg-sky-50 text-sky-600 border-sky-200',         active: 'bg-sky-500 text-white border-sky-500'     },
  { value: 'medium', label: 'Medium', sub: '~30 min', color: 'bg-violet-50 text-violet-600 border-violet-200', active: 'bg-violet-500 text-white border-violet-500' },
  { value: 'deep',   label: 'Deep',   sub: '1.5 h+',  color: 'bg-rose-50 text-rose-600 border-rose-200',      active: 'bg-rose-500 text-white border-rose-500'   },
] as const;

const TIME_MINUTES: Record<string, number> = { quick: 5, medium: 30, deep: 90 };

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-50 text-blue-600',
  admin:         'bg-orange-50 text-orange-600',
  creative:      'bg-purple-50 text-purple-600',
  learning:      'bg-teal-50 text-teal-600',
  physical:      'bg-green-50 text-green-600',
  health:        'bg-red-50 text-red-600',
  other:         'bg-slate-100 text-slate-500',
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

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function daysLabel(dueDate: string): { text: string; cls: string } {
  const diff = Math.ceil((new Date(dueDate).getTime() - new Date(TODAY).getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-500 font-semibold' };
  if (diff === 0) return { text: 'Due today',                  cls: 'text-amber-600 font-semibold' };
  if (diff <= 3)  return { text: `${diff}d left`,              cls: 'text-amber-500' };
  return               { text: `${diff}d left`,              cls: 'text-slate-400' };
}

type ViewMode = 'all' | 'objectives' | 'active' | 'completed';

// ── Ring component ────────────────────────────────────────────────────────────

function CompletionRing({ done, total }: { done: number; total: number }) {
  const pct  = total === 0 ? 0 : Math.round(done / total * 100);
  const circ = 2 * Math.PI * 15.9155;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#0f172a" strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-slate-800">{pct}%</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksPage() {
  const navigate = useNavigate();

  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [objectives,     setObjectives]     = useState<MyObjective[]>([]);
  const [allProjects,    setAllProjects]    = useState<Project[]>([]);
  const [objLoading,     setObjLoading]     = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [showFilter,     setShowFilter]     = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);
  const [form,           setForm]           = useState({ text: '', description: '', priority: 2, timeEstimate: '' });
  const [completionRate, setCompletionRate] = useState(0.6);
  const [view,           setView]           = useState<ViewMode>('all');
  const [search,         setSearch]         = useState('');
  // objectives filter — set of included projectIds; empty = show all
  const [filterProjects, setFilterProjects] = useState<Set<string>>(new Set());
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getTasks(TODAY).then(setTasks);
    getCompletionRate().then(r => setCompletionRate(r.rate));
    getProjects().then(setAllProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== 'objectives') return;
    setObjLoading(true);
    getMyObjectives()
      .then(setObjectives)
      .finally(() => setObjLoading(false));
  }, [view]);

  async function handleAdd() {
    if (!form.text.trim()) return;
    const task = await createTask(form.text.trim(), TODAY, form.priority, form.timeEstimate || undefined);
    setTasks(prev => [...prev, task]);
    setForm({ text: '', description: '', priority: 2, timeEstimate: '' });
    setShowModal(false);
  }

  async function handleToggle(task: Task) {
    const next = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      const updated = await updateTask(task.id, { completed: next });
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
  }

  async function handleToggleObjective(obj: MyObjective) {
    const next = !obj.completed;
    setObjectives(prev => prev.map(o => o.id === obj.id ? { ...o, completed: next } : o));
    try {
      await updateMilestone(obj.id, { completed: next });
    } catch {
      setObjectives(prev => prev.map(o => o.id === obj.id ? obj : o));
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const activeTasks    = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const rolledOverTasks = activeTasks.filter(t => t.rolloverCount > 0)
    .sort((a, b) => b.rolloverCount - a.rolloverCount);

  const estimatedMinutes     = activeTasks.reduce((s, t) => s + (t.timeEstimate ? (TIME_MINUTES[t.timeEstimate] ?? 0) : 0), 0);
  const taggedCount          = activeTasks.filter(t => t.timeEstimate).length;
  const predictedCompletions = Math.round(activeTasks.length * completionRate);

  const todayCatCount: Record<string, number> = {};
  for (const t of activeTasks) {
    if (t.category) todayCatCount[t.category] = (todayCatCount[t.category] ?? 0) + 1;
  }
  const dominantCat = Object.entries(todayCatCount).sort((a, b) => b[1] - a[1])[0];

  const priCount = useMemo(() => ({
    high:   tasks.filter(t => t.priority === 3).length,
    medium: tasks.filter(t => t.priority === 2).length,
    low:    tasks.filter(t => t.priority === 1).length,
  }), [tasks]);

  const displayed = useMemo(() => {
    let list = view === 'active' ? activeTasks : view === 'completed' ? completedTasks : [
      ...activeTasks, ...completedTasks,
    ];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, view, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // all projects available for the filter panel
  const objProjects = useMemo(() =>
    allProjects.map(p => ({ id: p.id, title: p.title }))
  , [allProjects]);

  const displayedObjectives = useMemo(() => {
    let list = [...objectives].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    if (filterProjects.size > 0) list = list.filter(o => filterProjects.has(o.projectId));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.projectTitle.toLowerCase().includes(q) ||
        o.phaseName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [objectives, filterProjects, search]);

  const objPendingCount = objectives.filter(o => !o.completed).length;

  const TABS: { key: ViewMode; label: string; count: number }[] = [
    { key: 'all',        label: 'All Tasks',      count: tasks.length          },
    { key: 'objectives', label: 'Assigned to me', count: objPendingCount       },
    { key: 'active',     label: 'Active',         count: activeTasks.length    },
    { key: 'completed',  label: 'Completed',      count: completedTasks.length },
  ];

  const isObjView = view === 'objectives';

  return (
    <div>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-400 mt-0.5">{DATE_LABEL}</p>
        </div>
        {!isObjView && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Task
          </button>
        )}
      </div>

      {/* ── Main 2-column grid ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Left: list */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Search + filter tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="relative flex-1">
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder={isObjView ? 'Search objectives…' : 'Search tasks…'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Filter icon — only on objectives tab */}
              {isObjView && (
                <button
                  ref={filterBtnRef}
                  onClick={() => setShowFilter(true)}
                  title="Filter by project"
                  className={`relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${
                    filterProjects.size > 0
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 bg-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                  </svg>
                  {filterProjects.size > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {objProjects.length - filterProjects.size}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="flex border-b border-slate-200 sm:border-none sm:bg-slate-100 sm:rounded-xl sm:p-0.5 gap-0 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key}
                  onClick={() => { setView(tab.key); setSearch(''); }}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors rounded-lg
                    ${view === tab.key
                      ? 'text-slate-900 bg-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 bg-transparent'
                    }`}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      view === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/60 text-slate-400'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Objectives view ─────────────────────────────────────── */}
          {isObjView && (
            <>
              {objLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
              ) : objectives.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-slate-700">No objectives assigned</p>
                    <p className="text-slate-400 text-sm mt-1">Objectives assigned to you will appear here.</p>
                  </div>
                </div>
              ) : displayedObjectives.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                  <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <p className="text-sm">No objectives match your filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedObjectives.map(obj => (
                    <ObjectiveCard
                      key={obj.id}
                      obj={obj}
                      today={TODAY}
                      onToggle={handleToggleObjective}
                      onNavigate={() => navigate(`/projects/${obj.projectId}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Task view ────────────────────────────────────────────── */}
          {!isObjView && (
            <>
              {/* Capacity bar */}
              {activeTasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's capacity</p>
                    {taggedCount > 0 && (
                      <p className="text-xs text-slate-400">
                        {formatMinutes(estimatedMinutes)} est. · {taggedCount}/{activeTasks.length} tagged
                      </p>
                    )}
                  </div>
                  {taggedCount > 0 ? (
                    <>
                      <div className="flex gap-1 mb-2">
                        {activeTasks.map(t => (
                          <div key={t.id} title={t.text}
                            className={`h-1.5 rounded-full flex-1 transition-all ${
                              t.timeEstimate === 'quick'  ? 'bg-sky-400' :
                              t.timeEstimate === 'medium' ? 'bg-violet-400' :
                              t.timeEstimate === 'deep'   ? 'bg-rose-400' :
                              'bg-slate-200'
                            }`} />
                        ))}
                      </div>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">{activeTasks.length} tasks</span> today
                        {estimatedMinutes > 0 && <> · <span className="font-semibold">{formatMinutes(estimatedMinutes)}</span> estimated</>}.
                        {' '}At your pace, expect ~<span className="font-semibold text-emerald-700">{predictedCompletions}</span> done.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''} remaining — tag Quick / Medium / Deep to see your load.
                    </p>
                  )}
                </div>
              )}

              {/* Avoidance notice */}
              {dominantCat && dominantCat[1] >= 2 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  <span className="shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </span>
                  <span>
                    <span className="font-medium capitalize">{dominantCat[0]}</span> tasks make up {dominantCat[1]} of your active tasks today.
                    {' '}Consider tackling one first to avoid delay.
                  </span>
                </div>
              )}

              {/* Task list */}
              {displayed.length > 0 ? (
                <div className="space-y-2">
                  {displayed.map(task => (
                    <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={setDeleteConfirm} />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-slate-700">No tasks for today</p>
                    <p className="text-slate-400 text-sm mt-1">Add a task and get the ball rolling.</p>
                  </div>
                  <button onClick={() => setShowModal(true)}
                    className="mt-2 px-5 py-2 bg-[#0f172a] text-white text-sm font-medium rounded-xl hover:bg-[#1e293b] transition-colors">
                    Add your first task
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                  <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <p className="text-sm">No tasks match your search.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">

          {/* ── Objectives sidebar: summary only ──────────────────── */}
          {isObjView && (
            <>
              {/* Summary */}
              {objectives.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-800 mb-3">Summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total assigned</span>
                      <span className="font-semibold text-slate-800">{objectives.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Completed</span>
                      <span className="font-semibold text-emerald-600">{objectives.filter(o => o.completed).length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Pending</span>
                      <span className="font-semibold text-slate-800">{objPendingCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Overdue</span>
                      <span className={`font-semibold ${objectives.filter(o => !o.completed && o.dueDate && o.dueDate < TODAY).length > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                        {objectives.filter(o => !o.completed && o.dueDate && o.dueDate < TODAY).length}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${Math.round(objectives.filter(o => o.completed).length / objectives.length * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Task insights sidebar ────────────────────────────────── */}
          {!isObjView && (
            <>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Task Insights</h3>

              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-800 mb-4">Daily Completion</p>
                <div className="flex items-center gap-4">
                  <CompletionRing done={completedTasks.length} total={tasks.length} />
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">
                      {completedTasks.length}<span className="text-slate-400 font-normal text-base">/{tasks.length}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Tasks completed</p>
                    {tasks.length > 0 && completedTasks.length === tasks.length && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">All done!</p>
                    )}
                  </div>
                </div>
              </div>

              {tasks.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-slate-800 mb-4">Priority Breakdown</p>
                  <div className="space-y-3">
                    {[
                      { label: 'High',   count: priCount.high,   bar: 'bg-rose-400',  pct: tasks.length === 0 ? 0 : Math.round(priCount.high / tasks.length * 100)   },
                      { label: 'Medium', count: priCount.medium, bar: 'bg-sky-400',   pct: tasks.length === 0 ? 0 : Math.round(priCount.medium / tasks.length * 100) },
                      { label: 'Low',    count: priCount.low,    bar: 'bg-slate-300', pct: tasks.length === 0 ? 0 : Math.round(priCount.low / tasks.length * 100)    },
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${row.bar}`} />
                            <span className="text-xs text-slate-500">{row.label}</span>
                          </div>
                          <span className="text-xs font-medium text-slate-700">{row.count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${row.bar}`}
                            style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rolledOverTasks.length > 0 ? (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-rose-700">{rolledOverTasks.length} Rolled Over</p>
                      <p className="text-xs text-rose-500 mt-0.5">These tasks keep getting pushed. Try tackling one today.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {rolledOverTasks.slice(0, 3).map(t => (
                      <div key={t.id} className="bg-white/70 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-700 font-medium truncate">{t.text}</p>
                        <span className="text-[10px] text-rose-400 shrink-0">↩{t.rolloverCount}×</span>
                      </div>
                    ))}
                  </div>
                  {rolledOverTasks.length > 3 && (
                    <button onClick={() => setView('active')}
                      className="mt-2 w-full text-xs text-rose-500 hover:text-rose-700 transition-colors py-1">
                      +{rolledOverTasks.length - 3} more →
                    </button>
                  )}
                </div>
              ) : tasks.length > 0 && activeTasks.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">All clear!</p>
                  <p className="text-xs text-emerald-500 mt-0.5">No rolled-over tasks.</p>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {/* ── Add Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Title</label>
                <input autoFocus
                  className="w-full mt-1.5 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 bg-slate-50"
                  placeholder="What needs to be done?"
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Note (optional)</label>
                <textarea
                  className="w-full mt-1.5 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 bg-slate-50 resize-none"
                  placeholder="Add details…"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        form.priority === p
                          ? p === 3 ? 'bg-rose-400 text-white border-rose-400'
                            : p === 2 ? 'bg-sky-400 text-white border-sky-400'
                            : 'bg-slate-400 text-white border-slate-400'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}>
                      {PRIORITY[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Time estimate</label>
                <div className="flex gap-2 mt-1.5">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setForm(f => ({ ...f, timeEstimate: f.timeEstimate === opt.value ? '' : opt.value }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                        form.timeEstimate === opt.value ? opt.active : opt.color
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
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors font-medium">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Popup ─────────────────────────────────────────── */}
      {showFilter && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-start justify-center z-50 pt-24 px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowFilter(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">Filter by Project</p>
              <button
                onClick={() => setShowFilter(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 pt-3 pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterProjects(new Set())}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    filterProjects.size === 0
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >All</button>
                <button
                  onClick={() => setFilterProjects(new Set(objProjects.map(p => p.id)))}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    filterProjects.size === objProjects.length && objProjects.length > 0
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >None</button>
              </div>
            </div>
            <ul className="px-3 pb-4 space-y-0.5 max-h-72 overflow-y-auto">
              {objProjects.length === 0 ? (
                <li className="px-2 py-3 text-xs text-slate-400 text-center">No projects found</li>
              ) : objProjects.map(p => {
                const checked = filterProjects.size === 0 || filterProjects.has(p.id);
                const count = objectives.filter(o => o.projectId === p.id && !o.completed).length;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setFilterProjects(prev => {
                          if (prev.size === 0) return new Set(objProjects.filter(x => x.id !== p.id).map(x => x.id));
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                          if (next.size === objProjects.length) return new Set();
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-slate-700 flex-1 truncate font-medium">{p.title}</span>
                      {count > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">Delete this task?</h2>
            <p className="text-sm text-slate-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-400 hover:bg-red-500 transition-colors font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, onDelete }: { task: Task; onToggle: (t: Task) => void; onDelete: (id: string) => void }) {
  const p       = PRIORITY[task.priority];
  const timeOpt = TIME_OPTIONS.find(o => o.value === task.timeEstimate);
  const catColor = task.category ? (CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.other) : null;

  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm transition-all hover:border-slate-200 ${task.completed ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'
        }`}>
        {task.completed && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.text}
        </p>
        {task.description && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{task.description}</p>
        )}
        {(catColor || task.rolloverCount > 0) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {catColor && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${catColor}`}>
                {task.category}
              </span>
            )}
            {task.rolloverCount > 0 && (
              <span className="text-[10px] text-rose-400 font-medium" title={`Rolled over ${task.rolloverCount} time${task.rolloverCount !== 1 ? 's' : ''}`}>
                ↩ {task.rolloverCount}×
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {timeOpt && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${timeOpt.color}`}>
            {timeOpt.sub}
          </span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${p.badge}`}>{p.label}</span>
        <button onClick={() => onDelete(task.id)}
          className="w-5 h-5 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors text-base font-bold ml-1">
          ×
        </button>
      </div>
    </div>
  );
}

// ── ObjectiveCard ─────────────────────────────────────────────────────────────

function ObjectiveCard({
  obj, today, onToggle, onNavigate,
}: {
  obj: MyObjective;
  today: string;
  onToggle: (o: MyObjective) => void;
  onNavigate: () => void;
}) {
  const isOverdue = !obj.completed && obj.dueDate && obj.dueDate < today;
  const due       = obj.dueDate ? daysLabel(obj.dueDate) : null;

  return (
    <div className={`flex items-start gap-3 bg-white rounded-2xl px-4 py-3.5 border shadow-sm transition-all hover:border-slate-200 ${
      obj.completed ? 'border-slate-100 opacity-60' : isOverdue ? 'border-red-100' : 'border-slate-100'
    }`}>
      {/* Complete toggle */}
      <button
        onClick={() => onToggle(obj)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
          obj.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'
        }`}
      >
        {obj.completed && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={`text-sm font-medium leading-snug ${obj.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {obj.title}
        </p>

        {/* Project + phase breadcrumb */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <button
            onClick={onNavigate}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors truncate max-w-[160px]"
          >
            {obj.projectTitle}
          </button>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-xs text-slate-400 truncate">{obj.phaseName}</span>
        </div>

        {/* Due date */}
        {due && (
          <p className={`text-[11px] mt-1 ${due.cls}`}>
            📅 {obj.dueDate}{due.text !== obj.dueDate ? ` · ${due.text}` : ''}
          </p>
        )}

        {/* Assignees cluster */}
        {obj.assignees.length > 1 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex items-center -space-x-1">
              {obj.assignees.slice(0, 4).map(a => (
                <div key={a.id} title={a.name}
                  className={`w-4 h-4 rounded-full border border-white flex items-center justify-center text-white text-[8px] font-semibold shrink-0 ${memberColor(a.name)}`}>
                  {a.name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-slate-400">{obj.assignees.map(a => a.name.split(' ')[0]).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="shrink-0 flex flex-col items-end gap-1.5 mt-0.5">
        {obj.completed ? (
          <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">Done</span>
        ) : isOverdue ? (
          <span className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full font-medium">Overdue</span>
        ) : (
          <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">In progress</span>
        )}
      </div>
    </div>
  );
}
