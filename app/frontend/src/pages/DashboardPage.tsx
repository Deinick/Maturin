import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Task, Habit, Project } from '../types';
import {
    getTasks, getHabits, getProductivity, getWeeklySummary,
    getAllPendingChangeCounts, getProjects,
    updateTask, rolloverTask, logHabit, updateHabitLog,
} from '../api/client';

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

const MEMBER_COLORS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500',
];
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
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
                className="transition-all duration-700" />
        </svg>
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user }  = useAuth();

    const [tasks,          setTasks]          = useState<Task[]>([]);
    const [habits,         setHabits]         = useState<Habit[]>([]);
    const [stats,          setStats]          = useState<Stats | null>(null);
    const [weekly,         setWeekly]         = useState<WeeklySummary | null>(null);
    const [projects,       setProjects]       = useState<Project[]>([]);
    const [pendingReviews, setPendingReviews] = useState<{ projectId: string; projectTitle: string; count: number }[]>([]);
    const [loggingHabits,  setLoggingHabits]  = useState<Set<string>>(new Set());

    useEffect(() => {
        Promise.all([
            getTasks(TODAY),
            getHabits(),
            getProductivity(),
            getWeeklySummary(),
            getProjects(),
        ]).then(([t, h, s, w, p]) => {
            setTasks(t);
            setHabits(h);
            setStats(s as Stats);
            setWeekly(w);
            setProjects(p as Project[]);
        });
        getAllPendingChangeCounts().then(setPendingReviews).catch(() => {});
    }, []);

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
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t));
    }

    async function handleDefer(task: Task) {
        await rolloverTask(task.id);
        setTasks(prev => prev.filter(t => t.id !== task.id));
    }

    async function handleLogHabit(habit: Habit) {
        if (loggingHabits.has(habit.id)) return;
        setLoggingHabits(prev => new Set([...prev, habit.id]));
        try {
            const existingLog = habit.logs.find(l => l.date === TODAY);
            if (existingLog) {
                const newStatus = existingLog.status === 'completed' ? 'skipped' : 'completed';
                await updateHabitLog(existingLog.id, newStatus);
                setHabits(prev => prev.map(h => h.id === habit.id
                    ? { ...h, logs: h.logs.map(l => l.id === existingLog.id ? { ...l, status: newStatus } : l) }
                    : h));
            } else {
                const newLog = await logHabit(habit.id, TODAY, 'completed');
                setHabits(prev => prev.map(h => h.id === habit.id
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
                    <p className="text-sm text-slate-400 mb-1">{DATE_LABEL}</p>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        {GREETING}{firstName ? `, ${firstName}` : ''}.
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
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
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Tasks (30d)</p>
                            <p className="text-lg font-semibold text-slate-800">{Math.round(stats.taskScore * 100)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Habits (30d)</p>
                            <p className="text-lg font-semibold text-slate-800">{Math.round(stats.habitScore * 100)}%</p>
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
                <div className="col-span-12 md:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/habits')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-slate-900">Habits</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                                {loggedToday}/{habits.length} today
                            </span>
                            <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <div className="p-5">
                        {habits.length === 0 ? (
                            <div className="py-6 text-center">
                                <p className="text-slate-400 text-sm">No habits set up yet</p>
                                <button onClick={() => navigate('/habits')}
                                    className="mt-2 text-xs text-emerald-600 hover:underline">
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
                                                    ? 'bg-slate-50 border border-slate-100'
                                                    : 'bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm'
                                            } ${loading ? 'opacity-60' : ''}`}
                                        >
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                done ? 'bg-emerald-100 text-emerald-600' : 'border-2 border-slate-200 text-slate-400'
                                            }`}>
                                                {done ? (
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                ) : loading ? (
                                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                )}
                                            </div>
                                            <p className={`text-sm flex-1 min-w-0 truncate ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                {h.name}
                                            </p>
                                        </button>
                                    );
                                })}
                                {habits.length > 6 && (
                                    <p className="text-xs text-slate-400 text-center pt-1">+{habits.length - 6} more</p>
                                )}
                            </div>
                        )}

                        {habits.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-slate-400">Today's progress</span>
                                    <span className="text-xs font-medium text-slate-600">
                                        {Math.round(loggedToday / Math.max(1, habits.length) * 100)}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.round(loggedToday / Math.max(1, habits.length) * 100)}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Projects */}
                <div className="col-span-12 md:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/projects')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                                {activeProjects.length} active
                            </span>
                            <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <div className="p-5">
                        {activeProjects.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-slate-400 text-sm">No active projects</p>
                                <button onClick={() => navigate('/projects')}
                                    className="mt-2 text-xs text-emerald-600 hover:underline">
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
                                                    <h4 className="text-sm font-semibold text-slate-800 group-hover/proj:text-slate-900 transition-colors truncate">
                                                        {p.title}
                                                    </h4>
                                                    {p.description && (
                                                        <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                                                    )}
                                                </div>
                                                <span className="text-xl font-bold text-slate-900 shrink-0">{pct}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                                                <div className="h-full bg-slate-900 rounded-full transition-all duration-500 group-hover/proj:bg-emerald-600"
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {p.members && p.members.length > 0 && (
                                                        <div className="flex -space-x-1.5">
                                                            {p.members.slice(0, 3).map(m => (
                                                                <div key={m.id} title={m.user.name}
                                                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold border-2 border-white shrink-0 ${memberColor(m.user.name)}`}>
                                                                    {m.user.name[0]?.toUpperCase()}
                                                                </div>
                                                            ))}
                                                            {p.members.length > 3 && (
                                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 border-2 border-white">
                                                                    +{p.members.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="text-xs text-slate-400">
                                                        {milestones.filter(m => m.completed).length}/{milestones.length} objectives
                                                    </span>
                                                </div>
                                                {daysLeft !== null && (
                                                    <span className={`text-xs ${
                                                        daysLeft < 0 ? 'text-red-500 font-medium' :
                                                        daysLeft <= 7 ? 'text-amber-500 font-medium' :
                                                        'text-slate-400'
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

                {/* Weekly Progress */}
                <div className="col-span-12 md:col-span-5 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-between"
                    style={{ background: 'linear-gradient(135deg, #14532d 0%, #1a3a2f 100%)' }}>
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600 rounded-full blur-3xl opacity-20 translate-x-1/3 -translate-y-1/3 pointer-events-none" />

                    <div className="relative z-10">
                        <p className="text-xs font-semibold text-emerald-300/70 uppercase tracking-widest mb-4">Weekly Progress</p>
                        {weeklyPct !== null ? (
                            <>
                                <p className="text-4xl font-light text-white leading-none mb-1">{weeklyPct}%</p>
                                <p className="text-emerald-200/70 text-xs uppercase tracking-widest">of tasks completed this week</p>
                                {weekly && weekly.rolledOver > 0 && (
                                    <p className="text-amber-300/80 text-xs mt-2">{weekly.rolledOver} task{weekly.rolledOver !== 1 ? 's' : ''} rolled over</p>
                                )}
                            </>
                        ) : (
                            <p className="text-emerald-200 text-sm">Start tracking to see your progress.</p>
                        )}
                    </div>

                    <div className="relative z-10 mt-5 pt-4 border-t border-white/10">
                        <p className="text-[10px] text-emerald-300/50 uppercase tracking-widest mb-2">Habit completion — last 7 days</p>
                        <div className="flex items-end gap-1 h-8">
                            {habitDays.map((pct, i) => (
                                <div key={i} className="flex-1 bg-white/10 rounded-sm relative overflow-hidden">
                                    <div className="absolute bottom-0 w-full bg-emerald-300 rounded-sm transition-all duration-500"
                                        style={{ height: `${pct}%` }} />
                                </div>
                            ))}
                        </div>
                        {weekly?.bestDay && (
                            <p className="text-emerald-300/50 text-[10px] mt-2">
                                Best this week: {new Date(weekly.bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })} · {weekly.bestDay.completed}/{weekly.bestDay.total}
                            </p>
                        )}
                    </div>
                </div>

                {/* Tasks */}
                <div className="col-span-12 md:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => navigate('/tasks')}
                        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group text-left"
                    >
                        <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                                {activeTasks.length} remaining
                            </span>
                            <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <div className="p-5">
                        <div className="flex items-center gap-5 mb-5">
                            <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
                                <Ring value={taskPct} size={72} stroke={6} color="#0ea5e9" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-slate-800">{taskPct}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    {completedTasks.length} of {tasks.length} completed today
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {activeTasks.length} remaining
                                </p>
                                {taskPct === 100 && tasks.length > 0 && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1">All tasks done today!</p>
                                )}
                            </div>
                        </div>

                        {activeTasks.length > 0 ? (
                            <div className="space-y-2">
                                {activeTasks.slice(0, 4).map(task => (
                                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {task.priority >= 3 && (
                                                <span className="text-amber-400 text-xs shrink-0">★</span>
                                            )}
                                            <p className="text-sm text-slate-700 truncate">{task.text}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {task.timeEstimate && (
                                                <span className="text-xs text-slate-400 capitalize">{task.timeEstimate}</span>
                                            )}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleDefer(task)}
                                                    className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors"
                                                    title="Defer to tomorrow"
                                                >↩</button>
                                                <button
                                                    onClick={() => handleComplete(task)}
                                                    className="px-2 py-1 rounded-lg bg-slate-900 text-[10px] text-white hover:bg-slate-700 transition-colors"
                                                >Done</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {activeTasks.length > 4 && (
                                    <button onClick={() => navigate('/tasks')}
                                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                        +{activeTasks.length - 4} more · View all →
                                    </button>
                                )}
                            </div>
                        ) : tasks.length > 0 ? (
                            <div className="py-4 text-center">
                                <p className="text-slate-600 text-sm font-medium">All tasks done today!</p>
                                <p className="text-xs text-slate-400 mt-0.5">{completedTasks.length} completed</p>
                            </div>
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-slate-400 text-sm">No tasks for today</p>
                                <button onClick={() => navigate('/tasks')}
                                    className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                    Add tasks →
                                </button>
                            </div>
                        )}

                        {weekly && weekly.categoryStats.filter(c => c.total > 0).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
                                {weekly.categoryStats.filter(c => c.total > 0).slice(0, 3).map(c => (
                                    <span key={c.category}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                                            c.rate >= 0.7 ? 'bg-emerald-100 text-emerald-700'
                                            : c.rate >= 0.4 ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-red-700'
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
