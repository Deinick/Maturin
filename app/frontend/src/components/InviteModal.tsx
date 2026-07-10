import { useState, type FormEvent } from 'react';
import { sendInvite } from '../api/client';

interface Props {
    projectId: string;
    onClose: () => void;
}

export default function InviteModal({ projectId, onClose }: Props)
{
    const [email, setEmail]   = useState('');
    const [role,  setRole]    = useState<'contributor' | 'viewer'>('contributor');
    const [error, setError]   = useState('');
    const [done,  setDone]    = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent)
    {
        e.preventDefault();
        setError('');
        setLoading(true);
        try
        {
            await sendInvite(projectId, email, role);
            setDone(true);
        }
        catch (err: any)
        {
            setError(err.response?.data?.error ?? 'Something went wrong — please try again');
        }
        finally { setLoading(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <div className="flex items-start justify-between mb-5">
                    <h2 className="text-base font-semibold text-[#2D1E1A]">Invite a collaborator</h2>
                    <button
                        onClick={onClose}
                        className="text-[#BBA79C] hover:text-[#8A7265] text-xl leading-none"
                    >×</button>
                </div>

                {done ? (
                    <div className="text-center py-4">
                        <p className="text-2xl mb-2">✉️</p>
                        <p className="text-sm font-semibold text-[#2D1E1A] mb-1">Invitation sent!</p>
                        <p className="text-xs text-[#8A7265] mb-5">
                            We emailed <span className="font-medium text-[#54433A]">{email}</span> with a link to join.
                        </p>
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-[#4C8077] hover:text-[#16342d] transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Email address</label>
                            <input
                                type="email"
                                autoFocus
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                placeholder="collaborator@example.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Role</label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                {(['contributor', 'viewer'] as const).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all capitalize ${
                                            role === r
                                                ? 'bg-[#C4601A] text-white border-[#C4601A]'
                                                : 'bg-white text-[#8A7265] border-[#E0CFC4] hover:border-emerald-300'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-[#8A7265] mt-1.5">
                                {role === 'contributor'
                                    ? 'Contributors can edit milestones and phases.'
                                    : 'Viewers can see the project but cannot make changes.'}
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] border border-[#ffdad6] rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#C4601A] hover:bg-[#C4601A] disabled:opacity-40 transition-colors"
                        >
                            {loading ? 'Sending…' : 'Send invitation'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
