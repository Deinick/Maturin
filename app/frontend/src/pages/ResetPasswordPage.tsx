import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../api/client';

export default function ResetPasswordPage()
{
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [newPassword,     setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error,           setError]           = useState('');
    const [loading,         setLoading]         = useState(false);
    const [done,            setDone]            = useState(false);

    async function handleSubmit(e: FormEvent)
    {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
        if (!token) { setError('This reset link is invalid'); return; }

        setLoading(true);
        try
        {
            await resetPassword(token, newPassword);
            setDone(true);
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        }
        catch (err: any)
        {
            setError(err?.response?.data?.error ?? 'This reset link is invalid or has expired');
        }
        finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-fade">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Steadily</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8">
                    {done ? (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-2">Password updated</h1>
                            <p className="text-sm text-[#8A7265]">Taking you to sign in…</p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-1">Set a new password</h1>
                            <p className="text-sm text-[#8A7265] mb-6">Choose a new password for your account.</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">New password</label>
                                    <input
                                        type="password"
                                        autoFocus
                                        required
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Confirm password</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="••••••••"
                                    />
                                </div>

                                {error && (
                                    <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] border border-[#ffdad6] rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#C4601A] hover:bg-[#A84E14] disabled:opacity-40 transition-colors mt-2"
                                >
                                    {loading ? 'Saving…' : 'Reset password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="text-center text-sm text-[#8A7265] mt-6">
                    <Link to="/login" className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors">
                        Back to sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
