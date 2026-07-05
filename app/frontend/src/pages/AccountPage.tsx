import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getYearlyStats, downloadExport } from '../api/client';
import { useSettings } from '../hooks/useSettings';
import type { Theme, WeekStart } from '../hooks/useSettings';

interface YearlyStats {
    year: number;
    tasksCompleted: number;
    habitsCompleted: number;
    projectsCompleted: number;
}

export default function AccountPage({ onLogout }: { onLogout: () => void }) {
    const navigate               = useNavigate();
    const { user }               = useAuth();
    const { settings, update }   = useSettings();
    const [stats, setStats]      = useState<YearlyStats | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => { getYearlyStats().then(setStats); }, []);

    async function handleExport() {
        setExporting(true);
        try { await downloadExport(); } finally { setExporting(false); }
    }

    function handleLogout() {
        onLogout();
        navigate('/login', { replace: true });
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
                >←</button>
                <div>
                    <h1 className="text-3xl font-light text-stone-800">Account</h1>
                    <p className="text-sm text-stone-400 mt-0.5">Your profile and preferences</p>
                </div>
            </div>

            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex items-center justify-between gap-5">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700 shrink-0">
                        {user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-stone-800">{user?.name}</p>
                        <p className="text-sm text-stone-400 mt-0.5">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm text-stone-400 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors font-medium shrink-0"
                >Sign out</button>
            </div>

            {/* Year in review */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-semibold text-stone-800">Year in Review</h2>
                        <p className="text-xs text-stone-400 mt-0.5">
                            {stats?.year ?? new Date().getFullYear()} — what you've accomplished
                        </p>
                    </div>
                    <span className="text-2xl">🏆</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <StatCard value={stats?.tasksCompleted    ?? '—'} label="Tasks completed"   color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard value={stats?.habitsCompleted   ?? '—'} label="Habits logged"     color="text-amber-600"  bg="bg-amber-50"  />
                    <StatCard value={stats?.projectsCompleted ?? '—'} label="Projects finished" color="text-blue-600"   bg="bg-blue-50"   />
                </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-50">
                    <h2 className="text-base font-semibold text-stone-800">Settings</h2>
                </div>
                <div className="divide-y divide-stone-50">

                    {/* Theme */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-stone-700">Theme</span>
                        <SegmentControl<Theme>
                            value={settings.theme}
                            options={[
                                { value: 'light',  label: 'Light'  },
                                { value: 'system', label: 'System' },
                            ]}
                            onChange={v => update('theme', v)}
                        />
                    </div>

                    {/* Start of week */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-stone-700">Start of week</span>
                        <SegmentControl<WeekStart>
                            value={settings.weekStart}
                            options={[
                                { value: 'monday', label: 'Mon' },
                                { value: 'sunday', label: 'Sun' },
                            ]}
                            onChange={v => update('weekStart', v)}
                        />
                    </div>

                    {/* Daily reminder */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <div>
                            <span className="text-sm text-stone-700">Daily reminder</span>
                            <p className="text-xs text-stone-400 mt-0.5">Push notifications — coming soon</p>
                        </div>
                        <span className="text-xs text-stone-300 bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg">Soon</span>
                    </div>

                    {/* Data export */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <div>
                            <span className="text-sm text-stone-700">Data export</span>
                            <p className="text-xs text-stone-400 mt-0.5">Download everything as JSON</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="text-sm text-stone-400 hover:text-emerald-600 transition-colors disabled:opacity-40"
                        >
                            {exporting ? 'Downloading…' : 'Download'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Support */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-50">
                    <h2 className="text-base font-semibold text-stone-800">Support</h2>
                </div>
                <div className="divide-y divide-stone-50">
                    <SupportRow
                        label="Send feedback"
                        icon="✉"
                        href={`mailto:${user?.email ? 'nikolaydeinego@gmail.com' : 'nikolaydeinego@gmail.com'}?subject=Steadily feedback`}
                    />
                    <SupportRow
                        label="Report a bug"
                        icon="🐛"
                        href="mailto:nikolaydeinego@gmail.com?subject=Steadily bug report"
                    />
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-stone-700 flex items-center gap-3">
                            <span className="text-base w-5 text-center">ℹ</span>
                            About Steadily
                        </span>
                        <span className="text-xs text-stone-400">v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ value, label, color, bg }: {
    value: number | string; label: string; color: string; bg: string;
}) {
    return (
        <div className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-light ${color}`}>{value}</p>
            <p className="text-xs text-stone-500 mt-1">{label}</p>
        </div>
    );
}

function SegmentControl<T extends string>({ value, options, onChange }: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        value === opt.value
                            ? 'bg-white text-stone-800 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function SupportRow({ label, icon, href }: { label: string; icon: string; href: string }) {
    return (
        <a
            href={href}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 transition-colors text-left"
        >
            <span className="text-sm text-stone-700 flex items-center gap-3">
                <span className="text-base w-5 text-center">{icon}</span>
                {label}
            </span>
            <span className="text-stone-300 text-sm">›</span>
        </a>
    );
}
