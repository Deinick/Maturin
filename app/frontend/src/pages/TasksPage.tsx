import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { getTasks, createTask, updateTask, deleteTask } from '../api/client';
import { localDate } from '../utils/date';
import sleepingTurtle from '../assets/Turtles/0609 (1).png';

const TODAY = localDate();
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PRIORITY: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: 'Low',    bg: 'bg-stone-100',   text: 'text-stone-500' },
  2: { label: 'Medium', bg: 'bg-emerald-50',  text: 'text-emerald-600' },
  3: { label: 'High',   bg: 'bg-amber-50',    text: 'text-amber-600' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ text: '', description: '', priority: 2 });

  useEffect(() => { getTasks(TODAY).then(setTasks); }, []);

  async function handleAdd() {
    if (!form.text.trim()) return;
    const task = await createTask(form.text.trim(), TODAY, form.priority);
    setTasks(prev => [...prev, task]);
    setForm({ text: '', description: '', priority: 2 });
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

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-8">
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
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${form.priority === p ? p === 3 ? 'bg-amber-400 text-white border-amber-400' : p === 2 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-400 text-white border-stone-400' : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'}`}>
                      {PRIORITY[p].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); setForm({ text: '', description: '', priority: 2 }); }}
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
  return (
    <div className={`flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 border border-stone-200 shadow-sm transition-opacity ${task.completed ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-emerald-400'}`}>
        {task.completed && <span className="text-white text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{task.text}</p>
        {task.description && <p className="text-xs text-stone-400 mt-0.5 truncate">{task.description}</p>}
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${p.bg} ${p.text}`}>{p.label}</span>
      {task.rolloverCount > 0 && (
        <span className="text-xs text-amber-500 shrink-0" title={`Rolled over ${task.rolloverCount} times`}>↩{task.rolloverCount}</span>
      )}
      <button onClick={() => onDelete(task.id)} className="text-stone-300 hover:text-red-400 transition-colors shrink-0 text-xl leading-none">×</button>
    </div>
  );
}
