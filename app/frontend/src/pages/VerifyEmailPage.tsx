import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { verifyEmail } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage()
{
    const { token } = useParams<{ token: string }>();
    const { user, updateUser } = useAuth();
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

    useEffect(() => {
        if (!token) { setStatus('error'); return; }
        verifyEmail(token)
            .then(() => {
                setStatus('success');
                if (user) updateUser({ emailVerified: true });
            })
            .catch(() => setStatus('error'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-fade">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Steadily</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8 text-center">
                    {status === 'verifying' && (
                        <p className="text-sm text-[#8A7265]">Verifying your email…</p>
                    )}
                    {status === 'success' && (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-2">Email verified</h1>
                            <p className="text-sm text-[#8A7265]">Your email address has been confirmed.</p>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <h1 className="text-lg font-semibold text-[#2D1E1A] mb-2">Link invalid or expired</h1>
                            <p className="text-sm text-[#8A7265]">Sign in and request a new verification email from your Account page.</p>
                        </>
                    )}
                </div>

                <p className="text-center text-sm text-[#8A7265] mt-6">
                    <Link to={user ? '/' : '/login'} className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors">
                        {user ? 'Go to dashboard' : 'Back to sign in'}
                    </Link>
                </p>
            </div>
        </div>
    );
}
