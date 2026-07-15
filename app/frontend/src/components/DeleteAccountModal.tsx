import { useEffect, useState } from 'react';
import { downloadExport, deleteAccount } from '../api/client';

export default function DeleteAccountModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
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
