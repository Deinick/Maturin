import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import backgroundVideo from '../background/background.mp4';
import type { Task, Habit, Project } from '../types';
import {
    getTasks, getHabits, getProductivity, getWeeklySummary,
    getAllPendingChangeCounts, getProjects,
    updateTask, logHabit, updateHabitLog,
} from '../api/client';
import { ChevronRight } from '@/components/animate-ui/icons/chevron-right';
import { Check } from '@/components/animate-ui/icons/check';
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle';

const TODAY      = new Date().toISOString().split('T')[0];
const HOUR       = new Date().getHours();
const GREETING   = HOUR < 12 ? 'Good morning' : HOUR < 17 ? 'Good afternoon' : 'Good evening';
const DATE_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

interface Stats {
    taskScore: number; habitScore: number; productivity: number;
    totalTasks: number; completedTasks: number;
    totalHabitLogs: number; completedHabitLogs: number;
}

interface WeeklySummary {
    weekStart: string; weekEnd: string;
    totalLogged: number; completed: number; pending: number; rolledOver: number;
    bestDay: { date: string; completed: number; total: number } | null;
    categoryStats: { category: string; completed: number; total: number; rate: number }[];
}

function projectCompletion(project: Project): number {
    const all = project.phases.flatMap(p => p.milestones);
    if (!all.length) return 0;
    return Math.round(all.filter(m => m.completed).length / all.length * 100);
}

const MEMBER_COLORS = ['#008671','#00864D','#488427','#777E00','#A07200','#C4601A','#C24650','#A14574','#6F4D81','#414F74','#2F4858'];
function memberColor(name: string): string {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
    return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

function Ring({ value, size = 80, stroke = 7, color }: { value: number; size?: number; stroke?: number; color: string }) {
    const r    = (size - stroke * 2) / 2;
    const circ = 2 * Math.PI * r;
    const pct  = Math.max(0, Math.min(100, value));
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-mid)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
                className="transition-all duration-700" />
        </svg>
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user }  = useAuth();
    const queryClient = useQueryClient();

    const tasksKey = ['tasks', TODAY];
    const habitsKey = ['habits'];

    const { data: tasks = [] }    = useQuery({ queryKey: tasksKey, queryFn: () => getTasks(TODAY) });
    const { data: habits = [] }   = useQuery({ queryKey: habitsKey, queryFn: getHabits });
    const { data: stats = null }  = useQuery<Stats>({ queryKey: ['productivity'], queryFn: getProductivity as () => Promise<Stats> });
    const { data: weekly = null } = useQuery<WeeklySummary>({ queryKey: ['weeklySummary'], queryFn: getWeeklySummary });
    const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
    const { data: pendingReviews = [] } = useQuery({ queryKey: ['pendingChangeCounts'], queryFn: getAllPendingChangeCounts });

    const [loggingHabits,  setLoggingHabits]  = useState<Set<string>>(new Set());

    const activeTasks     = tasks.filter(t => !t.completed);
    const completedTasks  = tasks.filter(t => t.completed);
    const todayLogs       = habits.map(h => h.logs.find(l => l.date === TODAY));
    const loggedToday     = todayLogs.filter(l => l?.status === 'completed').length;
    const activeProjects  = projects.filter(p => !p.completed).slice(0, 4);

    const taskPct = tasks.length === 0 ? 0 : Math.round(completedTasks.length / tasks.length * 100);

    const weeklyPct = weekly
        ? Math.round(weekly.completed / Math.max(1, weekly.totalLogged) * 100)
        : stats
        ? Math.round(stats.productivity * 100)
        : null;

    // 7-day habit completion bars
    const habitDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const logsForDay = habits.flatMap(h => h.logs.filter(l => l.date === dateStr && l.status === 'completed'));
        return habits.length === 0 ? 0 : Math.round(logsForDay.length / habits.length * 100);
    });

    const firstName = user?.name?.split(' ')[0] ?? '';

    async function handleComplete(task: Task) {
        await updateTask(task.id, { completed: true });
        queryClient.setQueryData<Task[]>(tasksKey, prev => prev?.map(t => t.id === task.id ? { ...t, completed: true } : t));
    }

    async function handleLogHabit(habit: Habit) {
        if (loggingHabits.has(habit.id)) return;
        setLoggingHabits(prev => new Set([...prev, habit.id]));
        try {
            const existingLog = habit.logs.find(l => l.date === TODAY);
            if (existingLog) {
                const newStatus = existingLog.status === 'completed' ? 'skipped' : 'completed';
                await updateHabitLog(existingLog.id, newStatus);
                queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.map(h => h.id === habit.id
                    ? { ...h, logs: h.logs.map(l => l.id === existingLog.id ? { ...l, status: newStatus } : l) }
                    : h));
            } else {
                const newLog = await logHabit(habit.id, TODAY, 'completed');
                queryClient.setQueryData<Habit[]>(habitsKey, prev => prev?.map(h => h.id === habit.id
                    ? { ...h, logs: [...h.logs, newLog] }
                    : h));
            }
        } finally {
            setLoggingHabits(prev => { const next = new Set(prev); next.delete(habit.id); return next; });
        }
    }

    return (
        <div className="max-w-6xl space-y-5">

            {/* ── Hero ─────────────────────────────────────────── */}
            <div className="flex items-end justify-between mb-2">
                <div>
                    <p className="text-sm text-[#8A7265] mb-1">{DATE_LABEL}</p>
                    <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">
                        {GREETING}{firstName ? `, ${firstName}` : ''}.
                    </h1>
                    <p className="text-sm text-[#8A7265] mt-1">
                        {habits.length > 0
                            ? `${habits.length - loggedToday} habit${habits.length - loggedToday !== 1 ? 's' : ''} remaining today.`
                            : stats
                            ? `Monthly productivity: ${Math.round(stats.productivity * 100)}%`
                            : 'Here is a summary of your day.'}
                    </p>
                </div>
                {stats && (
                    <div className="hidden md:flex items-center gap-6 shrink-0">
                        <div className="text-right">
                            <p className="text-xs text-[#8A7265] uppercase tracking-wide">Tasks (30d)</p>
                            <p className="text-lg font-semibold text-[#2D1E1A]">{Math.round(stats.taskScore * 100)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-[#8A7265] uppercase tracking-wide">Habits (30d)</p>
                            <p className="text-lg font-semibold text-[#2D1E1A]">{Math.round(stats.habitScore * 100)}%</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Pending reviews banner ────────────────────────── */}
            {pendingReviews.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center shrink-0">!</span>
                        <span className="text-sm font-semibold text-amber-800">Needs Review</span>
                        <span className="text-xs text-amber-600">{pendingReviews.length} project{pendingReviews.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {pendingReviews.map(p => (
                            <button
                                key={p.projectId}
                                onClick={() => navigate(`/projects/${p.projectId}`)}
                                className="text-xs bg-white border border-amber-200 hover:border-amber-400 text-amber-800 px-3 py-1.5 rounded-lg transition-colors font-medium"
                            >
                                {p.projectTitle} · {p.count} change{p.count !== 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Row 1: Habits + Projects ──────────────────────── */}
            <div className="grid grid-cols-12 gap-5">

                {/* Habits */}
                <div className="col-span-12 md:col-span-4 bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/habits')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-[#E0CFC4] hover:bg-[#FFF5E9] transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-[#2D1E1A]">Habits</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A7265] bg-[#F0E9E0] px-2.5 py-1 rounded-full">
                                {loggedToday}/{habits.length} today
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#BBA79C] group-hover:text-[#8A7265] transition-colors" animateOnHover="default" />
                        </div>
                    </button>

                    <div className="p-5">
                        {habits.length === 0 ? (
                            <div className="py-6 text-center">
                                <p className="text-[#8A7265] text-sm">No habits set up yet</p>
                                <button onClick={() => navigate('/habits')}
                                    className="mt-2 text-xs text-[#4C8077] hover:underline">
                                    Add your first habit →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {habits.slice(0, 6).map(h => {
                                    const log     = h.logs.find(l => l.date === TODAY);
                                    const done    = log?.status === 'completed';
                                    const loading = loggingHabits.has(h.id);
                                    return (
                                        <button
                                            key={h.id}
                                            onClick={() => handleLogHabit(h)}
                                            disabled={loading}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left ${
                                                done
                                                    ? 'bg-[#FFF5E9] border border-[#E0CFC4]'
                                                    : 'bg-white border border-[#E0CFC4] hover:border-[#c8eadf] hover:shadow-sm'
                                            } ${loading ? 'opacity-60' : ''}`}
                                        >
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                                                style={done
                                                    ? { background: '#C4FCF0', color: '#4C8077' }
                                                    : { border: '2px solid var(--c-border)', color: 'var(--c-text-muted)' }
                                                }>
                                                {done ? (
                                                    <Check className="w-3.5 h-3.5" animateOnHover="default" />
                                                ) : loading ? (
                                                    <LoaderCircle className="w-3 h-3" animate="default" loop />
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-[#c1c8c4]" />
                                                )}
                                            </div>
                                            <p className={`text-sm flex-1 min-w-0 truncate ${done ? 'text-[#8A7265] line-through' : 'text-[#54433A]'}`}>
                                                {h.name}
                                            </p>
                                        </button>
                                    );
                                })}
                                {habits.length > 6 && (
                                    <p className="text-xs text-[#8A7265] text-center pt-1">+{habits.length - 6} more</p>
                                )}
                            </div>
                        )}

                        {habits.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-[#E0CFC4]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-[#8A7265]">Today's progress</span>
                                    <span className="text-xs font-medium text-[#54433A]">
                                        {Math.round(loggedToday / Math.max(1, habits.length) * 100)}%
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-mid)' }}>
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.round(loggedToday / Math.max(1, habits.length) * 100)}%`, background: 'var(--c-teal)' }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Projects */}
                <div className="col-span-12 md:col-span-8 bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/projects')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-[#E0CFC4] hover:bg-[#FFF5E9] transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-[#2D1E1A]">Projects</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A7265] bg-[#F0E9E0] px-2.5 py-1 rounded-full">
                                {activeProjects.length} active
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#BBA79C] group-hover:text-[#8A7265] transition-colors" animateOnHover="default" />
                        </div>
                    </button>

                    <div className="p-5">
                        {activeProjects.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-[#8A7265] text-sm">No active projects</p>
                                <button onClick={() => navigate('/projects')}
                                    className="mt-2 text-xs text-[#4C8077] hover:underline">
                                    Start your first project →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {activeProjects.map(p => {
                                    const pct        = projectCompletion(p);
                                    const milestones = p.phases.flatMap(ph => ph.milestones);
                                    const daysLeft   = p.targetEndDate
                                        ? Math.ceil((new Date(p.targetEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                        : null;
                                    return (
                                        <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                                            className="w-full text-left group/proj">
                                            <div className="flex items-end justify-between mb-1.5">
                                                <div className="min-w-0 pr-4">
                                                    <h4 className="text-sm font-semibold text-[#2D1E1A] group-hover/proj:text-[#2D1E1A] transition-colors truncate">
                                                        {p.title}
                                                    </h4>
                                                    {p.description && (
                                                        <p className="text-xs text-[#8A7265] mt-0.5 truncate">{p.description}</p>
                                                    )}
                                                </div>
                                                <span className="text-xl font-bold text-[#2D1E1A] shrink-0">{pct}%</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--c-surface-mid)' }}>
                                                <div className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, background: 'var(--c-primary)' }} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {p.members && p.members.length > 0 && (
                                                        <div className="flex -space-x-1.5">
                                                            {p.members.slice(0, 3).map(m => (
                                                                <div key={m.id} title={m.user.name}
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold border-2 border-white shrink-0"
                                                                    style={{ background: memberColor(m.user.name) }}>
                                                                    {m.user.name[0]?.toUpperCase()}
                                                                </div>
                                                            ))}
                                                            {p.members.length > 3 && (
                                                                <div className="w-5 h-5 rounded-full bg-[#E0CFC4] flex items-center justify-center text-[8px] font-bold text-[#54433A] border-2 border-white">
                                                                    +{p.members.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-[#8A7265]">
                                                        {milestones.filter(m => m.completed).length}/{milestones.length} objectives
                                                    </span>
                                                </div>
                                                {daysLeft !== null && (
                                                    <span className={`text-xs ${
                                                        daysLeft < 0 ? 'text-[#ba1a1a] font-medium' :
                                                        daysLeft <= 7 ? 'text-amber-500 font-medium' :
                                                        'text-[#8A7265]'
                                                    }`}>
                                                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `Due ${p.targetEndDate}`}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Row 2: Weekly Progress + Tasks ───────────────── */}
            <div className="grid grid-cols-12 gap-5">

                {/* Weekly Progress — liquid glass */}
                <div className="col-span-12 md:col-span-5 rounded-2xl relative overflow-hidden flex flex-col justify-between"
                    style={{ minHeight: 220 }}>

                    {/* Video background */}
                    <video
                        className="absolute inset-0 w-full h-full object-cover"
                        src={backgroundVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                    />

                    {/* Dark overlay to improve text legibility */}
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />

                    {/* Glass panel */}
                    <div className="relative z-10 h-full flex flex-col justify-between p-6"
                        style={{
                            background: 'rgba(255,255,255,0.10)',
                            backdropFilter: 'blur(18px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                            borderRadius: 'inherit',
                            border: '1px solid rgba(255,255,255,0.25)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.05)',
                        }}>

                        <div>
                            <p className="text-[10px] font-semibold text-white/90 uppercase tracking-widest mb-4" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Weekly Progress</p>
                            {weeklyPct !== null ? (
                                <>
                                    <p className="text-5xl font-thin text-white leading-none mb-1.5" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>{weeklyPct}%</p>
                                    <p className="text-white/90 text-xs uppercase tracking-widest" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>of tasks completed this week</p>
                                    {weekly && weekly.rolledOver > 0 && (
                                        <p className="text-amber-200 text-xs mt-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{weekly.rolledOver} task{weekly.rolledOver !== 1 ? 's' : ''} rolled over</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-white text-sm" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Start tracking to see your progress.</p>
                            )}
                        </div>

                        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}>
                            <p className="text-[10px] text-white/80 uppercase tracking-widest mb-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Habit completion — last 7 days</p>
                            <div className="flex items-end gap-1 h-8">
                                {habitDays.map((pct, i) => (
                                    <div key={i} className="flex-1 rounded-sm relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                        <div className="absolute bottom-0 w-full rounded-sm transition-all duration-500"
                                            style={{ height: `${pct}%`, background: 'rgba(255,255,255,0.75)' }} />
                                    </div>
                                ))}
                            </div>
                            {weekly?.bestDay && (
                                <p className="text-white/70 text-[10px] mt-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                    Best this week: {new Date(weekly.bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })} · {weekly.bestDay.completed}/{weekly.bestDay.total}
                                </p>
                            )}
                        </div>
                    </div>

                </div>

                {/* Tasks */}
                <div className="col-span-12 md:col-span-7 bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/tasks')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-[#E0CFC4] hover:bg-[#FFF5E9] transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-[#2D1E1A]">Tasks</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8A7265] bg-[#F0E9E0] px-2.5 py-1 rounded-full">
                                {activeTasks.length} remaining
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#BBA79C] group-hover:text-[#8A7265] transition-colors" animateOnHover="default" />
                        </div>
                    </button>

                    <div className="p-5">
                        <div className="flex items-center gap-5 mb-5">
                            <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
                                <Ring value={taskPct} size={72} stroke={6} color="#C4601A" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-[#2D1E1A]">{taskPct}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-[#54433A]">
                                    {completedTasks.length} of {tasks.length} completed today
                                </p>
                                <p className="text-xs text-[#8A7265] mt-0.5">
                                    {activeTasks.length} remaining
                                </p>
                                {taskPct === 100 && tasks.length > 0 && (
                                    <p className="text-xs text-[#4C8077] font-medium mt-1">All tasks done today!</p>
                                )}
                            </div>
                        </div>

                        {activeTasks.length > 0 ? (
                            <div className="space-y-2">
                                {activeTasks.slice(0, 4).map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#E0CFC4] bg-white">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {task.priority >= 3 && (
                                                <span className="text-amber-400 text-xs shrink-0">★</span>
                                            )}
                                            <p className="text-sm text-[#54433A] truncate">{task.text}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {task.timeEstimate && (
                                                <span className="text-xs text-[#8A7265] capitalize">{task.timeEstimate}</span>
                                            )}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleComplete(task)}
                                                    className="px-2 py-1 rounded-lg bg-[#C4601A] text-[10px] text-white hover:bg-[#A84E14] transition-colors"
                                                >Done</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {activeTasks.length > 4 && (
                                    <button onClick={() => navigate('/tasks')}
                                        className="w-full py-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors">
                                        +{activeTasks.length - 4} more · View all →
                                    </button>
                                )}
                            </div>
                        ) : tasks.length > 0 ? (
                            <div className="py-4 text-center">
                                <p className="text-[#54433A] text-sm font-medium">All tasks done today!</p>
                                <p className="text-xs text-[#8A7265] mt-0.5">{completedTasks.length} completed</p>
                            </div>
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-[#8A7265] text-sm">No tasks for today</p>
                                <button onClick={() => navigate('/tasks')}
                                    className="mt-2 text-xs text-[#8A7265] hover:text-[#54433A] transition-colors">
                                    Add tasks →
                                </button>
                            </div>
                        )}

                        {weekly && weekly.categoryStats.filter(c => c.total > 0).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-[#E0CFC4] flex flex-wrap gap-1.5">
                                {weekly.categoryStats.filter(c => c.total > 0).slice(0, 3).map(c => (
                                    <span key={c.category}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                                            c.rate >= 0.7 ? 'bg-[#c8eadf] text-[#16342d]'
                                            : c.rate >= 0.4 ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-[#93000a]'
                                        }`}>
                                        {c.category} {Math.round(c.rate * 100)}%
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
