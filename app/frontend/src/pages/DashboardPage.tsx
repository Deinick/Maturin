import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Task, Habit, Project, Suggestion } from '../types';
import {
    getTasks, getHabits, getProductivity, getSuggestions,
    getWeeklySummary, getAllPendingChangeCounts, getProjects,
    updateTask, rolloverTask, logHabit, updateHabitLog,
} from '../api/client';

const TODAY     = new Date().toISOString().split('T')[0];
const HOUR      = new Date().getHours();
const GREETING  = HOUR < 12 ? 'Good morning' : HOUR < 17 ? 'Good afternoon' : 'Good evening';
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
    const [suggestions,    setSuggestions]    = useState<Suggestion[]>([]);
    const [weekly,         setWeekly]         = useState<WeeklySummary | null>(null);
    const [projects,       setProjects]       = useState<Project[]>([]);
    const [pendingReviews, setPendingReviews] = useState<{ projectId: string; projectTitle: string; count: number }[]>([]);
    const [loggingHabits,  setLoggingHabits]  = useState<Set<string>>(new Set());

    useEffect(() => {
        Promise.all([
            getTasks(TODAY),
            getHabits(),
            getProductivity(),
            getSuggestions(),
            getWeeklySummary(),
            getProjects(),
        ]).then(([t, h, s, sg, w, p]) => {
            setTasks(t);
            setHabits(h);
            setStats(s as Stats);
            setSuggestions(sg);
            setWeekly(w);
            setProjects(p as Project[]);
        });
        getAllPendingChangeCounts().then(setPendingReviews).catch(() => {});
    }, []);

    const active         = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);
    const todayLogs      = habits.map(h => h.logs.find(l => l.date === TODAY));
    const loggedToday    = todayLogs.filter(l => l?.status === 'completed').length;
    const topTask        = [...active].sort((a, b) => b.priority - a.priority)[0];
    const activeProjects = projects.filter(p => !p.completed).slice(0, 4);

    const dailyTotal = tasks.length + habits.length;
    const dailyDone  = completedTasks.length + loggedToday;
    const dailyPct   = dailyTotal === 0 ? 0 : Math.round(dailyDone / dailyTotal * 100);

    const weeklyPct = weekly
        ? Math.round(weekly.completed / Math.max(1, weekly.totalLogged) * 100)
        : stats
        ? Math.round(stats.productivity * 100)
        : null;

    const firstName = user?.name?.split(' ')[0] ?? '';

    // Habit bar chart data: last 7 days, percentage of habits done per day
    const habitDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const logsForDay = habits.flatMap(h => h.logs.filter(l => l.date === dateStr && l.status === 'completed'));
        return habits.length === 0 ? 0 : Math.round(logsForDay.length / habits.length * 100);
    });

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
                            ? `You have ${habits.length - loggedToday} habit${habits.length - loggedToday !== 1 ? 's' : ''} remaining today.`
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

            {/* ── Main grid: Habits + Projects ─────────────────── */}
            <div className="grid grid-cols-12 gap-5">

                {/* Daily Habits — interactive checklist (Reference 1 style) */}
                <div className="col-span-12 md:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden group">
                    {/* Decorative blur circle */}
                    <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-100 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none" />

                    <div className="flex items-center justify-between mb-5 relative z-10">
                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                            </svg>
                            Daily Habits
                        </h3>
                        <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                            {loggedToday}/{habits.length}
                        </span>
                    </div>

                    {habits.length === 0 ? (
                        <div className="py-6 text-center relative z-10">
                            <p className="text-slate-400 text-sm">No habits set up yet</p>
                            <button onClick={() => navigate('/habits')}
                                className="mt-2 text-xs text-emerald-600 hover:underline">
                                Add your first habit →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 relative z-10">
                            {habits.slice(0, 7).map(h => {
                                const log      = h.logs.find(l => l.date === TODAY);
                                const done     = log?.status === 'done';
                                const loading  = loggingHabits.has(h.id);

                                return (
                                    <button
                                        key={h.id}
                                        onClick={() => handleLogHabit(h)}
                                        disabled={loading}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all text-left ${
                                            done
                                                ? 'bg-slate-50 border border-slate-100'
                                                : 'bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm'
                                        } ${loading ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                done
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : 'border-2 border-slate-200 text-slate-400'
                                            }`}>
                                                {done ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                ) : loading ? (
                                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                )}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                    {h.name}
                                                </p>
                                                <p className="text-xs text-slate-400 capitalize">{h.difficulty}</p>
                                            </div>
                                        </div>
                                        {done && (
                                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                                                Done
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {habits.length > 7 && (
                                <p className="text-xs text-slate-400 text-center pt-1">+{habits.length - 7} more</p>
                            )}
                        </div>
                    )}

                    {/* Progress bar */}
                    {habits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-50 relative z-10">
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

                    <button
                        onClick={() => navigate('/habits')}
                        className="w-full mt-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors relative z-10"
                    >
                        + Manage Habits
                    </button>
                </div>

                {/* Active Projects — Team Objectives style (Reference 1) */}
                <div className="col-span-12 md:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
                    {/* Top gradient accent bar */}
                    <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-slate-900 via-emerald-400 to-slate-900 rounded-b opacity-25 pointer-events-none" />

                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900">Active Projects</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Your in-progress work</p>
                        </div>
                        <button onClick={() => navigate('/projects')}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
                            View all →
                        </button>
                    </div>

                    {activeProjects.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-slate-400 text-sm">No active projects</p>
                            <button onClick={() => navigate('/projects')}
                                className="mt-2 text-xs text-emerald-600 hover:underline">
                                Start your first project →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeProjects.map(p => {
                                const pct        = projectCompletion(p);
                                const milestones = p.phases.flatMap(ph => ph.milestones);
                                const daysLeft   = p.targetEndDate
                                    ? Math.ceil((new Date(p.targetEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                    : null;

                                return (
                                    <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                                        className="w-full text-left group">
                                        <div className="flex items-end justify-between mb-1.5">
                                            <div className="min-w-0 pr-4">
                                                <h4 className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors">
                                                    {p.title}
                                                </h4>
                                                {p.description && (
                                                    <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                                                )}
                                            </div>
                                            <span className="text-xl font-bold text-slate-900 shrink-0">{pct}%</span>
                                        </div>

                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                            <div className="h-full bg-slate-900 rounded-full transition-all duration-500 group-hover:bg-emerald-600"
                                                style={{ width: `${pct}%` }} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {/* Member avatars */}
                                                {p.members && p.members.length > 0 ? (
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
                                                ) : null}
                                                <span className="text-xs text-slate-400">
                                                    {milestones.filter(m => m.completed).length}/{milestones.length} milestones
                                                </span>
                                            </div>
                                            {daysLeft !== null && (
                                                <span className={`text-xs flex items-center gap-1 ${
                                                    daysLeft < 0 ? 'text-red-500 font-medium' :
                                                    daysLeft <= 7 ? 'text-amber-500 font-medium' :
                                                    'text-slate-400'
                                                }`}>
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                    </svg>
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

            {/* ── Secondary grid: Steady Pace + Momentum + Focus ── */}
            <div className="grid grid-cols-3 gap-5">

                {/* Steady Pace — dark card (Reference 2 style) */}
                <div className="rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-between"
                    style={{ background: 'linear-gradient(135deg, #14532d 0%, #1a3a2f 100%)' }}>
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600 rounded-full blur-3xl opacity-20 translate-x-1/3 -translate-y-1/3 pointer-events-none" />

                    <div className="relative z-10">
                        <p className="text-xs font-semibold text-emerald-300/70 uppercase tracking-widest mb-4">Steady Pace</p>
                        {weeklyPct !== null ? (
                            <>
                                <p className="text-4xl font-light text-white leading-none mb-1">{weeklyPct}%</p>
                                <p className="text-emerald-200/70 text-xs uppercase tracking-widest mb-3">Weekly Goal</p>
                                <p className="text-emerald-100/80 text-sm leading-relaxed">
                                    {weeklyPct >= 80
                                        ? "You're on a strong streak — keep the momentum."
                                        : weeklyPct >= 50
                                        ? "You've maintained a consistent rhythm. Keep it up."
                                        : "The steady pace is what matters — keep going."}
                                </p>
                            </>
                        ) : (
                            <p className="text-emerald-200 text-sm">Start tracking to see your pace.</p>
                        )}
                    </div>

                    {/* Mini bar chart (7-day habit completion) */}
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

                {/* Daily Momentum ring */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Daily Momentum</p>
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
                            <Ring value={dailyPct} size={80} stroke={7} color="#0ea5e9" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-base font-bold text-slate-800">{dailyPct}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">{dailyDone} of {dailyTotal} done</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''} · {loggedToday} habit{loggedToday !== 1 ? 's' : ''}
                            </p>
                            {dailyPct === 100 && dailyTotal > 0 && (
                                <p className="text-xs text-emerald-600 font-medium mt-1">All done today! 🎉</p>
                            )}
                        </div>
                    </div>

                    {weekly && weekly.totalLogged > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-50">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {weekly.completed} of <span className="font-medium">{weekly.totalLogged}</span> tasks this week
                                {weekly.rolledOver > 0 && <>, <span className="text-amber-500">{weekly.rolledOver} rolled over</span></>}
                            </p>
                            {weekly.categoryStats.filter(c => c.total > 0).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
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
                    )}
                </div>

                {/* Focus for Today */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Focus for Today</p>
                        {active.length > 0 && (
                            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                {active.length} remaining
                            </span>
                        )}
                    </div>

                    {topTask ? (
                        <>
                            <h3 className="text-base font-semibold text-slate-900 mb-2 leading-snug">{topTask.text}</h3>
                            <div className="flex items-center flex-wrap gap-1.5 mb-4">
                                {topTask.category && (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{topTask.category}</span>
                                )}
                                {topTask.timeEstimate && (
                                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full capitalize">{topTask.timeEstimate}</span>
                                )}
                                {topTask.priority >= 3 && (
                                    <span className="text-xs text-amber-600 font-medium">★ High</span>
                                )}
                                {topTask.rolloverCount > 0 && (
                                    <span className="text-xs text-rose-500">↩ {topTask.rolloverCount}×</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDefer(topTask)}
                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                                    Defer
                                </button>
                                <button onClick={() => handleComplete(topTask)}
                                    className="flex-1 px-3 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors">
                                    Complete
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="py-4 text-center">
                            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </div>
                            <p className="text-slate-600 text-sm font-medium">All clear!</p>
                            <p className="text-slate-400 text-xs mt-0.5">
                                {completedTasks.length > 0 ? `${completedTasks.length} completed today` : 'No tasks yet'}
                            </p>
                            <button onClick={() => navigate('/tasks')}
                                className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                Add tasks →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Insights strip ─────────────────────────────────── */}
            {suggestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Insights</h3>
                        <button onClick={() => navigate('/suggestions')}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors">View all →</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {suggestions.slice(0, 2).map((s, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-4">
                                <p className="text-sm text-slate-700 leading-relaxed">{s.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
