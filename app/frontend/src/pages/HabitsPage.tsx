import { useEffect, useState } from 'react';
import type { Habit, HabitLog } from '../types';
import { getHabits, createHabit, logHabit, updateHabitLog, deleteHabit } from '../api/client';
import HabitRecordModal from '../components/HabitRecordModal';
import { localDate } from '../utils/date';
import sleepingTurtle from '../assets/Turtles/0609 (1).png';

const TODAY = localDate();

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Easy',   active: 'bg-green-500 text-white', idle: 'bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'medium', label: 'Medium', active: 'bg-amber-500 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { value: 'hard',   label: 'Hard',   active: 'bg-rose-500 text-white',  idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100'   },
] as const;

const DIFF_BADGE: Record<string, string> = {
  easy:   'bg-green-50 text-green-600',
  medium: 'bg-amber-50 text-amber-600',
  hard:   'bg-rose-50 text-rose-600',
};

const DAY_LABELS = ['M','T','W','T','F','S','S'];
const DAY_NUMS   = [1, 2, 3, 4, 5, 6, 7];

function getCurrentWeekDays(): string[] {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function colHeader(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function getLog(habit: Habit, date: string): HabitLog | undefined {
  return habit.logs.find(l => l.date === date);
}

function getISODayNum(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

function isDayActive(habit: Habit, dateStr: string): boolean {
  const active = new Set(habit.activeDays.split(',').map(Number));
  const d = new Date(dateStr + 'T00:00:00');
  return active.has(getISODayNum(d));
}

function datePad(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getStreak(habit: Habit): number {
  const activeDayNums = new Set(habit.activeDays.split(',').map(Number));
  const todayStr = localDate();
  const todayIsActive = activeDayNums.has(getISODayNum(new Date()));
  const todayDone = habit.logs.find(l => l.date === todayStr)?.status === 'completed';

  let streak = 0;
  const d = new Date();

  if (!todayIsActive || (todayIsActive && !todayDone)) d.setDate(d.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const dayNum = getISODayNum(d);
    if (!activeDayNums.has(dayNum)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    const ds = datePad(d);
    if (habit.logs.find(l => l.date === ds)?.status === 'completed') {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [newActiveDays, setNewActiveDays] = useState<Set<number>>(new Set([1,2,3,4,5,6,7]));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const days = getCurrentWeekDays();

  useEffect(() => { getHabits().then(setHabits); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    const activeDaysStr = Array.from(newActiveDays).sort((a, b) => a - b).join(',');
    const habit = await createHabit(newName.trim(), newDifficulty, activeDaysStr);
    setHabits(prev => [...prev, { ...habit, logs: [] }]);
    setNewName('');
    setNewDifficulty('medium');
    setNewActiveDays(new Set([1,2,3,4,5,6,7]));
    setShowModal(false);
  }

  function toggleDay(dayNum: number) {
    setNewActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum) && next.size > 1) next.delete(dayNum);
      else if (!next.has(dayNum)) next.add(dayNum);
      return next;
    });
  }

  async function handleCircleClick(habit: Habit, date: string) {
    if (date !== TODAY) return;
    if (!isDayActive(habit, date)) return;
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
  }

  async function handleDelete(id: string) {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setDeleteConfirm(null);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-stone-800">Habits</h1>
          <p className="text-sm text-stone-400 mt-1">This week</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRecord(true)}
            className="flex items-center gap-2 border border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-800 px-4 py-2.5 rounded-full text-sm font-medium transition-colors">
            📊 Full Record
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors">
            + Add Habit
          </button>
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <img src={sleepingTurtle} alt="Resting turtle" className="turtle-img w-40 h-40 object-contain opacity-80" />
          <div className="text-center">
            <p className="serif text-xl font-semibold text-stone-700">No habits tracked yet</p>
            <p className="text-stone-400 text-sm mt-1">Small actions, done daily, add up to big change.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors">
            Start your first habit
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="sticky left-0 bg-white z-10 text-left px-5 py-3 min-w-[200px] border-r border-stone-100">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Habit</span>
                </th>
                {days.map(day => {
                  const { weekday, date } = colHeader(day);
                  const isToday = day === TODAY;
                  const isFuture = day > TODAY;
                  return (
                    <th key={day} className={`px-4 py-3 text-center min-w-[72px] ${isFuture ? 'opacity-40' : ''}`}>
                      <div className={`text-xs font-semibold ${isToday ? 'text-amber-600' : 'text-stone-500'}`}>{weekday}</div>
                      <div className={`text-xs mt-0.5 ${isToday ? 'text-amber-500' : 'text-stone-400'}`}>{date}</div>
                      {isToday && <div className="w-1 h-1 rounded-full bg-amber-400 mx-auto mt-1" />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {habits.map((habit, idx) => {
                const streak = getStreak(habit);
                return (
                  <tr key={habit.id}
                    className={`border-b border-stone-50 transition-colors hover:bg-stone-50/50 ${idx === habits.length - 1 ? 'border-none' : ''}`}>
                    <td className="sticky left-0 bg-white z-10 px-5 py-3.5 border-r border-stone-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800 leading-tight">{habit.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {streak > 0
                              ? <p className="text-xs text-amber-500">🔥 {streak}d streak</p>
                              : <p className="text-xs text-stone-300">No streak</p>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${DIFF_BADGE[habit.difficulty] ?? 'bg-stone-50 text-stone-400'}`}>
                              {habit.difficulty}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm(habit.id)}
                          className="w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 text-sm font-bold mt-0.5"
                          title="Delete habit"
                        >
                          ×
                        </button>
                      </div>
                    </td>

                    {days.map(day => {
                      const active = isDayActive(habit, day);
                      const log = getLog(habit, day);
                      const isToday = day === TODAY;
                      const isPast = day < TODAY;
                      const isFuture = day > TODAY;
                      const completed = log?.status === 'completed';
                      const skipped = log?.status === 'skipped';

                      if (!active) {
                        return (
                          <td key={day} className="px-4 py-3.5 text-center">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto bg-stone-50">
                              <span className="text-stone-200 text-sm font-bold">–</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={day} className={`px-4 py-3.5 text-center ${isToday ? 'bg-amber-50/60' : ''}`}>
                          <button
                            disabled={!isToday}
                            onClick={() => handleCircleClick(habit, day)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center mx-auto transition-all
                              ${isFuture
                                ? 'bg-stone-50 cursor-default opacity-40'
                                : isPast && completed
                                ? 'bg-emerald-300 cursor-default'
                                : isPast && skipped
                                ? 'bg-red-100 cursor-default'
                                : isPast
                                ? 'bg-stone-100 cursor-default'
                                : isToday && completed
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm cursor-pointer'
                                : isToday && skipped
                                ? 'bg-red-100 hover:bg-red-200 cursor-pointer'
                                : 'bg-stone-100 hover:ring-2 hover:ring-amber-300 cursor-pointer'}`}
                          >
                            {completed && <span className={`text-xs font-bold ${isPast ? 'text-white/70' : 'text-white'}`}>✓</span>}
                            {skipped && <span className="text-red-400 text-xs font-bold">×</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">New Habit</h2>

            <input autoFocus
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50 mb-5"
              placeholder="e.g. Read before bed"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />

            <div className="mb-5">
              <p className="text-xs font-medium text-stone-500 mb-2">How hard on a bad day?</p>
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
              <p className="text-xs font-medium text-stone-500 mb-2">Active days</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => {
                  const dayNum = DAY_NUMS[i];
                  const isOn = newActiveDays.has(dayNum);
                  return (
                    <button key={dayNum} type="button"
                      onClick={() => toggleDay(dayNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isOn ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowModal(false); setNewName(''); setNewDifficulty('medium'); setNewActiveDays(new Set([1,2,3,4,5,6,7])); }}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">Cancel</button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {showRecord && (
        <HabitRecordModal habits={habits} onClose={() => setShowRecord(false)} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center border border-stone-200">
            <p className="text-2xl mb-3">🗑</p>
            <h2 className="text-lg font-semibold text-stone-800 mb-2">Delete this habit?</h2>
            <p className="text-sm text-stone-400 mb-6">All logs will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-400 hover:bg-red-500 transition-colors font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
