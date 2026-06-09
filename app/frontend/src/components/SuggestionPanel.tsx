import { useEffect, useState } from 'react';
import type { Suggestion } from '../types';
import { getSuggestions } from '../api/client';

const TYPE_LABELS: Record<string, string> = {
  split_task: '✂️ Split task',
  reduce_tasks: '📉 Reduce load',
  overdue_milestone: '⚠️ Overdue',
  habit_streak_broken: '🔁 Habit streak',
};

export default function SuggestionPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    getSuggestions().then(setSuggestions);
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <div className="w-72 shrink-0">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Suggestions</h2>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
            <div className="text-xs font-medium text-yellow-700 mb-1">
              {TYPE_LABELS[s.type] ?? s.type}
            </div>
            <div className="text-xs text-gray-600">{s.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
