import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Suggestion } from '../types';
import { getSuggestions } from '../api/client';

const TYPE_META: Record<string, { label: string; icon: string; accent: string }> = {
    split_task:       { label: 'Split task',        icon: '✂️',  accent: 'border-rose-300'   },
    reduce_tasks:     { label: 'Reduce load',        icon: '📉',  accent: 'border-rose-300'   },
    avoidance_pattern:{ label: 'Avoidance pattern',  icon: '👁',  accent: 'border-amber-300'  },
    habit_recovery:   { label: 'Habit recovery',     icon: '🔄',  accent: 'border-emerald-300'},
    overdue_milestone:{ label: 'Overdue milestone',  icon: '⏰',  accent: 'border-amber-300'  },
    block_pattern:    { label: 'Blocked',            icon: '🚧',  accent: 'border-amber-300'  },
    calibration:      { label: 'Calibration',        icon: '📐',  accent: 'border-sky-300'    },
};

const GROUPS: { key: string; label: string; types: string[] }[] = [
    { key: 'tasks',    label: 'Tasks',    types: ['split_task', 'reduce_tasks', 'avoidance_pattern'] },
    { key: 'habits',   label: 'Habits',   types: ['habit_recovery'] },
    { key: 'projects', label: 'Projects', types: ['overdue_milestone', 'block_pattern', 'calibration'] },
];

export default function SuggestionsPage()
{
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading]         = useState(true);

    useEffect(() => {
        getSuggestions().then(s => { setSuggestions(s); setLoading(false); });
    }, []);

    const grouped = GROUPS.map(g => ({
        ...g,
        items: suggestions.filter(s => g.types.includes(s.type)),
    })).filter(g => g.items.length > 0);

    const ungrouped = suggestions.filter(
        s => !GROUPS.flatMap(g => g.types).includes(s.type)
    );

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-lg"
                >
                    ←
                </button>
                <div>
                    <h1 className="text-3xl font-light text-stone-800">Insights</h1>
                    <p className="text-sm text-stone-400 mt-0.5">Patterns and suggestions based on your data</p>
                </div>
            </div>

            {!loading && suggestions.length === 0 && (
                <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-semibold text-slate-700">All looking good</p>
                        <p className="text-stone-400 text-sm mt-1">No suggestions right now — keep up the steady pace.</p>
                    </div>
                </div>
            )}

            {grouped.map(group => (
                <div key={group.key}>
                    <div className="mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{group.label}</span>
                    </div>
                    <div className="space-y-2">
                        {group.items.map((s, i) => (
                            <SuggestionCard key={i} suggestion={s} />
                        ))}
                    </div>
                </div>
            ))}

            {ungrouped.length > 0 && (
                <div className="space-y-2">
                    {ungrouped.map((s, i) => <SuggestionCard key={i} suggestion={s} />)}
                </div>
            )}
        </div>
    );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion })
{
    const meta = TYPE_META[suggestion.type] ?? { label: suggestion.type, icon: '💡', accent: 'border-stone-200' };

    return (
        <div className={`bg-white rounded-2xl border-l-4 border border-stone-100 shadow-sm px-5 py-4 ${meta.accent}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base leading-none">{meta.icon}</span>
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{meta.label}</span>
            </div>
            <p className="text-sm text-stone-700 leading-relaxed">{suggestion.message}</p>
        </div>
    );
}
