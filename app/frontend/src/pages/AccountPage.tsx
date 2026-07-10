import { useEffect, useState, type ChangeEvent, type ElementType } from 'react';
import { useAuth } from '../context/AuthContext';
import { getYearlyStats, downloadExport, changePassword, deleteAccount, updateProfile, resendVerification } from '../api/client';
import { useSettings } from '../hooks/useSettings';
import type { Theme, WeekStart } from '../hooks/useSettings';
import { Send } from '@/components/animate-ui/icons/send';
import { MessageSquareWarning } from '@/components/animate-ui/icons/message-square-warning';
import { RadioTower } from '@/components/animate-ui/icons/radio-tower';
import Modal from '../components/Modal';

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
                        href={`mailto:${user?.email ? 'nikolaydeinego@gmail.com' : 'nikolaydeinego@gmail.com'}?subject=Steadily feedback`}
                    />
                    <SupportRow
                        label="Report a bug"
                        icon={MessageSquareWarning}
                        href="mailto:nikolaydeinego@gmail.com?subject=Steadily bug report"
                    />
                    <div className="flex items-center justify-between px-6 py-3.5">
                        <span className="text-sm text-[#54433A] flex items-center gap-3">
                            <RadioTower className="w-4 h-4 shrink-0" animateOnHover="default" />
                            About Steadily
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

function resizeImageToDataUrl(file: File, maxDim = 256, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.onload = () => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas not supported')); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
}

function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { user, updateUser } = useAuth();
    const [name,  setName]  = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [avatarPreview, setAvatarPreview] = useState<string | null | undefined>(user?.avatarUrl);
    const [error,     setError]     = useState<string | null>(null);
    const [saving,    setSaving]    = useState(false);
    const [processingImage, setProcessingImage] = useState(false);

    // Modal now stays mounted between opens (for the close animation), so re-seed
    // the form from the current user each time it's opened rather than only once.
    useEffect(() => {
        if (!open) return;
        setName(user?.name ?? '');
        setEmail(user?.email ?? '');
        setAvatarPreview(user?.avatarUrl);
        setError(null);
    }, [open, user]);

    async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please choose an image file'); return; }

        setError(null);
        setProcessingImage(true);
        try {
            const dataUrl = await resizeImageToDataUrl(file);
            setAvatarPreview(dataUrl);
        } catch {
            setError('Failed to process image');
        } finally {
            setProcessingImage(false);
        }
    }

    async function handleSubmit() {
        setError(null);
        if (!name.trim())  { setError('Name cannot be empty');  return; }
        if (!email.trim()) { setError('Email cannot be empty'); return; }

        setSaving(true);
        try {
            const updated = await updateProfile({
                name,
                email,
                ...(avatarPreview !== user?.avatarUrl ? { avatarUrl: avatarPreview ?? null } : {}),
            });
            updateUser(updated);
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4]">
                <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">Edit profile</h2>

                <div className="flex flex-col items-center mb-5">
                    <label className="relative cursor-pointer group">
                        <div className="w-20 h-20 rounded-full bg-[#c8eadf] flex items-center justify-center text-2xl font-bold text-[#16342d] overflow-hidden border-2 border-[#E0CFC4]">
                            {avatarPreview
                                ? <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                : (name?.[0]?.toUpperCase() ?? '?')}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                            {processingImage ? '…' : 'Change'}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {avatarPreview && (
                        <button
                            type="button"
                            onClick={() => setAvatarPreview(null)}
                            className="text-xs font-medium text-[#8A7265] hover:text-[#ba1a1a] transition-colors mt-2"
                        >
                            Remove photo
                        </button>
                    )}
                </div>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-xs font-medium text-[#8A7265] mb-1 block">Name</label>
                        <input
                            className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[#8A7265] mb-1 block">Email</label>
                        <input
                            type="email"
                            className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-[#ba1a1a] mb-4">{error}</p>}

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] transition-colors disabled:opacity-40">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || processingImage || !name.trim() || !email.trim()}
                        className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors font-semibold disabled:opacity-40">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
        </Modal>
    );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword,     setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error,           setError]           = useState<string | null>(null);
    const [saving,          setSaving]          = useState(false);
    const [success,         setSuccess]         = useState(false);

    // Modal stays mounted between opens (for the close animation) — reset the form
    // fields each time it's freshly opened instead of only on first mount.
    useEffect(() => {
        if (!open) return;
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccess(false);
    }, [open]);

    async function handleSubmit() {
        setError(null);

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setSaving(true);
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            setTimeout(onClose, 1200);
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to change password');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4]">
                <h2 className="text-lg font-semibold text-[#2D1E1A] mb-5">Change password</h2>

                {success ? (
                    <p className="text-sm text-[#4C8077] font-medium py-4 text-center">Password updated.</p>
                ) : (
                    <>
                        <div className="space-y-3 mb-4">
                            <input
                                type="password"
                                autoFocus
                                autoComplete="current-password"
                                placeholder="Current password"
                                className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                autoComplete="new-password"
                                placeholder="New password"
                                className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                autoComplete="new-password"
                                placeholder="Confirm new password"
                                className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#C4601A]/30 bg-[#FFF5E9]"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            />
                        </div>

                        {error && <p className="text-xs text-[#ba1a1a] mb-4">{error}</p>}

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] transition-colors disabled:opacity-40">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                                className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors font-semibold disabled:opacity-40">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </>
                )}
        </Modal>
    );
}

function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
    const [backdropIn, setBackdropIn] = useState(false);
    const [titleIn,    setTitleIn]    = useState(false);
    const [sectionIn,  setSectionIn]  = useState(false);

    const [stage,       setStage]       = useState<'backup' | 'confirm'>('backup');
    const [stageVisible,setStageVisible]= useState(true);

    const [password, setPassword] = useState('');
    const [error,    setError]    = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [exporting,setExporting]= useState(false);
    const [deletedOut,setDeletedOut] = useState(false);
    const [closingOut,setClosingOut] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => setBackdropIn(true));
        const t1  = setTimeout(() => setTitleIn(true), 200);
        const t2  = setTimeout(() => setSectionIn(true), 900);
        return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
    }, []);

    function handleClose() {
        setClosingOut(true);
        setTimeout(onClose, 300);
    }

    function goToStage(next: 'backup' | 'confirm') {
        setStageVisible(false);
        setTimeout(() => { setStage(next); setStageVisible(true); }, 280);
    }

    async function handleBackupThenContinue() {
        setExporting(true);
        try { await downloadExport(); } finally { setExporting(false); goToStage('confirm'); }
    }

    async function handleDelete() {
        setError(null);
        if (!password) { setError('Enter your password to confirm'); return; }

        setDeleting(true);
        try {
            await deleteAccount(password);
            setDeletedOut(true);
            setTimeout(onDeleted, 750);
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to delete account');
            setDeleting(false);
        }
    }

    return (
        <div
            className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 transition-all ease-out ${
                backdropIn && !closingOut ? 'opacity-100' : 'opacity-0'
            } ${deletedOut ? 'bg-black' : 'bg-black/50'}`}
            style={{ transitionDuration: closingOut ? '300ms' : '700ms' }}
        >
            <div
                className={`bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 border border-[#E0CFC4] transition-opacity ease-out ${
                    deletedOut || closingOut ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ transitionDuration: closingOut ? '300ms' : '500ms' }}
            >
                {/* Title section — appears first, on its own */}
                <div
                    className={`transition-all duration-500 ease-out ${
                        titleIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                >
                    <p className="text-lg font-semibold text-[#2D1E1A] leading-snug">
                        You are about to delete your account
                    </p>
                    <p className="text-xs text-[#8A7265] mt-1">This can't be undone.</p>
                </div>

                {/* Procedure section — separate block, appears below after the title */}
                <div
                    className={`transition-all duration-500 ease-out ${
                        sectionIn ? 'opacity-100 translate-y-0 mt-5 pt-5 border-t border-[#E0CFC4]' : 'opacity-0 translate-y-2 mt-0 pt-0 max-h-0 overflow-hidden pointer-events-none'
                    }`}
                >
                    <div className={`transition-opacity duration-300 ease-out ${stageVisible ? 'opacity-100' : 'opacity-0'}`}>
                        {stage === 'backup' ? (
                            <>
                                <p className="text-sm text-[#54433A] mb-4">
                                    Want a copy of your tasks, habits, and projects before it's gone?
                                </p>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleBackupThenContinue}
                                        disabled={exporting}
                                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4C8077] hover:bg-[#3d6a62] transition-colors disabled:opacity-60"
                                    >
                                        {exporting ? 'Downloading…' : 'Yes, back up my data'}
                                    </button>
                                    <button
                                        onClick={() => goToStage('confirm')}
                                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] transition-colors"
                                    >
                                        No, continue without backing up
                                    </button>
                                    <button
                                        onClick={handleClose}
                                        className="w-full py-2 rounded-xl text-sm font-medium text-[#8A7265] hover:text-[#54433A] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-[#54433A] mb-4">
                                    Enter your password to permanently delete your account.
                                </p>

                                <input
                                    type="password"
                                    autoFocus
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    className="w-full border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]/30 bg-[#FFF5E9] mb-3"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleDelete()}
                                />

                                {error && <p className="text-xs text-[#ba1a1a] mb-3">{error}</p>}

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        disabled={deleting}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#3A2A22] bg-[#F0E9E0] border border-[#E0CFC4] hover:bg-[#E0CFC4] transition-colors disabled:opacity-40">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting || !password}
                                        className="flex-1 py-2.5 rounded-xl text-sm text-white bg-[#ba1a1a] hover:bg-[#8c1414] transition-colors font-semibold disabled:opacity-40">
                                        {deleting ? 'Deleting…' : 'Delete account'}
                                    </button>
                                </div>
                            </>
                        )}
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
