import { useState, useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CODE_LENGTH = 6;

export default function ConfirmRegistrationPage()
{
    const { confirmRegistration, resendRegistrationCode, token } = useAuth();
    const navigate      = useNavigate();
    const location       = useLocation();
    const [searchParams] = useSearchParams();
    const next  = searchParams.get('next') ?? '/';
    const email = (location.state as { email?: string } | null)?.email ?? searchParams.get('email') ?? '';

    const [digits,     setDigits]     = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [error,      setError]      = useState('');
    const [loading,    setLoading]    = useState(false);
    const [resent,     setResent]     = useState(false);
    const [resending,  setResending]  = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => { inputRefs.current[0]?.focus(); }, []);

    async function submitCode(code: string)
    {
        if (code.length !== CODE_LENGTH || !email) return;
        setError('');
        setLoading(true);
        try
        {
            await confirmRegistration(email, code);
            navigate(next, { replace: true });
        }
        catch (err: any)
        {
            const msg = err.response?.data?.error;
            setError(msg ?? 'Something went wrong — please try again');
            setDigits(Array(CODE_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        }
        finally { setLoading(false); }
    }

    function handleDigitChange(i: number, raw: string)
    {
        const value = raw.replace(/\D/g, '').slice(-1);
        setDigits(prev =>
        {
            const next = [...prev];
            next[i] = value;
            if (value && i < CODE_LENGTH - 1) inputRefs.current[i + 1]?.focus();
            if (next.every(d => d) && next.join('').length === CODE_LENGTH) submitCode(next.join(''));
            return next;
        });
    }

    function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>)
    {
        if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>)
    {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
        if (!pasted) return;
        e.preventDefault();
        const next = Array(CODE_LENGTH).fill('').map((_, i) => pasted[i] ?? '');
        setDigits(next);
        const lastFilled = Math.min(pasted.length, CODE_LENGTH) - 1;
        inputRefs.current[lastFilled >= 0 ? lastFilled : 0]?.focus();
        if (pasted.length === CODE_LENGTH) submitCode(pasted);
    }

    async function handleResend()
    {
        if (!email) return;
        setResending(true);
        setError('');
        try
        {
            await resendRegistrationCode(email);
            setResent(true);
            setDigits(Array(CODE_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
            setTimeout(() => setResent(false), 4000);
        }
        catch { setError('Could not resend the code — please try again'); }
        finally { setResending(false); }
    }

    if (!email)
    {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 page-fade">
                <div className="w-full max-w-sm text-center">
                    <p className="text-sm text-[#8A7265] mb-4">We don't have an email to confirm. Start over from registration.</p>
                    <Link to="/register" className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors text-sm">Back to sign up</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 page-fade">
            <div className="w-full max-w-sm">

                <div className="text-center mb-8">
                    <p className="text-3xl font-bold text-[#2D1E1A] tracking-tight">Maturin</p>
                    <p className="text-sm text-[#8A7265] mt-1">Slow &amp; Consistent</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E0CFC4] shadow-sm p-8">
                    <h1 className="text-lg font-semibold text-[#2D1E1A] mb-1">Confirm your email</h1>
                    <p className="text-sm text-[#8A7265] mb-6 leading-relaxed">
                        Enter the 6-digit code we sent to <span className="font-medium text-[#54433A]">{email}</span>.
                        {token && ' You can also do this later from your account page.'}
                    </p>

                    <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={el => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                disabled={loading}
                                onChange={e => handleDigitChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                className="w-11 h-13 text-center text-lg font-semibold border border-[#E0CFC4] rounded-xl text-[#2D1E1A] focus:outline-none focus:ring-2 focus:ring-[#c8eadf] bg-[#FFF5E9] disabled:opacity-50"
                                style={{ height: '52px' }}
                            />
                        ))}
                    </div>

                    {error && (
                        <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] border border-[#ffdad6] rounded-lg px-3 py-2 mt-4">
                            {error}
                        </p>
                    )}
                    {resent && !error && (
                        <p className="text-xs text-[#4C8077] bg-[#E8FAF7] border border-[#c8eadf] rounded-lg px-3 py-2 mt-4">
                            A new code is on its way.
                        </p>
                    )}
                    {loading && (
                        <p className="text-xs text-[#8A7265] mt-4 text-center">Confirming…</p>
                    )}

                    <p className="text-center text-sm text-[#8A7265] mt-6">
                        Didn't get it?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resending}
                            className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors disabled:opacity-40"
                        >
                            {resending ? 'Sending…' : 'Resend code'}
                        </button>
                    </p>

                    {token && (
                        <button
                            type="button"
                            onClick={() => navigate(next, { replace: true })}
                            className="w-full text-center text-xs text-[#BBA79C] hover:text-[#8A7265] transition-colors mt-4"
                        >
                            Skip for now — I'll confirm later
                        </button>
                    )}
                </div>

                <p className="text-center text-sm text-[#8A7265] mt-6">
                    <Link to={token ? next : '/login'} className="text-[#4C8077] hover:text-[#16342d] font-medium transition-colors">
                        {token ? 'Go to Maturin' : 'Back to sign in'}
                    </Link>
                </p>
            </div>
        </div>
    );
}
