import { useEffect, useState, useMemo } from 'react';
import type { Habit, HabitLog } from '../types';
import { getHabits, createHabit, logHabit, updateHabitLog, deleteHabit } from '../api/client';
import HabitRecordModal from '../components/HabitRecordModal';
import { localDate } from '../utils/date';

const TODAY = localDate();
const TODAY_DATE = new Date();

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Easy',   active: 'bg-green-500 text-white',  idle: 'bg-green-50 text-green-700 hover:bg-green-100'  },
  { value: 'medium', label: 'Medium', active: 'bg-amber-500 text-white',  idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100'  },
  { value: 'hard',   label: 'Hard',   active: 'bg-rose-500 text-white',   idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100'     },
] as const;

const DIFF_BADGE: Record<string, string> = {
  easy:   'bg-green-50 text-green-600',
  medium: 'bg-amber-50 text-amber-600',
  hard:   'bg-rose-50 text-rose-600',
};

const DAY_LABELS = ['M','T','W','T','F','S','S'];
const DAY_NUMS   = [1, 2, 3, 4, 5, 6, 7];

function datePad(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getISODayNum(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

function isDayActive(habit: Habit, dateStr: string): boolean {
  const active = new Set(habit.activeDays.split(',').map(Number));
  return active.has(getISODayNum(new Date(dateStr + 'T00:00:00')));
}

function getLog(habit: Habit, date: string): HabitLog | undefined {
  return habit.logs.find(l => l.date === date);
}

function getCurrentWeekDays(): string[] {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return datePad(d);
  });
}

function getStreak(habit: Habit): number {
  const activeDayNums = new Set(habit.activeDays.split(',').map(Number));
  const todayStr = localDate();
  const todayDone = habit.logs.find(l => l.date === todayStr)?.status === 'completed';
  let streak = 0;
  const d = new Date();
  if (!activeDayNums.has(getISODayNum(d)) || !todayDone) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    if (!activeDayNums.has(getISODayNum(d))) { d.setDate(d.getDate() - 1); continue; }
    const ds = datePad(d);
    if (habit.logs.find(l => l.date === ds)?.status === 'completed') { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Analytics helpers ───────────────────────────────────────────────────────

function longestStreakAcrossHabits(habits: Habit[]): number {
  return habits.reduce((max, h) => Math.max(max, getStreak(h)), 0);
}

function completionRateLast30(habits: Habit[]): number {
  if (habits.length === 0) return 0;
  let expected = 0;
  let completed = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (datePad(d) > TODAY) continue;
    const ds = datePad(d);
    habits.forEach(h => {
      if (isDayActive(h, ds)) {
        expected++;
        if (h.logs.find(l => l.date === ds)?.status === 'completed') completed++;
      }
    });
  }
  return expected === 0 ? 0 : Math.round(completed / expected * 100);
}

function focusScore(rate: number): string {
  if (rate >= 80) return 'Excellent';
  if (rate >= 60) return 'Good';
  if (rate >= 40) return 'Fair';
  return 'Needs Work';
}

function focusScoreColor(rate: number): string {
  if (rate >= 80) return 'text-emerald-600';
  if (rate >= 60) return 'text-blue-600';
  if (rate >= 40) return 'text-amber-600';
  return 'text-rose-500';
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

function buildHeatmapData(habits: Habit[]): { date: string; pct: number; isFuture: boolean }[] {
  const year  = TODAY_DATE.getFullYear();
  const month = TODAY_DATE.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const d   = new Date(year, month, i + 1);
    const ds  = datePad(d);
    const isFuture = ds > TODAY;
    if (isFuture) return { date: ds, pct: -1, isFuture: true };
    const expected = habits.filter(h => isDayActive(h, ds)).length;
    if (expected === 0) return { date: ds, pct: 0, isFuture: false };
    const done = habits.filter(h => h.logs.find(l => l.date === ds)?.status === 'completed').length;
    return { date: ds, pct: Math.round(done / expected * 100), isFuture: false };
  });
}

function heatmapColor(pct: number, isFuture: boolean, isToday: boolean): string {
  if (isToday) return 'bg-transparent border border-[#14B8A6]';
  if (isFuture) return 'bg-slate-100 border border-dashed border-slate-200';
  if (pct === 0)  return 'bg-slate-100';
  if (pct < 40)  return 'bg-teal-200/50';
  if (pct < 70)  return 'bg-teal-300/70';
  return 'bg-[#14B8A6]';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const [habits,       setHabits]       = useState<Habit[]>([]);
  const [showModal,    setShowModal]    = useState(false);
  const [showRecord,   setShowRecord]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDifficulty,setNewDifficulty]= useState<'easy'|'medium'|'hard'>('medium');
  const [newActiveDays,setNewActiveDays]= useState<Set<number>>(new Set([1,2,3,4,5,6,7]));
  const [deleteConfirm,setDeleteConfirm]= useState<string | null>(null);
  const [loggingIds,   setLoggingIds]   = useState<Set<string>>(new Set());

  const days = getCurrentWeekDays();

  useEffect(() => { getHabits().then(setHabits); }, []);

  const longestStreak = useMemo(() => longestStreakAcrossHabits(habits), [habits]);
  const completionRate = useMemo(() => completionRateLast30(habits), [habits]);
  const focusLabel = focusScore(completionRate);
  const focusColor = focusScoreColor(completionRate);
  const heatmapData = useMemo(() => buildHeatmapData(habits), [habits]);

  const todayLoggedCount = habits.filter(h => h.logs.find(l => l.date === TODAY)?.status === 'completed').length;

  // Heatmap calendar offset: day-of-week for first of month (Monday = 0)
  const firstDayOffset = useMemo(() => {
    const d = new Date(TODAY_DATE.getFullYear(), TODAY_DATE.getMonth(), 1);
    return (d.getDay() + 6) % 7; // Monday-based offset
  }, []);

  async function handleCircleClick(habit: Habit, date: string) {
    if (date !== TODAY || !isDayActive(habit, date)) return;
    if (loggingIds.has(habit.id)) return;
    setLoggingIds(prev => new Set([...prev, habit.id]));
    try {
      const existing = getLog(habit, date);
      if (existing) {
        const updated = await updateHabitLog(existing.id, existing.status === 'completed' ? 'skipped' : 'completed');
        setHabits(prev => prev.map(h => h.id === habit.id
          ? { ...h, logs: h.logs.map(l => l.id === updated.id ? updated : l) }
          : h));
      } else {
        const newLog = await logHabit(habit.id, date, 'completed');
        setHabits(prev => prev.map(h => h.id === habit.id
          ? { ...h, logs: [...h.logs, newLog] }
          : h));
      }
    } finally {
      setLoggingIds(prev => { const next = new Set(prev); next.delete(habit.id); return next; });
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const activeDaysStr = Array.from(newActiveDays).sort((a,b) => a - b).join(',');
    const habit = await createHabit(newName.trim(), newDifficulty, activeDaysStr);
    setHabits(prev => [...prev, { ...habit, logs: [] }]);
    setNewName('');
    setNewDifficulty('medium');
    setNewActiveDays(new Set([1,2,3,4,5,6,7]));
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setDeleteConfirm(null);
  }

  function toggleDay(dayNum: number) {
    setNewActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum) && next.size > 1) next.delete(dayNum);
      else if (!next.has(dayNum)) next.add(dayNum);
      return next;
    });
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="max-w-5xl">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Daily Habits</h1>
          <p className="text-sm text-slate-400 mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRecord(true)}
            className="flex items-center gap-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Full Record
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Habit
          </button>
        </div>
      </div>

      {habits.length === 0 ? (
        /* ── Empty state ──────────────────────────────────── */
        <div className="flex flex-col items-center py-24 gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-700">No habits tracked yet</p>
            <p className="text-slate-400 text-sm mt-1">Small actions, done daily, add up to big change.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-5 py-2 bg-[#0f172a] text-white text-sm font-medium rounded-xl hover:bg-[#1e293b] transition-colors">
            Start your first habit
          </button>
        </div>
      ) : (
        /* ── Main 2-column grid ───────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Active Habits list */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Active Habits
              </h3>
              <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                {todayLoggedCount}/{habits.length} today
              </span>
            </div>

            {habits.map(habit => {
              const streak  = getStreak(habit);
              const todayLog = getLog(habit, TODAY);
              const todayDone = todayLog?.status === 'completed';
              const loading = loggingIds.has(habit.id);

              return (
                <div key={habit.id}
                  className={`bg-white border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-200 transition-all ${
                    todayDone ? 'border-slate-100' : 'border-slate-100 hover:shadow-sm'
                  }`}>

                  {/* Left: checkbox + name */}
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      disabled={!isDayActive(habit, TODAY) || loading}
                      onClick={() => handleCircleClick(habit, TODAY)}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                        todayDone
                          ? 'bg-[#14B8A6] border-[#14B8A6]'
                          : !isDayActive(habit, TODAY)
                          ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                          : 'border-slate-300 hover:border-[#14B8A6] cursor-pointer'
                      } ${loading ? 'opacity-60' : ''}`}
                    >
                      {todayDone && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {loading && !todayDone && (
                        <svg className="w-3 h-3 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${todayDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {habit.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {streak > 0
                          ? <span className="text-xs text-amber-500">🔥 {streak}d streak</span>
                          : <span className="text-xs text-slate-300">No streak</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${DIFF_BADGE[habit.difficulty] ?? 'bg-slate-50 text-slate-400'}`}>
                          {habit.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: 7-bar sparkline + delete */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* 7-day sparkline */}
                    <div className="flex items-end gap-[3px]" title="This week">
                      {days.map(day => {
                        const active    = isDayActive(habit, day);
                        const log       = getLog(habit, day);
                        const completed = log?.status === 'completed';
                        const skipped   = log?.status === 'skipped';
                        const isFuture  = day > TODAY;
                        const isToday   = day === TODAY;

                        let barColor = 'bg-slate-200';
                        if (!active) barColor = 'bg-slate-100';
                        else if (isFuture) barColor = 'bg-slate-100';
                        else if (completed) barColor = 'bg-[#14B8A6]';
                        else if (skipped) barColor = 'bg-rose-200';
                        else if (!isFuture) barColor = 'bg-slate-200';

                        return (
                          <div key={day}
                            className={`w-2 rounded-sm transition-colors ${barColor} ${isToday ? 'ring-1 ring-offset-1 ring-[#14B8A6]/50' : ''}`}
                            style={{ height: active ? (completed ? '16px' : '10px') : '6px' }}
                            title={day}
                          />
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setDeleteConfirm(habit.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors text-base font-bold leading-none"
                      title="Delete"
                    >×</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Analytics + Heatmap */}
          <div className="flex flex-col gap-4">

            {/* Analytics grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Longest Streak</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-0.5">{longestStreak}<span className="text-sm font-normal text-slate-400 ml-1">days</span></p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Completion Rate</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-0.5">{completionRate}<span className="text-sm font-normal text-slate-400 ml-0.5">%</span></p>
                  <p className="text-[10px] text-slate-300 mt-0.5">last 30 days</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-2 col-span-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                </svg>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Focus Score</p>
                    <p className={`text-xl font-semibold mt-0.5 ${focusColor}`}>{focusLabel}</p>
                  </div>
                  <div className="flex-1 ml-4">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#14B8A6] rounded-full transition-all duration-700"
                        style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consistency Heatmap */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                <h3 className="text-xs font-semibold text-slate-800">Habit Consistency</h3>
                <span className="text-xs text-slate-400">{monthLabel}</span>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['M','T','W','T','F','S','S'].map((l, i) => (
                  <div key={i} className="text-[9px] text-center text-slate-400 font-medium">{l}</div>
                ))}
              </div>

              {/* Calendar grid with offset */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset */}
                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <div key={`off-${i}`} />
                ))}
                {/* Day cells */}
                {heatmapData.map(({ date, pct, isFuture }) => {
                  const isToday = date === TODAY;
                  return (
                    <div key={date}
                      title={`${date}: ${isFuture ? 'Future' : pct === 0 ? 'No habits completed' : `${pct}% completed`}`}
                      className={`aspect-square rounded-sm ${heatmapColor(pct, isFuture, isToday)}`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex justify-end items-center gap-1.5 mt-3">
                <span className="text-[9px] text-slate-400">Less</span>
                <div className="w-3 h-3 rounded-sm bg-slate-100" />
                <div className="w-3 h-3 rounded-sm bg-teal-200/50" />
                <div className="w-3 h-3 rounded-sm bg-teal-300/70" />
                <div className="w-3 h-3 rounded-sm bg-[#14B8A6]" />
                <span className="text-[9px] text-slate-400">More</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Add Habit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">New Habit</h2>

            <input autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 bg-slate-50 mb-5"
              placeholder="e.g. Read before bed"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />

            <div className="mb-5">
              <p className="text-xs font-medium text-slate-500 mb-2">How hard on a bad day?</p>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setNewDifficulty(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      newDifficulty === opt.value ? opt.active : opt.idle
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-medium text-slate-500 mb-2">Active days</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => {
                  const dayNum = DAY_NUMS[i];
                  const isOn = newActiveDays.has(dayNum);
                  return (
                    <button key={dayNum} type="button"
                      onClick={() => toggleDay(dayNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isOn ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setNewName(''); setNewDifficulty('medium'); setNewActiveDays(new Set([1,2,3,4,5,6,7])); }}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors font-medium">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Record Modal ──────────────────────────────────────── */}
      {showRecord && <HabitRecordModal habits={habits} onClose={() => setShowRecord(false)} />}

      {/* ── Delete Confirm Modal ───────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-1">Delete this habit?</h2>
            <p className="text-sm text-slate-400 mb-5">All logs will be lost.</p>
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
