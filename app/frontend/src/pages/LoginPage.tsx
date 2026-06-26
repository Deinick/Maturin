import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage()
{
    const { login }   = useAuth();
    const navigate    = useNavigate();
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    async function handleSubmit(e: FormEvent)
    {
        e.preventDefault();
        setError('');
        setLoading(true);
        try
        {
            await login(email, password);
            navigate('/', { replace: true });
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
                    <p className="serif text-3xl font-bold text-stone-800 tracking-tight">Steadily</p>
                    <p className="text-sm text-stone-400 mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
                    <h1 className="text-lg font-semibold text-stone-800 mb-6">Welcome back</h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email</label>
                            <input
                                type="email"
                                autoFocus
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full mt-1.5 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full mt-1.5 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-stone-50"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors mt-2"
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-stone-400 mt-6">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
