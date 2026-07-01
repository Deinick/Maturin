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
                    <h2 className="text-base font-semibold text-stone-800">Invite a collaborator</h2>
                    <button
                        onClick={onClose}
                        className="text-stone-300 hover:text-stone-500 text-xl leading-none"
                    >×</button>
                </div>

                {done ? (
                    <div className="text-center py-4">
                        <p className="text-2xl mb-2">✉️</p>
                        <p className="text-sm font-semibold text-stone-800 mb-1">Invitation sent!</p>
                        <p className="text-xs text-stone-400 mb-5">
                            We emailed <span className="font-medium text-stone-600">{email}</span> with a link to join.
                        </p>
                        <button
                            onClick={onClose}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email address</label>
                            <input
                                type="email"
                                autoFocus
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full mt-1.5 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50"
                                placeholder="collaborator@example.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Role</label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                {(['contributor', 'viewer'] as const).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all capitalize ${
                                            role === r
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-stone-400 mt-1.5">
                                {role === 'contributor'
                                    ? 'Contributors can edit milestones and phases.'
                                    : 'Viewers can see the project but cannot make changes.'}
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                        >
                            {loading ? 'Sending…' : 'Send invitation'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
