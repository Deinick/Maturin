import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { getTasks, updateTask, rolloverTask } from '../api/client';
import { localDate } from '../utils/date';

const YESTERDAY = localDate(-1);

const YESTERDAY_LABEL = new Date(YESTERDAY + 'T12:00:00').toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

export default function RolloverModal() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [closedForSession, setClosedForSession] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getTasks(YESTERDAY).then(all => {
      const pending = all.filter(t => !t.completed && t.status !== 'dismissed');
      if (pending.length > 0) {
        setTasks(pending);
        setOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    if (tasks.length === 0 && open) setOpen(false);
  }, [tasks, open]);

  async function handleComplete(task: Task) {
    setLoading(task.id + '-complete');
    await updateTask(task.id, { completed: true });
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setLoading(null);
  }

  async function handleRollover(task: Task) {
    setLoading(task.id + '-rollover');
    await rolloverTask(task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setLoading(null);
  }

  async function handleDismiss(task: Task) {
    setLoading(task.id + '-dismiss');
    await updateTask(task.id, { status: 'dismissed' });
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setLoading(null);
  }

  if (!open || closedForSession) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E0CFC4]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#E0CFC4]">
          <div>
            <h2 className="text-lg font-semibold text-[#2D1E1A]">Unfinished Tasks</h2>
            <p className="text-sm text-[#8A7265] mt-0.5">
              From {YESTERDAY_LABEL} · {tasks.length} task{tasks.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <button
            onClick={() => setClosedForSession(true)}
            className="text-[#BBA79C] hover:text-[#8A7265] text-2xl leading-none ml-4 mt-0.5 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Task list */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {tasks.map(task => (
            <div key={task.id} className="bg-[#FFF5E9] rounded-xl p-4 border border-[#E0CFC4]">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-[#BBA79C] mt-0.5">○</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#2D1E1A] leading-snug">{task.text}</p>
                  {task.description && (
                    <p className="text-xs text-[#8A7265] mt-0.5 truncate">{task.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleComplete(task)}
                  disabled={!!loading}
                  style={{ background: 'var(--c-teal)', color: '#fff' }}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                >
                  {loading === task.id + '-complete' ? '…' : 'Completed'}
                </button>
                <button
                  onClick={() => handleRollover(task)}
                  disabled={!!loading}
                  style={{ background: 'var(--c-primary)', color: '#fff' }}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                >
                  {loading === task.id + '-rollover' ? '…' : 'Move to today'}
                </button>
                <button
                  onClick={() => handleDismiss(task)}
                  disabled={!!loading}
                  style={{ background: 'var(--c-error-light)', color: 'var(--c-error)', border: '1px solid var(--c-error-light)' }}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                >
                  {loading === task.id + '-dismiss' ? '…' : 'No longer needed'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <button
            onClick={() => setClosedForSession(true)}
            className="w-full py-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
