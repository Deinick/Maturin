import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getYearlyStats } from '../api/client';

interface YearlyStats
{
    year: number;
    tasksCompleted: number;
    habitsCompleted: number;
    projectsCompleted: number;
}

export default function AccountPage({ onLogout }: { onLogout: () => void })
{
    const navigate       = useNavigate();
    const { user }       = useAuth();
    const [stats, setStats] = useState<YearlyStats | null>(null);

    useEffect(() => { getYearlyStats().then(setStats); }, []);

    function handleLogout()
    {
        onLogout();
        navigate('/login', { replace: true });
    }

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
                    <h1 className="text-3xl font-light text-stone-800">Account</h1>
                    <p className="text-sm text-stone-400 mt-0.5">Your profile and preferences</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex items-center justify-between gap-5">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700 shrink-0 serif">
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
                >
                    Sign out
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-semibold text-stone-800">Year in Review</h2>
                        <p className="text-xs text-stone-400 mt-0.5">{stats?.year ?? new Date().getFullYear()} — what you've accomplished</p>
                    </div>
                    <span className="text-2xl">🏆</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <StatCard value={stats?.tasksCompleted    ?? '—'} label="Tasks completed"  color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard value={stats?.habitsCompleted   ?? '—'} label="Habits logged"    color="text-amber-600"  bg="bg-amber-50"  />
                    <StatCard value={stats?.projectsCompleted ?? '—'} label="Projects finished" color="text-blue-600"   bg="bg-blue-50"   />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-50">
                    <h2 className="text-base font-semibold text-stone-800">Settings</h2>
                </div>
                <div className="divide-y divide-stone-50">
                    <SettingRow label="Theme"          value="Light"        />
                    <SettingRow label="Start of week"  value="Monday"       />
                    <SettingRow label="Daily reminder" value="Off"          />
                    <SettingRow label="Data export"    value="Coming soon" muted />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-50">
                    <h2 className="text-base font-semibold text-stone-800">Support</h2>
                </div>
                <div className="divide-y divide-stone-50">
                    <SupportRow label="Send feedback" icon="✉" />
                    <SupportRow label="Report a bug"  icon="🐛" />
                    <SupportRow label="About Steadily" icon="ℹ" />
                </div>
            </div>
        </div>
    );
}

function StatCard({ value, label, color, bg }: { value: number | string; label: string; color: string; bg: string })
{
    return (
        <div className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-light ${color} serif`}>{value}</p>
            <p className="text-xs text-stone-500 mt-1">{label}</p>
        </div>
    );
}

function SettingRow({ label, value, muted }: { label: string; value: string; muted?: boolean })
{
    return (
        <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-sm text-stone-700">{label}</span>
            <span className={`text-sm ${muted ? 'text-stone-300' : 'text-stone-400'}`}>{value}</span>
        </div>
    );
}

function SupportRow({ label, icon }: { label: string; icon: string })
{
    return (
        <button className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 transition-colors text-left">
            <span className="text-sm text-stone-700 flex items-center gap-3">
                <span className="text-base w-5 text-center">{icon}</span>
                {label}
            </span>
            <span className="text-stone-300 text-sm">›</span>
        </button>
    );
}
