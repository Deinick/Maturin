import { useEffect, useState, type ElementType } from 'react';
import { useAuth } from '../context/AuthContext';
import { getYearlyStats, downloadExport, resendVerification } from '../api/client';
import { useSettings } from '../hooks/useSettings';
import type { Theme, WeekStart } from '../hooks/useSettings';
import { Send } from '@/components/animate-ui/icons/send';
import { MessageSquareWarning } from '@/components/animate-ui/icons/message-square-warning';
import { RadioTower } from '@/components/animate-ui/icons/radio-tower';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import DeleteAccountModal from '../components/DeleteAccountModal';

interface YearlyStats {
    year: number;
    tasksCompleted: number;
    habitsCompleted: number;
    projectsCompleted: number;
}

export default function AccountPage({ onLogout }: { onLogout: () => void }) {
    const { user }               = useAuth();
    const { settings, update }   = useSettings();
    const [stats, setStats]      = useState<YearlyStats | null>(null);
    const [exporting, setExporting] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [resendingVerification, setResendingVerification] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    async function handleResendVerification() {
        setResendingVerification(true);
        try { await resendVerification(); setVerificationSent(true); }
        finally { setResendingVerification(false); }
    }

    useEffect(() => { getYearlyStats().then(setStats); }, []);

    async function handleExport() {
        setExporting(true);
        try { await downloadExport(); } finally { setExporting(false); }
    }

    const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    function handleLogout() {
        onLogout();
        window.location.href = '/login';
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-7">
                <div>
                    <h1 className="text-2xl font-semibold text-[#2D1E1A] font-serif">Account</h1>
                    <p className="text-sm text-[#8A7265] mt-0.5">{dateLabel}</p>
                </div>
            </div>

            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-6 flex items-center justify-between gap-5">
                <div className="flex items-center gap-5 min-w-0">
                    <div className="w-16 h-16 rounded-full bg-[#c8eadf] flex items-center justify-center text-2xl font-bold text-[#16342d] shrink-0 overflow-hidden">
                        {user?.avatarUrl
                            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                            : (user?.name?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-semibold text-[#2D1E1A] truncate">{user?.name}</p>
                        <p className="text-sm text-[#8A7265] mt-0.5 truncate">{user?.email}</p>
                        {user?.emailVerified === false && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
                                    Not verified
                                </span>
                                {verificationSent ? (
                                    <span className="text-xs text-[#4C8077] font-medium">Email sent ✓</span>
                                ) : (
                                    <button
                                        onClick={handleResendVerification}
                                        disabled={resendingVerification}
                                        className="text-xs font-medium text-[#4C8077] hover:text-[#16342d] transition-colors disabled:opacity-50"
                                    >
                                        {resendingVerification ? 'Sending…' : 'Resend verification'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowEditProfileModal(true)}
                        className="text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] px-4 py-2 rounded-xl transition-colors"
                    >Edit profile</button>
                    <button
                        onClick={handleLogout}
                        className="text-sm text-[#8A7265] hover:text-[#ba1a1a] hover:bg-[#ffdad6] px-4 py-2 rounded-xl transition-colors font-medium"
                    >Sign out</button>
                </div>
            </div>

            {/* Year in review */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-semibold text-[#2D1E1A]">Year in Review</h2>
                        <p className="text-xs text-[#8A7265] mt-0.5">
                            {stats?.year ?? new Date().getFullYear()} — what you've accomplished
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <StatCard value={stats?.tasksCompleted    ?? '—'} label="Tasks completed"   color="text-[#4C8077]" bg="bg-[#E8FAF7]" />
                    <StatCard value={stats?.habitsCompleted   ?? '—'} label="Habits logged"     color="text-amber-600"  bg="bg-amber-50"  />
                    <StatCard value={stats?.projectsCompleted ?? '—'} label="Projects finished" color="text-[#4C8077]"   bg="bg-[#E8FAF7]"   />
                </div>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E0CFC4]">
                    <h2 className="text-base font-semibold text-[#2D1E1A]">Settings</h2>
                </div>
                <div className="divide-y divide-[#e4e2e2]">

                    {/* Theme */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-[#54433A]">Theme</span>
                        <SegmentControl<Theme>
                            value={settings.theme}
                            options={[
                                { value: 'light',  label: 'Light'  },
                                { value: 'dark',   label: 'Dark'   },
                                { value: 'system', label: 'System' },
                            ]}
                            onChange={v => update('theme', v)}
                        />
                    </div>

                    {/* Start of week */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-[#54433A]">Start of week</span>
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
                            <span className="text-sm text-[#54433A]">Daily reminder</span>
                            <p className="text-xs text-[#8A7265] mt-0.5">Push notifications — coming soon</p>
                        </div>
                        <span className="text-xs text-[#BBA79C] bg-[#FFF5E9] border border-[#E0CFC4] px-2 py-1 rounded-lg">Soon</span>
                    </div>

                    {/* Data export */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <div>
                            <span className="text-sm text-[#54433A]">Data export</span>
                            <p className="text-xs text-[#8A7265] mt-0.5">Download your tasks, habits, and projects as JSON (for backup)</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="text-sm text-[#8A7265] hover:text-[#4C8077] transition-colors disabled:opacity-40"
                        >
                            {exporting ? 'Downloading…' : 'Download'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E0CFC4]">
                    <h2 className="text-base font-semibold text-[#2D1E1A]">Security</h2>
                </div>
                <div className="divide-y divide-[#e4e2e2]">
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <div>
                            <span className="text-sm text-[#54433A]">Password</span>
                            <p className="text-xs text-[#8A7265] mt-0.5">Change your account password</p>
                        </div>
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="text-sm text-[#8A7265] hover:text-[#4C8077] transition-colors"
                        >
                            Change
                        </button>
                    </div>

                    {/* Delete account */}
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <div>
                            <span className="text-sm text-[#54433A]">Delete account</span>
                            <p className="text-xs text-[#8A7265] mt-0.5">Permanently erase your account and data</p>
                        </div>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="text-sm text-[#ba1a1a] hover:text-[#8c1414] transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Support */}
            <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E0CFC4]">
                    <h2 className="text-base font-semibold text-[#2D1E1A]">Support</h2>
                </div>
                <div className="divide-y divide-[#e4e2e2]">
                    <SupportRow
                        label="Send feedback"
                        icon={Send}
                        href={`mailto:${user?.email ? 'nikolaydeinego@gmail.com' : 'nikolaydeinego@gmail.com'}?subject=Maturin feedback`}
                    />
                    <SupportRow
                        label="Report a bug"
                        icon={MessageSquareWarning}
                        href="mailto:nikolaydeinego@gmail.com?subject=Maturin bug report"
                    />
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-[#54433A] flex items-center gap-3">
                            <RadioTower className="w-4 h-4 shrink-0" animateOnHover="default" />
                            About 𝙈𝙖𝙩𝙪𝙧𝙞𝙣
                        </span>
                        <span className="text-xs text-[#8A7265]">v1.0</span>
                    </div>
                </div>
            </div>

            <EditProfileModal open={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} />

            <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

            {showDeleteModal && (
                <DeleteAccountModal
                    onClose={() => setShowDeleteModal(false)}
                    onDeleted={() => { onLogout(); window.location.href = '/login'; }}
                />
            )}
        </div>
    );
}

function StatCard({ value, label, color, bg }: {
    value: number | string; label: string; color: string; bg: string;
}) {
    return (
        <div className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-light ${color}`}>{value}</p>
            <p className="text-xs text-[#8A7265] mt-1">{label}</p>
        </div>
    );
}

function SegmentControl<T extends string>({ value, options, onChange }: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex items-center gap-0.5 bg-[#F0E9E0] rounded-lg p-0.5">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        value === opt.value
                            ? 'bg-white text-[#2D1E1A] shadow-sm'
                            : 'text-[#8A7265] hover:text-[#54433A]'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function SupportRow({ label, icon: Icon, href }: { label: string; icon: ElementType; href: string }) {
    return (
        <a
            href={href}
            className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-[#FFF5E9] transition-colors text-left"
        >
            <span className="text-sm text-[#54433A] flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" animateOnHover="default" />
                {label}
            </span>
            <span className="text-[#BBA79C] text-sm">›</span>
        </a>
    );
}
