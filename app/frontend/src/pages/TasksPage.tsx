import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { getTasks, createTask, updateTask, deleteTask } from '../api/client';

const TODAY = new Date().toISOString().split('T')[0];
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'bg-gray-100 text-gray-500' },
  2: { label: 'Medium', color: 'bg-blue-50 text-blue-500' },
  3: { label: 'High', color: 'bg-amber-50 text-amber-600' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ text: '', description: '', priority: 2 });

  useEffect(() => {
    getTasks(TODAY).then(setTasks);
  }, []);

  async function handleAdd() {
    if (!form.text.trim()) return;
    const task = await createTask(form.text.trim(), TODAY, form.priority);
    setTasks(prev => [...prev, task]);
    setForm({ text: '', description: '', priority: 2 });
    setShowModal(false);
  }

  async function handleToggle(task: Task) {
    const updated = await updateTask(task.id, { completed: !task.completed });
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
  }

  const active = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-800">Today's Tasks</h1>
          <p className="text-sm text-gray-400 mt-1">{DATE_LABEL}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add Task
        </button>
      </div>

      {/* Active tasks */}
      {active.length > 0 && (
        <div className="space-y-2 mb-6">
          {active.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onDeleteRequest={setDeleteConfirm}
            />
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {completed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
            Completed · {completed.length}
          </p>
          <div className="space-y-2">
            {completed.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onDeleteRequest={setDeleteConfirm}
              />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">✦</p>
          <p className="text-gray-400 text-sm">No tasks yet — add your first one</p>
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-5">New Task</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Title</label>
                <input
                  autoFocus
                  className="w-full mt-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="What needs to be done?"
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Note (optional)</label>
                <textarea
                  className="w-full mt-1.5 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  placeholder="Add more details..."
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</label>
                <div className="flex gap-2 mt-1.5">
                  {([1, 2, 3] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.priority === p
                          ? p === 3 ? 'bg-amber-500 text-white' : p === 2 ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {PRIORITY_LABELS[p].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setForm({ text: '', description: '', priority: 2 }); }}
                className="flex-1 py-2.5 rounded-lg text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2.5 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 transition-colors font-medium"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <p className="text-2xl mb-3">🗑</p>
            <h2 className="text-lg font-medium text-gray-800 mb-2">Delete this task?</h2>
            <p className="text-sm text-gray-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-lg text-sm text-white bg-red-400 hover:bg-red-500 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onDeleteRequest }: {
  task: Task;
  onToggle: (t: Task) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const p = PRIORITY_LABELS[task.priority];
  return (
    <div className={`flex items-center gap-4 bg-white rounded-xl px-4 py-3.5 shadow-sm border border-gray-100 transition-opacity ${task.completed ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          task.completed ? 'bg-emerald-400 border-emerald-400' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {task.completed && <span className="text-white text-xs">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.text}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
        )}
      </div>

      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${p.color}`}>
        {p.label}
      </span>

      {task.rolloverCount > 0 && (
        <span className="text-xs text-amber-500 shrink-0" title={`Rolled over ${task.rolloverCount} times`}>
          ↩ {task.rolloverCount}
        </span>
      )}

      <button
        onClick={() => onDeleteRequest(task.id)}
        className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
