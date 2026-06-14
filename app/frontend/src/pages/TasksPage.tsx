import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { getTasks, createTask, updateTask, deleteTask, getCompletionRate } from '../api/client';
import { localDate } from '../utils/date';
import sleepingTurtle from '../assets/Turtles/0609 (1).png';

const TODAY = localDate();
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PRIORITY: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: 'Low',    bg: 'bg-stone-100',  text: 'text-stone-500' },
  2: { label: 'Medium', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  3: { label: 'High',   bg: 'bg-amber-50',   text: 'text-amber-600' },
};

const TIME_OPTIONS = [
  { value: 'quick',  label: 'Quick',  sub: '~5 min',  color: 'bg-sky-50 text-sky-600 border-sky-200',    active: 'bg-sky-500 text-white border-sky-500' },
  { value: 'medium', label: 'Medium', sub: '~30 min', color: 'bg-violet-50 text-violet-600 border-violet-200', active: 'bg-violet-500 text-white border-violet-500' },
  { value: 'deep',   label: 'Deep',   sub: '1.5 h+',  color: 'bg-rose-50 text-rose-600 border-rose-200', active: 'bg-rose-500 text-white border-rose-500' },
] as const;

const TIME_MINUTES: Record<string, number> = { quick: 5, medium: 30, deep: 90 };

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-50 text-blue-600',
  admin:         'bg-orange-50 text-orange-600',
  creative:      'bg-purple-50 text-purple-600',
  learning:      'bg-teal-50 text-teal-600',
  physical:      'bg-green-50 text-green-600',
  health:        'bg-red-50 text-red-600',
  other:         'bg-stone-100 text-stone-500',
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ text: '', description: '', priority: 2, timeEstimate: '' });
  const [completionRate, setCompletionRate] = useState(0.6);

  useEffect(() => {
    getTasks(TODAY).then(setTasks);
    getCompletionRate().then(r => setCompletionRate(r.rate));
  }, []);

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

  const sorted = [
    ...tasks.filter(t => !t.completed),
    ...tasks.filter(t => t.completed),
  ];

  // Capacity calculation
  const activeTasks = tasks.filter(t => !t.completed);
  const estimatedMinutes = activeTasks.reduce((sum, t) =>
    sum + (t.timeEstimate ? (TIME_MINUTES[t.timeEstimate] ?? 0) : 0), 0);
  const taggedCount = activeTasks.filter(t => t.timeEstimate).length;
  const predictedCompletions = Math.round(activeTasks.length * completionRate);

  // Avoidance: find the category that appears most among active tasks today
  const todayCatCount: Record<string, number> = {};
  for (const t of activeTasks) {
    if (t.category) todayCatCount[t.category] = (todayCatCount[t.category] ?? 0) + 1;
  }
  const dominantCat = Object.entries(todayCatCount).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-stone-800">Tasks</h1>
          <p className="text-sm text-stone-400 mt-1">{DATE_LABEL}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
        >
          + Add Task
        </button>
      </div>

      {/* Capacity bar */}
      {activeTasks.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-100 shadow-sm px-5 py-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Today's capacity</p>
            {taggedCount > 0 && (
              <p className="text-xs text-stone-400">
                {formatMinutes(estimatedMinutes)} estimated · {taggedCount}/{activeTasks.length} tagged
              </p>
            )}
          </div>

          {taggedCount > 0 ? (
            <>
              <div className="flex gap-1 mb-3">
                {activeTasks.map(t => (
                  <div key={t.id} title={t.text}
                    className={`h-2 rounded-full flex-1 transition-all ${
                      t.timeEstimate === 'quick'  ? 'bg-sky-400' :
                      t.timeEstimate === 'medium' ? 'bg-violet-400' :
                      t.timeEstimate === 'deep'   ? 'bg-rose-400' :
                      'bg-stone-200'
                    }`} />
                ))}
              </div>
              <p className="text-sm text-stone-600">
                You have <span className="font-semibold">{activeTasks.length} tasks</span> today
                {estimatedMinutes > 0 && <> — estimated <span className="font-semibold">{formatMinutes(estimatedMinutes)}</span></>}.
                {' '}At your current pace, expect to finish about{' '}
                <span className="font-semibold text-emerald-700">{predictedCompletions}</span> of {activeTasks.length}.
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-400">
              {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''} remaining — tag them Quick / Medium / Deep when you add tasks to see your estimated load.
            </p>
          )}
        </div>
      )}

      {/* Avoidance notice */}
      {dominantCat && dominantCat[1] >= 2 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
          <span className="text-base">👁</span>
          <span>
            <span className="font-medium capitalize">{dominantCat[0]}</span> tasks make up {dominantCat[1]} of your active tasks today.
            {' '}If these tend to get delayed, consider tackling one first.
          </span>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2 mb-6">
          {sorted.map(task => <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={setDeleteConfirm} />)}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-4">
          <img src={sleepingTurtle} alt="Resting turtle" className="turtle-img w-40 h-40 object-contain opacity-80" />
          <div className="text-center">
            <p className="serif text-xl font-semibold text-stone-700">No tasks for today</p>
            <p className="text-stone-400 text-sm mt-1">Add a task and get the ball rolling — one step at a time.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-5 py-2 bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 transition-colors">
            Add your first task
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Title</label>
                <input autoFocus
                  className="w-full mt-1.5 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50"
                  placeholder="What needs to be done?"
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Note (optional)</label>
                <textarea
                  className="w-full mt-1.5 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50 resize-none"
                  placeholder="Add details..."
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                        form.priority === p
                          ? p === 3 ? 'bg-amber-400 text-white border-amber-400'
                            : p === 2 ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-stone-400 text-white border-stone-400'
                          : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                      }`}>
                      {PRIORITY[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Time estimate</label>
                <div className="flex gap-2 mt-1.5">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm(f => ({ ...f, timeEstimate: f.timeEstimate === opt.value ? '' : opt.value }))}
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
              <button onClick={() => { setShowModal(false); setForm({ text: '', description: '', priority: 2, timeEstimate: '' }); }}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors font-medium">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-stone-200">
            <p className="text-2xl mb-3">🗑</p>
            <h2 className="text-lg font-semibold text-stone-800 mb-2">Delete this task?</h2>
            <p className="text-sm text-stone-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">
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

function TaskCard({ task, onToggle, onDelete }: { task: Task; onToggle: (t: Task) => void; onDelete: (id: string) => void }) {
  const p = PRIORITY[task.priority];
  const timeOpt = TIME_OPTIONS.find(o => o.value === task.timeEstimate);
  const catColor = task.category ? (CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.other) : null;

  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-stone-200 shadow-sm transition-opacity ${task.completed ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-emerald-400'}`}>
        {task.completed && <span className="text-white text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{task.text}</p>
        {task.description && <p className="text-xs text-stone-400 mt-0.5 truncate">{task.description}</p>}
        {(catColor || task.rolloverCount > 0) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {catColor && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catColor}`}>
                {task.category}
              </span>
            )}
            {task.rolloverCount > 0 && (
              <span className="text-xs text-amber-500" title={`Rolled over ${task.rolloverCount} times`}>
                ↩{task.rolloverCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {timeOpt && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${timeOpt.color}`}>
            {timeOpt.sub}
          </span>
        )}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.bg} ${p.text}`}>{p.label}</span>
        <button onClick={() => onDelete(task.id)} className="text-stone-300 hover:text-red-400 transition-colors text-xl leading-none ml-1">×</button>
      </div>
    </div>
  );
}
