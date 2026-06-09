import { useEffect, useState } from 'react';
import type { Habit } from '../types';
import { getHabits, createHabit, logHabit, updateHabitLog, deleteHabit } from '../api/client';

const TODAY = new Date().toISOString().split('T')[0];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getHabits().then(setHabits);
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    const habit = await createHabit(newName.trim());
    setHabits(prev => [...prev, { ...habit, logs: [] }]);
    setNewName('');
  }

  async function handleLog(habitId: string, status: 'completed' | 'skipped') {
    const habit = habits.find(h => h.id === habitId)!;
    const existingLog = habit.logs.find(l => l.date === TODAY);

    if (existingLog) {
      if (existingLog.status === status) return;
      const updated = await updateHabitLog(existingLog.id, status);
      setHabits(prev => prev.map(h =>
        h.id === habitId
          ? { ...h, logs: h.logs.map(l => l.id === updated.id ? updated : l) }
          : h
      ));
    } else {
      const newLog = await logHabit(habitId, TODAY, status);
      setHabits(prev => prev.map(h =>
        h.id === habitId ? { ...h, logs: [...h.logs, newLog] } : h
      ));
    }
  }

  async function handleDelete(id: string) {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Habits — {TODAY}</h1>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="New habit..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {habits.map(habit => {
          const todayLog = habit.logs.find(l => l.date === TODAY);
          return (
            <li key={habit.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-3">
              <span className="flex-1 text-sm text-gray-800">{habit.name}</span>
              <button
                onClick={() => handleLog(habit.id, 'completed')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${todayLog?.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-green-50'}`}
              >
                ✓
              </button>
              <button
                onClick={() => handleLog(habit.id, 'skipped')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${todayLog?.status === 'skipped' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-red-50'}`}
              >
                ✕
              </button>
              <button
                className="text-gray-300 hover:text-red-400 text-sm ml-1"
                onClick={() => handleDelete(habit.id)}
              >
                🗑
              </button>
            </li>
          );
        })}
        {habits.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No habits yet</p>
        )}
      </ul>
    </div>
  );
}
