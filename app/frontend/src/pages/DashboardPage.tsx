import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Habit, Suggestion } from '../types';
import { getTasks, getHabits, getProductivity, getSuggestions, getWeeklySummary } from '../api/client';

import heroTurtle from '../assets/Turtles/0609 (1)(2).png';

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
          <circle cx="32" cy="32" r={r} fill="none" stroke="#D6CFC0" strokeWidth="5" />
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    Promise.all([getTasks(TODAY), getHabits(), getProductivity(), getSuggestions(), getWeeklySummary()])
      .then(([t, h, s, sg, w]) => { setTasks(t); setHabits(h); setStats(s as Stats); setSuggestions(sg); setWeekly(w); });
  }, []);

  const active = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const todayLogs = habits.map(h => h.logs.find(l => l.date === TODAY));
  const loggedToday = todayLogs.filter(Boolean).length;

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => navigate('/account')}
          className="relative shrink-0 group focus:outline-none"
          title="View account"
        >
          <img src={heroTurtle} alt="Steadily mascot"
            className="turtle-img w-36 h-36 object-contain drop-shadow-md transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_24px_rgba(16,185,129,0.45)]" />
          <span className="absolute inset-0 rounded-full bg-emerald-300/0 group-hover:bg-emerald-300/10 transition-all duration-300 scale-110 pointer-events-none" />
        </button>
        <div>
          <h1 className="serif text-4xl font-bold text-stone-800">{GREETING}</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {stats && (
            <p className="text-stone-400 text-sm mt-2">
              Overall productivity: <span className="text-emerald-700 font-semibold">{Math.round(stats.productivity * 100)}%</span> this month
            </p>
          )}
        </div>
      </div>

      {/* Stat rings */}
      {stats && (
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-[#D6CFC0] shadow-sm px-6 py-5">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-5">Last 30 days</p>
          <div className="flex items-center justify-around">
            <Ring value={stats.taskScore}    label="Tasks"   color="#16a34a" />
            <div className="w-px h-12 bg-stone-200" />
            <Ring value={stats.habitScore}   label="Habits"  color="#f59e0b" />
            <div className="w-px h-12 bg-stone-200" />
            <Ring value={stats.productivity} label="Overall" color="#0ea5e9" />
            <div className="w-px h-12 bg-stone-200" />
            <div className="text-center">
              <p className="text-2xl font-light text-stone-800 serif">{stats.completedTasks}<span className="text-sm text-stone-400">/{stats.totalTasks}</span></p>
              <p className="text-xs text-stone-400 mt-1">Tasks done</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light text-stone-800 serif">{stats.completedHabitLogs}<span className="text-sm text-stone-400">/{stats.totalHabitLogs}</span></p>
              <p className="text-xs text-stone-400 mt-1">Habits logged</p>
            </div>
          </div>
        </div>
      )}

      {/* Weekly summary */}
      {weekly && weekly.totalLogged > 0 && (
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-[#D6CFC0] shadow-sm px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">This week</p>
            <p className="text-xs text-stone-400">
              {new Date(weekly.weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {new Date(weekly.weekEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">
            You logged <span className="font-semibold">{weekly.totalLogged}</span> task{weekly.totalLogged !== 1 ? 's' : ''},{' '}
            completed <span className="font-semibold text-emerald-700">{weekly.completed}</span>,{' '}
            {weekly.rolledOver > 0 && <>rolled over <span className="font-semibold text-amber-600">{weekly.rolledOver}</span>, </>}
            {weekly.pending > 0 && <><span className="font-semibold text-stone-500">{weekly.pending}</span> still pending. </>}
            {weekly.bestDay && (
              <>
                Best day:{' '}
                <span className="font-semibold">
                  {new Date(weekly.bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </span>
                {' '}({weekly.bestDay.completed}/{weekly.bestDay.total} done).
              </>
            )}
          </p>
          {weekly.categoryStats.filter(c => c.total > 0).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {weekly.categoryStats.filter(c => c.total > 0).map(c => (
                <span key={c.category}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                    c.rate >= 0.7 ? 'bg-emerald-50 text-emerald-700' :
                    c.rate >= 0.4 ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>
                  {c.category} {Math.round(c.rate * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-card grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Tasks card */}
        <div onClick={() => navigate('/tasks')}
          className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-[#D6CFC0] hover:border-emerald-400 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="text-3xl mb-3">✦</div>
          <h2 className="serif text-lg font-bold text-stone-800 mb-1">Today's Tasks</h2>
          <div className="w-full h-1.5 bg-stone-100 rounded-full mb-2">
            <div className="h-1.5 bg-emerald-500 rounded-full transition-all"
              style={{ width: tasks.length === 0 ? '0%' : `${Math.round((completed.length / tasks.length) * 100)}%` }} />
          </div>
          <p className="text-xs text-stone-400">
            {active.length > 0 ? `${active.length} task${active.length !== 1 ? 's' : ''} remaining` : completed.length > 0 ? 'All done! 🎉' : 'No tasks yet'}
          </p>
        </div>

        {/* Habits card */}
        <div onClick={() => navigate('/habits')}
          className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-[#D6CFC0] hover:border-amber-400 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="text-3xl mb-3">○</div>
          <h2 className="serif text-lg font-bold text-stone-800 mb-1">Habits Today</h2>
          <div className="w-full h-1.5 bg-stone-100 rounded-full mb-2">
            <div className="h-1.5 bg-amber-400 rounded-full transition-all"
              style={{ width: habits.length === 0 ? '0%' : `${Math.round((loggedToday / habits.length) * 100)}%` }} />
          </div>
          <p className="text-xs text-stone-400">
            {habits.length === 0 ? 'No habits yet' : `${loggedToday} of ${habits.length} logged`}
          </p>
        </div>

        {/* Suggestions card */}
        <div onClick={() => navigate('/projects')}
          className="bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-[#D6CFC0] hover:border-blue-300 shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="text-3xl mb-3">💡</div>
          <h2 className="serif text-lg font-bold text-stone-800 mb-2">Suggestions</h2>
          {suggestions.length === 0
            ? <p className="text-xs text-stone-400">All looking good!</p>
            : <div className="space-y-1.5">
                {suggestions.slice(0, 2).map((s, i) => (
                  <p key={i} className="text-xs text-stone-500 leading-relaxed">{s.message}</p>
                ))}
                {suggestions.length > 2 && <p className="text-xs text-amber-500">+{suggestions.length - 2} more</p>}
              </div>
          }
        </div>

      </div>
    </div>
  );
}
