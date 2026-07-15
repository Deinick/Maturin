import { useEffect, useState } from 'react';
import { changePassword } from '../api/client';
import Modal from './Modal';

export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
