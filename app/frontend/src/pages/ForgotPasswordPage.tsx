import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/client';

export default function ForgotPasswordPage()
{
    const [email,   setEmail]   = useState('');
    const [error,   setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const [sent,    setSent]    = useState(false);

    async function handleSubmit(e: FormEvent)
    {
        e.preventDefault();
        setError('');
        setLoading(true);
        try
        {
            await forgotPassword(email);
            setSent(true);
        }
        catch
        {
            setError('Something went wrong — please try again');
        }
        finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-fade">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Maturin</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8">
                    {sent ? (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-2">Check your email</h1>
                            <p className="text-sm text-[#8A7265] leading-relaxed">
                                If an account exists for <span className="font-medium text-[#54433A]">{email}</span>, we've sent instructions to reset your password.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-1">Reset your password</h1>
                            <p className="text-sm text-[#8A7265] mb-6">Enter your email and we'll send you a reset link.</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Email</label>
                                    <input
                                        type="email"
                                        autoFocus
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="you@example.com"
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
                                    {loading ? 'Sending…' : 'Send reset link'}
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
