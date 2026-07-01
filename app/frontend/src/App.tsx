import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Background    from './components/Background';
import RolloverModal from './components/RolloverModal';
import DashboardPage    from './pages/DashboardPage';
import TasksPage        from './pages/TasksPage';
import HabitsPage       from './pages/HabitsPage';
import ProjectsPage     from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AccountPage      from './pages/AccountPage';
import SuggestionsPage  from './pages/SuggestionsPage';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import InvitePage       from './pages/InvitePage';

const NAV_LINKS = [
    { to: '/',         label: 'Dashboard', end: true  },
    { to: '/tasks',    label: 'Tasks',     end: false },
    { to: '/habits',   label: 'Habits',    end: false },
    { to: '/projects', label: 'Projects',  end: false },
];

function TortoiseMark({ className = '' }: { className?: string })
{
    return (
        <svg width="32" height="22" viewBox="0 0 40 26" fill="none" className={className}>
            <polygon points="28,13 23,4.3 13,4.3 8,13 13,21.7 23,21.7" fill="currentColor" />
            <circle cx="36" cy="13" r="4"   fill="currentColor" opacity="0.72" />
            <circle cx="4"  cy="13" r="2.5" fill="currentColor" opacity="0.48" />
        </svg>
    );
}

function ProtectedRoute({ children }: { children: ReactNode })
{
    const { token, loading } = useAuth();
    if (loading) return null; // Prevent flash before localStorage is read
    if (!token)  return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode })
{
    const { token, loading } = useAuth();
    if (loading) return null;
    if (token)   return <Navigate to="/" replace />;
    return <>{children}</>;
}

function AppShell()
{
    const { user, logout } = useAuth();

    return (
        <>
            <Background />
            <RolloverModal />

            <nav className="sticky top-0 z-40 bg-[#F4F2EA]/92 backdrop-blur-sm border-b-2 border-[#DDD8CC]">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <NavLink to="/" className="flex items-center gap-2.5 group">
                        <TortoiseMark className="text-emerald-700 group-hover:text-emerald-600 transition-colors" />
                        <span className="serif text-xl font-bold text-stone-800 tracking-tight">Steadily</span>
                        <span className="text-xs text-stone-400 font-medium hidden sm:block ml-1 mt-0.5">
                            Slow &amp; Consistent
                        </span>
                    </NavLink>

                    <div className="flex items-center gap-1">
                        {NAV_LINKS.map(link => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                end={link.end}
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                        isActive
                                            ? 'bg-emerald-700 text-white shadow-sm'
                                            : 'text-stone-600 hover:bg-[#DDD8CC] hover:text-stone-800'
                                    }`
                                }
                            >
                                {link.label}
                            </NavLink>
                        ))}
                        <NavLink
                            to="/account"
                            className={({ isActive }) =>
                                `w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ml-2 transition-all ${
                                    isActive
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                                }`
                            }
                            title={user?.name ?? 'Account'}
                        >
                            {user?.name?.[0]?.toUpperCase() ?? '?'}
                        </NavLink>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 max-w-5xl mx-auto px-6 py-10">
                <Routes>
                    <Route path="/"             element={<DashboardPage />} />
                    <Route path="/tasks"        element={<TasksPage />} />
                    <Route path="/habits"       element={<HabitsPage />} />
                    <Route path="/projects"      element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/suggestions"  element={<SuggestionsPage />} />
                    <Route path="/account"      element={<AccountPage onLogout={logout} />} />
                    <Route path="*"             element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </>
    );
}

export default function App()
{
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login"         element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                    <Route path="/register"      element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
                    <Route path="/invite/:token" element={<InvitePage />} />
                    <Route path="/*"             element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
