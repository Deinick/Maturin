import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Habit, HabitLog } from '../types';
import { getHabits, createHabit, logHabit, updateHabitLog, updateHabit, deleteHabit } from '../api/client';
import HabitRecordModal from '../components/HabitRecordModal';
import Modal from '../components/Modal';
import { localDate } from '../utils/date';
import { ChartNoAxesColumn } from '@/components/animate-ui/icons/chart-no-axes-column';
import { Plus } from '@/components/animate-ui/icons/plus';
import { Sun } from '@/components/animate-ui/icons/sun';
import { Check } from '@/components/animate-ui/icons/check';
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle';
import { Trash2 } from '@/components/animate-ui/icons/trash-2';

const TODAY = localDate();
const TODAY_DATE = new Date();

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Easy',   active: 'bg-green-500 text-white',  idle: 'bg-green-50 text-green-700 hover:bg-green-100'  },
  { value: 'medium', label: 'Medium', active: 'bg-amber-500 text-white',  idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100'  },
  { value: 'hard',   label: 'Hard',   active: 'bg-rose-500 text-white',   idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100'     },
] as const;

const DIFF_BADGE: Record<string, { background: string; color: string }> = {
  easy:   { background: 'var(--c-teal-xlight)',    color: 'var(--c-teal-bright)' },
  medium: { background: 'var(--c-primary-xlight)', color: 'var(--c-primary)' },
  hard:   { background: 'var(--c-error-light)',    color: 'var(--c-error)'   },
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

function heatmapBg(pct: number, isFuture: boolean): string {
  if (isFuture) return 'var(--c-surface-mid)';
  if (pct === 0)  return 'var(--c-surface-mid)';
  if (pct < 40)  return 'var(--c-teal-light)';
  if (pct < 70)  return 'var(--c-teal-bright)';
  return 'var(--c-teal-strong)';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const queryClient = useQueryClient();
  const habitsKey = ['habits'];

  const [showModal,    setShowModal]    = useState(false);
  const [showRecord,   setShowRecord]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDifficulty,setNewDifficulty]= useState<'easy'|'medium'|'hard'>('medium');
  const [newActiveDays,setNewActiveDays]= useState<Set<number>>(new Set([1,2,3,4,5,6,7]));
  const [deleteConfirm,setDeleteConfirm]= useState<string | null>(null);
  const [loggingIds,   setLoggingIds]   = useState<Set<string>>(new Set());
  const [editHabit,     setEditHabit]     = useState<Habit | null>(null);
  const [editName,      setEditName]      = useState('');
  const [editDifficulty,setEditDifficulty]= useState<'easy'|'medium'|'hard'>('medium');
  const [editActiveDays,setEditActiveDays]= useState<Set<number>>(new Set([1,2,3,4,5,6,7]));

  const days = getCurrentWeekDays();

  const { data: habits = [], isLoading: habitsLoading } = useQuery({ queryKey: habitsKey, queryFn: getHabits });

  const longestStreak = useMemo(() => longestStreakAcrossHabits(habits), [habits]);
  const completionRate = useMemo(() => completionRateLast30(habits), [habits]);
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
        queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.map(h => h.id === habit.id
          ? { ...h, logs: h.logs.map(l => l.id === updated.id ? updated : l) }
          : h));
      } else {
        const newLog = await logHabit(habit.id, date, 'completed');
        queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.map(h => h.id === habit.id
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
    queryClient.setQueryData<Habit[]>(habitsKey, prev => [...(prev ?? []), { ...habit, logs: [] }]);
    setNewName('');
    setNewDifficulty('medium');
    setNewActiveDays(new Set([1,2,3,4,5,6,7]));
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    await deleteHabit(id);
    queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.filter(h => h.id !== id));
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

  function openEdit(habit: Habit) {
    setEditHabit(habit);
    setEditName(habit.name);
    setEditDifficulty(habit.difficulty as 'easy'|'medium'|'hard');
    setEditActiveDays(new Set(habit.activeDays.split(',').map(Number)));
  }

  function toggleEditDay(dayNum: number) {
    setEditActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum) && next.size > 1) next.delete(dayNum);
      else if (!next.has(dayNum)) next.add(dayNum);
      return next;
    });
  }

  async function handleEditSave() {
    if (!editHabit || !editName.trim()) return;
    const activeDaysStr = Array.from(editActiveDays).sort((a,b) => a - b).join(',');
    const updated = await updateHabit(editHabit.id, editName.trim(), editDifficulty, activeDaysStr);
    queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.map(h => h.id === updated.id ? { ...h, ...updated } : h));
    setEditHabit(null);
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">Habits</h1>
          <p className="text-sm text-[#8A7265] mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRecord(true)}
            className="flex items-center gap-2 border border-[#E0CFC4] hover:border-[#E0CFC4] text-[#8A7265] hover:text-[#54433A] px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <ChartNoAxesColumn className="w-4 h-4" animateOnHover="default" />
            Full Record
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 btn-primary text-white px-4 py-2 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" animateOnHover="default" />
            Add Habit
          </button>
        </div>
      </div>

      {habitsLoading ? null : habits.length === 0 ? (
        /* ── Empty state ──────────────────────────────────── */
        <div className="flex flex-col items-center py-24 gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F0E9E0] flex items-center justify-center">
            <Sun className="w-7 h-7 text-[#BBA79C]" animateOnHover="default" />
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-[#54433A]">No habits tracked yet</p>
            <p className="text-[#8A7265] text-sm mt-1">Small actions, done daily, add up to big change.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-5 py-2 btn-primary text-white text-sm font-medium transition-colors">
            Start your first habit
          </button>
        </div>
      ) : (
        /* ── Main 2-column grid ───────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Active Habits list */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest">
                Active Habits
              </h3>
              <span className="text-xs text-[#8A7265] bg-[#FFF5E9] px-2.5 py-1 rounded-full">
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
                  className={`bg-white border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#E0CFC4] transition-all ${
                    todayDone ? 'border-[#E0CFC4]' : 'border-[#E0CFC4] hover:shadow-sm'
                  }`}>

                  {/* Left: checkbox + name */}
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      disabled={!isDayActive(habit, TODAY) || loading}
                      onClick={() => handleCircleClick(habit, TODAY)}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${loading ? 'opacity-60' : ''}`}
                      style={todayDone
                        ? { background: 'var(--c-teal-strong)', borderColor: 'var(--c-teal-strong)' }
                        : !isDayActive(habit, TODAY)
                        ? { borderColor: 'var(--c-border)', background: 'var(--c-surface-mid)', cursor: 'not-allowed' }
                        : { borderColor: 'var(--c-border)', cursor: 'pointer' }}
                    >
                      {todayDone && (
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} animate="default" />
                      )}
                      {loading && !todayDone && (
                        <LoaderCircle className="w-3 h-3 text-[#8A7265]" animate="default" loop />
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${todayDone ? 'text-[#8A7265] line-through' : 'text-[#2D1E1A]'}`}>
                        {habit.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {streak > 0
                          ? <span className="text-xs badge-streak">🔥 {streak}d streak</span>
                          : <span className="text-xs text-[#BBA79C]">No streak</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                          style={DIFF_BADGE[habit.difficulty] ?? { background: 'var(--c-surface-mid)', color: 'var(--c-text-muted)' } as React.CSSProperties}>
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

                        let barColor = 'var(--c-border)';
                        if (!active) barColor = 'var(--c-border)';
                        else if (isFuture) barColor = 'var(--c-surface-mid)';
                        else if (completed) barColor = 'var(--c-teal-strong)';
                        else if (skipped) barColor = 'var(--c-warning)';
                        else if (!isFuture) barColor = 'var(--c-border)';

                        return (
                          <div key={day}
                            className={`w-2 rounded-sm transition-colors`}
                            style={{
                              height: active ? (completed ? '16px' : '10px') : '6px',
                              background: barColor,
                              ...(isToday ? { outline: '1px solid var(--c-primary)', outlineOffset: '1px' } : {}),
                            }}
                            title={day}
                          />
                        );
                      })}
                    </div>

                    <button
                      onClick={() => openEdit(habit)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-[#BBA79C] hover:text-[#54433A] hover:bg-[#F0E9E0] transition-colors"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setDeleteConfirm(habit.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-[#BBA79C] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors text-base font-bold leading-none"
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
              <div className="bg-white border border-[#E0CFC4] rounded-2xl p-4 flex flex-col gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wide">Longest Streak</p>
                  <p className="text-2xl font-semibold text-[#2D1E1A] font-serif mt-0.5">{longestStreak}<span className="text-sm font-normal text-[#8A7265] ml-1">days</span></p>
                </div>
              </div>

              <div className="bg-white border border-[#E0CFC4] rounded-2xl p-4 flex flex-col gap-2">
                <ChartNoAxesColumn className="w-5 h-5 text-[#46645c]" animateOnHover="default" />
                <div>
                  <p className="text-[10px] font-semibold text-[#8A7265] uppercase tracking-wide">Completion Rate</p>
                  <p className="text-2xl font-semibold text-[#2D1E1A] font-serif mt-0.5">{completionRate}<span className="text-sm font-normal text-[#8A7265] ml-0.5">%</span></p>
                  <p className="text-[10px] text-[#BBA79C] mt-0.5">last 30 days</p>
                </div>
              </div>

            </div>

            {/* Consistency Heatmap */}
            <div className="bg-white border border-[#E0CFC4] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E0CFC4]">
                <h3 className="text-xs font-semibold text-[#2D1E1A]">Habit Consistency</h3>
                <span className="text-xs text-[#8A7265]">{monthLabel}</span>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['M','T','W','T','F','S','S'].map((l, i) => (
                  <div key={i} className="text-[9px] text-center text-[#8A7265] font-medium">{l}</div>
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
                      className="aspect-square rounded-sm"
                      style={{
                        background: heatmapBg(pct, isFuture),
                        ...(isToday ? { outline: '2px solid var(--c-primary)', outlineOffset: '1px' } : {}),
                        ...(isFuture ? { border: '1px dashed var(--c-border-subtle)', background: 'transparent' } : {}),
                      }}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex justify-end items-center gap-1.5 mt-3">
                <span className="text-[9px] text-[#8A7265]">Less</span>
                <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-surface-mid)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-teal-light)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-teal-bright)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--c-teal-strong)' }} />
                <span className="text-[9px] text-[#8A7265]">More</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Add Habit Modal ─────────────────────────────────────────── */}
      <Modal open={showModal} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4]">
            <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">New Habit</h2>

            <input autoFocus
              className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9] mb-5"
              placeholder="e.g. Read before bed"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />

            <div className="mb-5">
              <p className="text-xs font-medium text-[#8A7265] mb-2">How hard on a bad day?</p>
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
              <p className="text-xs font-medium text-[#8A7265] mb-2">Active days</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => {
                  const dayNum = DAY_NUMS[i];
                  const isOn = newActiveDays.has(dayNum);
                  return (
                    <button key={dayNum} type="button"
                      onClick={() => toggleDay(dayNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isOn ? 'bg-[#C4601A] text-white' : 'bg-[#F0E9E0] text-[#8A7265] hover:bg-[#E0CFC4]'
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
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#C4601A] transition-colors font-medium">
                Add
              </button>
            </div>
      </Modal>

      {/* ── Edit Habit Modal ────────────────────────────────────────── */}
      <Modal open={!!editHabit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4]">
            <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">Edit Habit</h2>

            <input autoFocus
              className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9] mb-5"
              placeholder="e.g. Read before bed"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEditSave()}
            />

            <div className="mb-5">
              <p className="text-xs font-medium text-[#8A7265] mb-2">How hard on a bad day?</p>
              <div className="flex gap-2">
                {DIFFICULTY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditDifficulty(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      editDifficulty === opt.value ? opt.active : opt.idle
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-medium text-[#8A7265] mb-2">Active days</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => {
                  const dayNum = DAY_NUMS[i];
                  const isOn = editActiveDays.has(dayNum);
                  return (
                    <button key={dayNum} type="button"
                      onClick={() => toggleEditDay(dayNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isOn ? 'bg-[#C4601A] text-white' : 'bg-[#F0E9E0] text-[#8A7265] hover:bg-[#E0CFC4]'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditHabit(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSave}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#C4601A] transition-colors font-medium">
                Save
              </button>
            </div>
      </Modal>

      {/* ── Full Record Modal ──────────────────────────────────────── */}
      <HabitRecordModal open={showRecord} habits={habits} onClose={() => setShowRecord(false)} />

      {/* ── Delete Confirm Modal ───────────────────────────────────── */}
      <Modal open={!!deleteConfirm} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-[#E0CFC4]">
            <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5 text-[#ba1a1a]" animateOnHover="default" />
            </div>
            <h2 className="text-base font-semibold text-[#2D1E1A] mb-1">Delete this habit?</h2>
            <p className="text-sm text-[#8A7265] mb-5">All logs will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-[#8A7265] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-400 hover:bg-[#ba1a1a] transition-colors font-medium">
                Delete
              </button>
            </div>
      </Modal>
    </div>
  );
}
