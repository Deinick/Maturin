import { useEffect, useState } from 'react';
import type { Habit, HabitLog } from '../types';
import { getHabits, createHabit, logHabit, updateHabitLog, deleteHabit } from '../api/client';
import sleepingTurtle from '../assets/Turtles/0609 (1).png';

const DAYS = 7;

function getLast7Days(): string[] {
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const TODAY = new Date().toISOString().split('T')[0];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const days = getLast7Days();

  useEffect(() => { getHabits().then(setHabits); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    const habit = await createHabit(newName.trim());
    setHabits(prev => [...prev, { ...habit, logs: [] }]);
    setNewName('');
    setShowModal(false);
  }

  async function handleCircleClick(habit: Habit, date: string) {
    if (date !== TODAY) return;
    const existingLog = habit.logs.find(l => l.date === date);
    if (existingLog) {
      const updated = await updateHabitLog(existingLog.id, existingLog.status === 'completed' ? 'skipped' : 'completed');
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, logs: h.logs.map(l => l.id === updated.id ? updated : l) } : h));
    } else {
      const newLog = await logHabit(habit.id, date, 'completed');
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, logs: [...h.logs, newLog] } : h));
    }
  }

  async function handleDelete(id: string) {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setDeleteConfirm(null);
  }

  function getLog(habit: Habit, date: string): HabitLog | undefined {
    return habit.logs.find(l => l.date === date);
  }

  function getStreak(habit: Habit): number {
    let streak = 0;
    for (const day of [...days].reverse()) {
      if (getLog(habit, day)?.status === 'completed') streak++;
      else break;
    }
    return streak;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-stone-800">Habits</h1>
          <p className="text-sm text-stone-400 mt-1">Last 7 days</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-colors">
          + Add Habit
        </button>
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
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Column headers */}
            <div className="flex mb-6" style={{ paddingLeft: '160px' }}>
              {habits.map(habit => {
                const streak = getStreak(habit);
                return (
                  <div key={habit.id} className="w-20 flex flex-col items-center gap-1 px-1">
                    <p className="text-xs font-semibold text-stone-700 text-center leading-tight">{habit.name}</p>
                    {streak > 0
                      ? <p className="text-xs text-amber-500">🔥 {streak}d</p>
                      : <p className="text-xs text-stone-300">— streak</p>}
                    <button onClick={() => setDeleteConfirm(habit.id)}
                      className="text-stone-200 hover:text-red-400 transition-colors text-base leading-none mt-0.5">×</button>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="space-y-3">
              {days.map(day => {
                const isToday = day === TODAY;
                return (
                  <div key={day} className={`flex items-center rounded-2xl px-3 py-1.5 transition-all ${isToday ? 'ring-2 ring-amber-400 bg-amber-50' : ''}`}>
                    <div className="w-[160px] shrink-0">
                      <span className={`text-xs font-medium ${isToday ? 'text-amber-600 font-semibold' : 'text-stone-400'}`}>
                        {formatDay(day)}
                      </span>
                      {isToday && <span className="ml-1.5 text-xs text-amber-400">· today</span>}
                    </div>
                    <div className="flex">
                      {habits.map(habit => {
                        const log = getLog(habit, day);
                        const isPast = day < TODAY;
                        const isEditable = day === TODAY;
                        const completed = log?.status === 'completed';
                        const skipped = log?.status === 'skipped';
                        return (
                          <div key={habit.id} className="w-20 flex justify-center">
                            <button
                              disabled={!isEditable}
                              onClick={() => handleCircleClick(habit, day)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                !isEditable && isPast
                                  ? completed ? 'bg-emerald-300 cursor-default' : skipped ? 'bg-red-100 cursor-default' : 'bg-stone-100 cursor-default'
                                  : !isEditable
                                  ? 'bg-stone-50 cursor-default'
                                  : completed ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm cursor-pointer'
                                  : skipped ? 'bg-red-100 hover:bg-red-200 cursor-pointer'
                                  : 'bg-stone-100 hover:ring-2 hover:ring-amber-300 cursor-pointer'
                              }`}
                            >
                              {completed && <span className={`text-xs ${isPast ? 'text-white/70' : 'text-white'}`}>✓</span>}
                              {skipped && <span className="text-red-400 text-xs">×</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 mb-5">New Habit</h2>
            <input autoFocus
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50"
              placeholder="e.g. Read before bed"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setNewName(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">Cancel</button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
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
