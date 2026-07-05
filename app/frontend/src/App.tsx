import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSettings } from './hooks/useSettings';
import ErrorBoundary    from './components/ErrorBoundary';
import RolloverModal    from './components/RolloverModal';
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

function IconGrid({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
    );
}

function IconCheck({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    );
}

function IconSun({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
    );
}

function IconFolder({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
    );
}

function IconBulb({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.298.016-.583.017-.875L12 13c0-1.654-1.346-3-3-3s-3 1.346-3 3l-.017.125c.001.292.002.577.017.875h5.966z" />
        </svg>
    );
}

const NAV_LINKS = [
    { to: '/',           label: 'Dashboard', Icon: IconGrid,   end: true  },
    { to: '/tasks',      label: 'Tasks',     Icon: IconCheck,  end: false },
    { to: '/habits',     label: 'Habits',    Icon: IconSun,    end: false },
    { to: '/projects',   label: 'Projects',  Icon: IconFolder, end: false },
    { to: '/suggestions',label: 'Insights',  Icon: IconBulb,   end: false },
];

function ProtectedRoute({ children }: { children: ReactNode }) {
    const { token, loading } = useAuth();
    if (loading) return null;
    if (!token)  return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
    const { token, loading } = useAuth();
    if (loading) return null;
    if (token)   return <Navigate to="/" replace />;
    return <>{children}</>;
}

function IconChevronLeft({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    );
}

function IconChevronRight({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
    );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { user } = useAuth();

    return (
        <aside
            className={`sidebar-liquid fixed inset-y-0 left-0 flex flex-col z-40 overflow-hidden transition-[width] duration-300 ease-in-out ${collapsed ? 'w-12' : 'w-52'}`}
        >
            {/* ── Content ── */}
            <div className="flex flex-col h-full">

                {/* Toggle button row */}
                <div className={`flex items-center py-4 ${collapsed ? 'justify-center px-0' : 'justify-end px-3'}`}>
                    <button
                        onClick={onToggle}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="nav-glass w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700"
                    >
                        {collapsed
                            ? <IconChevronRight className="w-3.5 h-3.5" />
                            : <IconChevronLeft  className="w-3.5 h-3.5" />
                        }
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
                    {NAV_LINKS.map(({ to, label, Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            title={collapsed ? label : undefined}
                            className={({ isActive }) =>
                                `nav-glass flex items-center gap-3 px-2.5 py-2.5 text-sm font-medium ${
                                    isActive
                                        ? 'nav-glass-active text-slate-900'
                                        : 'text-slate-400 hover:text-slate-700'
                                } ${collapsed ? 'justify-center' : ''}`
                            }
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {!collapsed && <span className="truncate">{label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* User profile */}
                <div className="px-2 py-4 border-t border-slate-100">
                    <NavLink
                        to="/account"
                        title={collapsed ? (user?.name ?? 'Account') : undefined}
                        className={({ isActive }) =>
                            `nav-glass flex items-center gap-3 px-2.5 py-2 ${
                                isActive ? 'nav-glass-active' : ''
                            } ${collapsed ? 'justify-center' : ''}`
                        }
                    >
                        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                            {user?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="text-slate-800 text-xs font-medium leading-none truncate">{user?.name ?? 'Account'}</p>
                                <p className="text-slate-400 text-[10px] mt-0.5 truncate">{user?.email ?? ''}</p>
                            </div>
                        )}
                    </NavLink>
                </div>
            </div>
        </aside>
    );
}

function AppShell() {
    const { logout } = useAuth();
    const { settings } = useSettings();
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', settings.theme === 'system' && prefersDark);
    }, [settings.theme]);

    return (
        <div className="flex min-h-screen bg-[#f7f9fb]">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c: boolean) => !c)} />
            <RolloverModal />
            <main
                className={`flex-1 px-8 py-8 min-h-screen overflow-x-hidden transition-all duration-300 ease-in-out ${collapsed ? 'ml-12' : 'ml-52'}`}
            >
                <Routes>
                    <Route path="/"             element={<DashboardPage />} />
                    <Route path="/tasks"        element={<TasksPage />} />
                    <Route path="/habits"       element={<HabitsPage />} />
                    <Route path="/projects"     element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/suggestions"  element={<SuggestionsPage />} />
                    <Route path="/account"      element={<AccountPage onLogout={logout} />} />
                    <Route path="*"             element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
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
        </ErrorBoundary>
    );
}
