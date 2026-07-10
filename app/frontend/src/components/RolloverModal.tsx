import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import type { Task } from '../types';
import { getOverdueTasks, updateTask, rolloverTask } from '../api/client';
import { localDate } from '../utils/date';
import Modal from './Modal';
import { AlarmClock } from '@/components/animate-ui/icons/alarm-clock';

const TODAY = localDate();

function taskDateLabel(dateAssigned: string) {
  return new Date(dateAssigned + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function RolloverModal() {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getOverdueTasks().then(pending => {
      if (pending.length > 0) {
        setTasks(pending);
        setOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    if (tasks.length === 0) { setOpen(false); setMinimized(false); }
  }, [tasks]);

  function handlePostpone() {
    setOpen(false);
    setMinimized(true);
  }

  function handleReopen() {
    setMinimized(false);
    setOpen(true);
  }

  async function handleComplete(task: Task) {
    setLoading(task.id + '-complete');
    await updateTask(task.id, { completed: true });
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setLoading(null);
  }

  async function handleRollover(task: Task) {
    setLoading(task.id + '-rollover');
    const updated = await rolloverTask(task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    // The Tasks page keeps its own query-cache copy of today's tasks — patch it directly
    // so the rolled-over task shows up there immediately instead of needing a reload.
    queryClient.setQueryData<Task[]>(['tasks', TODAY], prev =>
      prev ? [...prev, updated] : prev);
    setLoading(null);
  }

  async function handleDismiss(task: Task) {
    setLoading(task.id + '-dismiss');
    await updateTask(task.id, { status: 'dismissed' });
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setLoading(null);
  }

  return (
    <>
      <Modal open={open} className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E0CFC4]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#E0CFC4]">
          <div>
            <h2 className="text-lg font-semibold text-[#2D1E1A]">Unfinished Tasks</h2>
            <p className="text-sm text-[#8A7265] mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} from before today
            </p>
          </div>
          <button
            onClick={handlePostpone}
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
                  <p className="text-xs text-[#BBA79C] mt-0.5">{taskDateLabel(task.dateAssigned)}</p>
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
            onClick={handlePostpone}
            className="w-full py-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors"
          >
            Remind me later
          </button>
        </div>
      </Modal>

      {/* Floating badge — reopens the modal so postponed tasks don't require a page reload to resolve */}
      <AnimatePresence>
        {minimized && tasks.length > 0 && (
          <motion.button
            onClick={handleReopen}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-[#2D1E1A] text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:bg-[#3A2A22] transition-colors"
          >
            <AlarmClock className="w-4 h-4 text-amber-400" animate="default" loop />
            <span className="text-sm font-medium">
              {tasks.length} unresolved task{tasks.length !== 1 ? 's' : ''}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
