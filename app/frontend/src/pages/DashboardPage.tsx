import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Habit, Suggestion } from '../types';
import { getTasks, getHabits, getProductivity, getSuggestions, runRollover } from '../api/client';

const TODAY = new Date().toISOString().split('T')[0];
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

interface Stats {
  taskScore: number;
  habitScore: number;
  productivity: number;
  totalTasks: number;
  completedTasks: number;
  totalHabitLogs: number;
  completedHabitLogs: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rolloverDone, setRolloverDone] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<{ rolledOver: number; warnings: unknown[] } | null>(null);

  useEffect(() => {
    Promise.all([
      getTasks(TODAY),
      getHabits(),
      getProductivity(),
      getSuggestions(),
    ]).then(([t, h, s, sg]) => {
      setTasks(t);
      setHabits(h);
      setStats(s as Stats);
      setSuggestions(sg);
    });
  }, []);

  async function handleRollover() {
    const result = await runRollover();
    setRolloverResult(result);
    setRolloverDone(true);
    getTasks(TODAY).then(setTasks);
  }

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const todayHabitLogs = habits.map(h => h.logs.find(l => l.date === TODAY));
  const loggedToday = todayHabitLogs.filter(Boolean).length;

  function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
    const pct = Math.round(value * 100);
    const r = 28;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
            <circle
              cx="36" cy="36" r={r} fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-700">{pct}%</span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-light text-gray-800">Good morning</h1>
        <p className="text-sm text-gray-400 mt-1">{DATE_LABEL}</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-5">Last 30 days</p>
          <div className="flex justify-around">
            <ScoreRing value={stats.taskScore} label="Tasks" color="#60a5fa" />
            <ScoreRing value={stats.habitScore} label="Habits" color="#34d399" />
            <ScoreRing value={stats.productivity} label="Overall" color="#a78bfa" />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-gray-50">
            <div className="text-center">
              <p className="text-2xl font-light text-gray-800">{stats.completedTasks}<span className="text-sm text-gray-400">/{stats.totalTasks}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">Tasks completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light text-gray-800">{stats.completedHabitLogs}<span className="text-sm text-gray-400">/{stats.totalHabitLogs}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">Habits logged</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's tasks snapshot */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 cursor-pointer hover:border-blue-200 transition-colors" onClick={() => navigate('/tasks')}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Today's Tasks</p>
          <span className="text-xs text-blue-400">View all →</span>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No tasks for today</p>
        ) : (
          <div className="space-y-2">
            {activeTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                <span className="text-sm text-gray-700 truncate">{task.text}</span>
                {task.rolloverCount > 0 && <span className="text-xs text-amber-400 shrink-0">↩{task.rolloverCount}</span>}
              </div>
            ))}
            {completedTasks.length > 0 && (
              <p className="text-xs text-gray-400 pt-1">{completedTasks.length} completed ✓</p>
            )}
            {activeTasks.length > 4 && (
              <p className="text-xs text-gray-400">+{activeTasks.length - 4} more</p>
            )}
          </div>
        )}
      </div>

      {/* Habits today */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 cursor-pointer hover:border-blue-200 transition-colors" onClick={() => navigate('/habits')}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Habits Today</p>
          <span className="text-xs text-blue-400">View all →</span>
        </div>
        {habits.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No habits yet</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex gap-2 flex-wrap flex-1">
              {habits.map((habit, i) => {
                const log = todayHabitLogs[i];
                return (
                  <div key={habit.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${log?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : log?.status === 'skipped' ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-400'}`}>
                    <span>{log?.status === 'completed' ? '✓' : log?.status === 'skipped' ? '✕' : '○'}</span>
                    <span>{habit.name}</span>
                  </div>
                );
              })}
            </div>
            <span className="text-sm text-gray-400 shrink-0">{loggedToday}/{habits.length}</span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Suggestions</p>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50 rounded-xl px-4 py-3">
                <span className="text-amber-400 mt-0.5 shrink-0">💡</span>
                <p className="text-sm text-gray-600">{s.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rollover */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Daily Rollover</p>
            <p className="text-xs text-gray-400 mt-1">Move yesterday's pending tasks to today</p>
          </div>
          <button
            onClick={handleRollover}
            disabled={rolloverDone}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${rolloverDone ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            {rolloverDone ? 'Done ✓' : 'Run Rollover'}
          </button>
        </div>
        {rolloverResult && (
          <p className="text-xs text-gray-400 mt-3">
            {rolloverResult.rolledOver} task{rolloverResult.rolledOver !== 1 ? 's' : ''} rolled over
            {rolloverResult.warnings.length > 0 && ` · ${rolloverResult.warnings.length} warning${rolloverResult.warnings.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </div>
  );
}
