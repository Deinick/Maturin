import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getInviteDetails, acceptInvite, type InviteDetails } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function InvitePage()
{
    const { token }    = useParams<{ token: string }>();
    const { token: authToken, loading: authLoading } = useAuth();
    const navigate     = useNavigate();

    const [invite,  setInvite]  = useState<InviteDetails | null>(null);
    const [fetching, setFetching] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error,   setError]   = useState('');
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!token) return;
        getInviteDetails(token)
            .then(setInvite)
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
                else setError('Could not load invite details.');
            })
            .finally(() => setFetching(false));
    }, [token]);

    async function handleAccept()
    {
        if (!token) return;
        setError('');
        setAccepting(true);
        try
        {
            const { projectId } = await acceptInvite(token);
            navigate(`/projects/${projectId}`, { replace: true });
        }
        catch (err: any)
        {
            setError(err.response?.data?.error ?? 'Something went wrong — please try again');
            setAccepting(false);
        }
    }

    const nextPath = `/invite/${token}`;

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#fbf9f8]">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Maturin</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8">
                    {fetching || authLoading ? (
                        <p className="text-sm text-[#8A7265] text-center py-4">Loading…</p>
                    ) : notFound ? (
                        <div className="text-center">
                            <p className="text-2xl mb-2">🔍</p>
                            <p className="text-base font-semibold text-[#2D1E1A] mb-1">Invite not found</p>
                            <p className="text-sm text-[#8A7265]">This link may be invalid or already used.</p>
                        </div>
                    ) : invite?.status === 'expired' ? (
                        <div className="text-center">
                            <p className="text-2xl mb-2">⏰</p>
                            <p className="text-base font-semibold text-[#2D1E1A] mb-1">Invite expired</p>
                            <p className="text-sm text-[#8A7265]">Ask the project owner to send a new invitation.</p>
                        </div>
                    ) : invite?.status === 'used' ? (
                        <div className="text-center">
                            <p className="text-2xl mb-2">✓</p>
                            <p className="text-base font-semibold text-[#2D1E1A] mb-1">Invite already used</p>
                            <p className="text-sm text-[#8A7265]">
                                {authToken
                                    ? <Link to="/projects" className="text-[#4C8077] hover:underline">Go to your projects →</Link>
                                    : 'Sign in to view your projects.'}
                            </p>
                        </div>
                    ) : invite ? (
                        <>
                            <p className="text-xs font-semibold text-[#8A7265] uppercase tracking-widest mb-4">Project invitation</p>
                            <p className="text-sm text-[#54433A] mb-1">
                                <span className="font-semibold">{invite.creator.name}</span> invited you to join
                            </p>
                            <p className="text-xl font-bold text-[#2D1E1A] mb-1">{invite.project.title}</p>
                            <p className="text-sm text-[#8A7265] mb-6 capitalize">as a <span className="font-medium text-[#54433A]">{invite.role}</span></p>

                            {error && (
                                <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] border border-[#ffdad6] rounded-lg px-3 py-2 mb-4">
                                    {error}
                                </p>
                            )}

                            {authToken ? (
                                <button
                                    onClick={handleAccept}
                                    disabled={accepting}
                                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#C4601A] hover:bg-[#C4601A] disabled:opacity-40 transition-colors"
                                >
                                    {accepting ? 'Joining…' : 'Accept invitation'}
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <Link
                                        to={`/login?next=${encodeURIComponent(nextPath)}`}
                                        className="block w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#C4601A] hover:bg-[#C4601A] transition-colors text-center"
                                    >
                                        Sign in to accept
                                    </Link>
                                    <Link
                                        to={`/register?next=${encodeURIComponent(nextPath)}`}
                                        className="block w-full py-2.5 rounded-xl text-sm font-medium text-[#54433A] bg-[#F0E9E0] hover:bg-[#E0CFC4] transition-colors text-center"
                                    >
                                        Create an account
                                    </Link>
                                </div>
                            )}
                        </>
                    ) : (
                        error && (
                            <p className="text-sm text-[#ba1a1a] text-center">{error}</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
