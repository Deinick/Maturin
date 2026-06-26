import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Suggestion } from '../types';
import { getSuggestions } from '../api/client';
import thinkingTurtle from '../assets/Turtles/0609 (1)(1).png';

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
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
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
                    <img src={thinkingTurtle} alt="Thinking turtle" className="turtle-img w-40 h-40 object-contain opacity-80" />
                    <div className="text-center">
                        <p className="serif text-xl font-semibold text-stone-700">All looking good</p>
                        <p className="text-stone-400 text-sm mt-1">No suggestions right now — keep up the steady pace.</p>
                    </div>
                </div>
            )}

            {grouped.map(group => (
                <div key={group.key}>
                    <div className="mb-3">
                        <span className="label-tape label-tape-red">{group.label}</span>
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
