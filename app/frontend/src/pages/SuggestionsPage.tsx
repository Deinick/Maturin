import { useQuery } from '@tanstack/react-query';
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
    const { data: suggestions = [], isLoading: loading } = useQuery({ queryKey: ['suggestions'], queryFn: getSuggestions });

    const grouped = GROUPS.map(g => ({
        ...g,
        items: suggestions.filter(s => g.types.includes(s.type)),
    })).filter(g => g.items.length > 0);

    const ungrouped = suggestions.filter(
        s => !GROUPS.flatMap(g => g.types).includes(s.type)
    );

    const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="max-w-5xl space-y-6">

            {/* ── Page header ── */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-7">
                <div>
                    <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">Insights</h1>
                    <p className="text-sm text-[#8A7265] mt-0.5">{dateLabel}</p>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-6 h-6 border-2 border-[#E0CFC4] border-t-slate-400 rounded-full animate-spin" />
                </div>
            )}

            {!loading && suggestions.length === 0 && (
                <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#F0E9E0] flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#BBA79C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-semibold text-[#54433A]">All looking good</p>
                        <p className="text-[#8A7265] text-sm mt-1">No suggestions right now — keep up the steady pace.</p>
                    </div>
                </div>
            )}

            {grouped.map(group => (
                <div key={group.key}>
                    <div className="mb-3">
                        <span className="text-xs font-bold text-[#8A7265] uppercase tracking-widest">{group.label}</span>
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
    const meta = TYPE_META[suggestion.type] ?? { label: suggestion.type, icon: '💡', accent: 'border-[#E0CFC4]' };

    return (
        <div className={`bg-white rounded-2xl border-l-4 border border-[#E0CFC4] shadow-sm px-5 py-4 ${meta.accent}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base leading-none">{meta.icon}</span>
                <span className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">{meta.label}</span>
            </div>
            <p className="text-sm text-[#54433A] leading-relaxed">{suggestion.message}</p>
        </div>
    );
}
