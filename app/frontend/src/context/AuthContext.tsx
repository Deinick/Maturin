import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

interface AuthUser
{
    id:            string;
    email:         string;
    name:          string;
    avatarUrl?:    string | null;
    emailVerified?: boolean;
}

interface AuthContextValue
{
    user:       AuthUser | null;
    token:      string | null;
    loading:    boolean;
    login:      (email: string, password: string) => Promise<void>;
    register:   (email: string, name: string, password: string) => Promise<void>;
    confirmRegistration:   (email: string, code: string) => Promise<void>;
    resendRegistrationCode: (email: string) => Promise<void>;
    logout:     () => void;
    updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export function AuthProvider({ children }: { children: ReactNode })
{
    const [user,    setUser]    = useState<AuthUser | null>(null);
    const [token,   setToken]   = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore session from localStorage on first load
    useEffect(() =>
    {
        const stored = localStorage.getItem('auth');
        if (stored)
        {
            try
            {
                const { token, user } = JSON.parse(stored);
                setToken(token);
                setUser(user);
            }
            catch { localStorage.removeItem('auth'); }
        }
        setLoading(false);
    }, []);

    function persist(token: string, user: AuthUser)
    {
        localStorage.setItem('auth', JSON.stringify({ token, user }));
        setToken(token);
        setUser(user);
    }

    async function login(email: string, password: string)
    {
        const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
        persist(res.data.token, res.data.user);
    }

    async function register(email: string, name: string, password: string)
    {
        const res = await axios.post(`${BASE_URL}/auth/register`, { email, name, password });
        persist(res.data.token, res.data.user);
    }

    async function confirmRegistration(email: string, code: string)
    {
        const res = await axios.post(`${BASE_URL}/auth/confirm-registration`, { email, code });
        persist(res.data.token, res.data.user);
    }

    async function resendRegistrationCode(email: string)
    {
        await axios.post(`${BASE_URL}/auth/resend-registration-code`, { email });
    }

    function logout()
    {
        localStorage.removeItem('auth');
        setToken(null);
        setUser(null);
    }

    function updateUser(patch: Partial<AuthUser>)
    {
        setUser(prev =>
        {
            if (!prev || !token) return prev;
            const next = { ...prev, ...patch };
            localStorage.setItem('auth', JSON.stringify({ token, user: next }));
            return next;
        });
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, confirmRegistration, resendRegistrationCode, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth()
{
    return useContext(AuthContext);
}
