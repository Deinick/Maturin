import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage()
{
    const { register } = useAuth();
    const navigate     = useNavigate();
    const [searchParams] = useSearchParams();
    const next = searchParams.get('next') ?? '/';
    const [name,     setName]     = useState('');
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,      setError]      = useState('');
    const [loading,    setLoading]    = useState(false);
    const [registered, setRegistered] = useState(false);

    async function handleSubmit(e: FormEvent)
    {
        e.preventDefault();
        setError('');
        if (password.length < 8)
        {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try
        {
            await register(email, name, password);
            setRegistered(true);
        }
        catch (err: any)
        {
            const msg = err.response?.data?.error;
            setError(msg ?? 'Something went wrong — please try again');
        }
        finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Steadily</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8">
                    {registered ? (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-2">Check your email</h1>
                            <p className="text-sm text-[#8A7265] leading-relaxed mb-6">
                                We've sent a verification link to <span className="font-medium text-[#54433A]">{email}</span>. Click it to confirm your address — you can keep using Steadily in the meantime.
                            </p>
                            <button
                                onClick={() => navigate(next, { replace: true })}
                                className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#C4601A] hover:bg-[#A84E14] transition-colors"
                            >
                                Continue to Steadily
                            </button>
                        </>
                    ) : (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-6">Create your account</h1>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Name</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="Your name"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="you@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-[#8A7265] uppercase tracking-wide">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full mt-1.5 border border-[#E0CFC4] rounded-xl px-3 py-2.5 text-sm text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9]"
                                        placeholder="At least 8 characters"
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
                                    {loading ? 'Creating account…' : 'Create account'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="text-center text-sm text-[#8A7265] mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
