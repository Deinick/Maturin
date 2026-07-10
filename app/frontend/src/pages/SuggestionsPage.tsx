import { useQuery } from '@tanstack/react-query';
import type { Suggestion } from '../types';
import { getSuggestions } from '../api/client';
import { Lightbulb } from '@/components/animate-ui/icons/lightbulb';
import { Scissors } from '@/components/animate-ui/icons/scissors';
import { ChartNoAxesColumnDecreasing } from '@/components/animate-ui/icons/chart-no-axes-column-decreasing';
import { RefreshCw } from '@/components/animate-ui/icons/refresh-cw';
import { AlarmClock } from '@/components/animate-ui/icons/alarm-clock';
import { Lock } from '@/components/animate-ui/icons/lock';
import { SlidersHorizontal } from '@/components/animate-ui/icons/sliders-horizontal';
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle';
import type { ElementType } from 'react';

const TYPE_META: Record<string, { label: string; Icon: ElementType; accent: string }> = {
    split_task:       { label: 'Split task',        Icon: Scissors,                     accent: 'border-rose-300'   },
    reduce_tasks:     { label: 'Reduce load',        Icon: ChartNoAxesColumnDecreasing,  accent: 'border-rose-300'   },
    avoidance_pattern:{ label: 'Avoidance pattern',  Icon: Lock,                         accent: 'border-amber-300'  },
    habit_recovery:   { label: 'Habit recovery',     Icon: RefreshCw,                    accent: 'border-emerald-300'},
    overdue_milestone:{ label: 'Overdue milestone',  Icon: AlarmClock,                   accent: 'border-amber-300'  },
    block_pattern:    { label: 'Blocked',            Icon: Lock,                         accent: 'border-amber-300'  },
    calibration:      { label: 'Calibration',        Icon: SlidersHorizontal,            accent: 'border-sky-300'    },
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
                    <LoaderCircle className="w-6 h-6 text-[#8A7265]" animate="default" loop />
                </div>
            )}

            {!loading && suggestions.length === 0 && (
                <div className="flex flex-col items-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#F0E9E0] flex items-center justify-center">
                        <Lightbulb className="w-7 h-7 text-[#BBA79C]" animateOnHover="default" />
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
    const meta = TYPE_META[suggestion.type] ?? { label: suggestion.type, Icon: Lightbulb, accent: 'border-[#E0CFC4]' };
    const Icon = meta.Icon;

    return (
        <div className={`bg-white rounded-2xl border-l-4 border border-[#E0CFC4] shadow-sm px-5 py-4 ${meta.accent}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 text-[#8A7265]" animateOnHover="default" />
                <span className="text-xs font-semibold text-[#8A7265] uppercase tracking-wide">{meta.label}</span>
            </div>
            <p className="text-sm text-[#54433A] leading-relaxed">{suggestion.message}</p>
        </div>
    );
}
