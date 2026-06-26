import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Habit, Suggestion } from '../types';
import { getTasks, getHabits, getProductivity, getSuggestions, getWeeklySummary } from '../api/client';

const TODAY = new Date().toISOString().split('T')[0];
const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? 'Good morning' : HOUR < 17 ? 'Good afternoon' : 'Good evening';

interface Stats {
  taskScore: number; habitScore: number; productivity: number;
  totalTasks: number; completedTasks: number;
  totalHabitLogs: number; completedHabitLogs: number;
}

interface WeeklySummary {
  weekStart: string; weekEnd: string;
  totalLogged: number; completed: number; pending: number; rolledOver: number;
  bestDay: { date: string; completed: number; total: number } | null;
  categoryStats: { category: string; completed: number; total: number; rate: number }[];
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  const r = 26; const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#E0DDD4" strokeWidth="5" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-stone-700">{pct}%</span>
        </div>
      </div>
      <span className="text-xs text-stone-500 font-medium">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [habits, setHabits]           = useState<Habit[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [weekly, setWeekly]           = useState<WeeklySummary | null>(null);

  useEffect(() => {
    Promise.all([getTasks(TODAY), getHabits(), getProductivity(), getSuggestions(), getWeeklySummary()])
      .then(([t, h, s, sg, w]) => {
        setTasks(t); setHabits(h); setStats(s as Stats);
        setSuggestions(sg); setWeekly(w);
      });
  }, []);

  const active      = tasks.filter(t => !t.completed);
  const completed   = tasks.filter(t => t.completed);
  const todayLogs   = habits.map(h => h.logs.find(l => l.date === TODAY));
  const loggedToday = todayLogs.filter(Boolean).length;

  return (
    <div className="space-y-12">

      {/* ── Hero: overlapping sticky notes ─────────────────── */}
      <div className="flex items-start gap-5 flex-wrap">

        {/* Yellow greeting sticker */}
        <button
          onClick={() => navigate('/account')}
          className="sticker sticker-yellow sticker-tilt-l w-72 p-7 text-left focus:outline-none"
          title="View account"
        >
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Welcome back</p>
          <h1 className="serif text-3xl font-bold text-stone-800 leading-tight">{GREETING}!</h1>
          <p className="text-stone-500 text-sm mt-3 leading-relaxed">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {stats && (
            <p className="text-stone-600 text-sm mt-3">
              Monthly productivity:{' '}
              <span className="serif text-3xl font-bold text-emerald-700">
                {Math.round(stats.productivity * 100)}%
              </span>
            </p>
          )}
        </button>

        {/* Blue this-week sticker — shows when there's weekly data */}
        {weekly && weekly.totalLogged > 0 ? (
          <div className="sticker sticker-blue sticker-tilt-r flex-1 min-w-60 p-6 mt-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Summary</p>
            <h2 className="font-bold text-stone-800 mb-3 text-base">This Week</h2>
            <p className="text-sm text-stone-700 leading-relaxed">
              You logged <span className="font-semibold">{weekly.totalLogged}</span> tasks, completed{' '}
              <span className="font-semibold text-emerald-700">{weekly.completed}</span>
              {weekly.rolledOver > 0 && <>, rolled over <span className="font-semibold text-amber-600">{weekly.rolledOver}</span></>}
              {weekly.pending > 0 && <>, <span className="font-semibold text-stone-500">{weekly.pending}</span> pending</>}.
              {weekly.bestDay && (
                <> Best day: <span className="font-semibold">
                  {new Date(weekly.bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </span> ({weekly.bestDay.completed}/{weekly.bestDay.total}).</>
              )}
            </p>
            {weekly.categoryStats.filter(c => c.total > 0).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {weekly.categoryStats.filter(c => c.total > 0).slice(0, 4).map(c => (
                  <span key={c.category}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                      c.rate >= 0.7 ? 'bg-emerald-200 text-emerald-800' :
                      c.rate >= 0.4 ? 'bg-amber-200 text-amber-800' :
                      'bg-red-200 text-red-800'
                    }`}>
                    {c.category} {Math.round(c.rate * 100)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : suggestions.length > 0 && (
          /* Pink suggestions sticker when no weekly data yet */
          <div className="sticker sticker-pink sticker-tilt-r flex-1 min-w-52 p-6 mt-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Insights</p>
            <h2 className="font-bold text-stone-800 mb-3 text-base">Suggestions</h2>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s, i) => (
                <p key={i} className="text-xs text-stone-700 leading-relaxed">{s.message}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Links ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5 ml-1">
          Quick Links
        </p>
        <div className="grid grid-cols-3 gap-5">

          {/* Tasks — pink */}
          <button onClick={() => navigate('/tasks')}
            className="sticker sticker-pink sticker-tilt-l p-6 text-left w-full focus:outline-none">
            <p className="text-xs text-rose-500 font-semibold uppercase tracking-wide mb-1">Tasks</p>
            <h3 className="font-bold text-stone-800 mb-3 text-sm">Today's Tasks</h3>
            <div className="w-full h-1.5 bg-white/70 rounded-full mb-2">
              <div className="h-1.5 bg-rose-400 rounded-full transition-all duration-500"
                style={{ width: tasks.length === 0 ? '0%' : `${Math.round((completed.length / tasks.length) * 100)}%` }} />
            </div>
            <p className="text-xs text-stone-500">
              {active.length > 0 ? `${active.length} remaining` : completed.length > 0 ? 'All done! 🎉' : 'No tasks yet'}
            </p>
            <p className="text-right text-stone-400 text-base mt-3">→</p>
          </button>

          {/* Habits — mint */}
          <button onClick={() => navigate('/habits')}
            className="sticker sticker-mint sticker-tilt-rr p-6 text-left w-full focus:outline-none">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Habits</p>
            <h3 className="font-bold text-stone-800 mb-3 text-sm">Habits Today</h3>
            <div className="w-full h-1.5 bg-white/70 rounded-full mb-2">
              <div className="h-1.5 bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: habits.length === 0 ? '0%' : `${Math.round((loggedToday / habits.length) * 100)}%` }} />
            </div>
            <p className="text-xs text-stone-500">
              {habits.length === 0 ? 'No habits yet' : `${loggedToday} of ${habits.length} logged`}
            </p>
            <p className="text-right text-stone-400 text-base mt-3">→</p>
          </button>

          {/* Suggestions — yellow */}
          <button onClick={() => navigate('/suggestions')}
            className="sticker sticker-yellow sticker-tilt-ll p-6 text-left w-full focus:outline-none">
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Insights</p>
            <h3 className="font-bold text-stone-800 mb-3 text-sm">Suggestions</h3>
            {suggestions.length === 0
              ? <p className="text-xs text-stone-500">All looking good!</p>
              : <div className="space-y-1.5">
                  {suggestions.slice(0, 2).map((s, i) => (
                    <p key={i} className="text-xs text-stone-600 leading-relaxed line-clamp-2">{s.message}</p>
                  ))}
                  {suggestions.length > 2 && (
                    <p className="text-xs text-amber-600 font-medium">+{suggestions.length - 2} more</p>
                  )}
                </div>
            }
            <p className="text-right text-stone-400 text-base mt-3">→</p>
          </button>

        </div>
      </div>

      {/* ── Last 30 Days (stat rings) ────────────────────────── */}
      {stats && (
        <div>
          <div className="mb-5">
            <span className="label-tape label-tape-red">Last 30 Days</span>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-sm border border-[#DDD8CC] shadow-sm px-6 py-6">
            <div className="flex items-center justify-around">
              <Ring value={stats.taskScore}    label="Tasks"   color="#16a34a" />
              <div className="w-px h-12 bg-stone-200" />
              <Ring value={stats.habitScore}   label="Habits"  color="#f59e0b" />
              <div className="w-px h-12 bg-stone-200" />
              <Ring value={stats.productivity} label="Overall" color="#0ea5e9" />
              <div className="w-px h-12 bg-stone-200" />
              <div className="text-center">
                <p className="text-2xl font-light text-stone-800 serif">
                  {stats.completedTasks}
                  <span className="text-sm text-stone-400">/{stats.totalTasks}</span>
                </p>
                <p className="text-xs text-stone-400 mt-1">Tasks done</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-light text-stone-800 serif">
                  {stats.completedHabitLogs}
                  <span className="text-sm text-stone-400">/{stats.totalHabitLogs}</span>
                </p>
                <p className="text-xs text-stone-400 mt-1">Habits logged</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
