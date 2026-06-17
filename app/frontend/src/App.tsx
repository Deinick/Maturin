import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Background from './components/Background';
import RolloverModal from './components/RolloverModal';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AccountPage from './pages/AccountPage';

const NAV_LINKS = [
  { to: '/',         label: 'Dashboard', end: true  },
  { to: '/tasks',    label: 'Tasks',     end: false },
  { to: '/habits',   label: 'Habits',    end: false },
  { to: '/projects', label: 'Projects',  end: false },
];

function TortoiseMark({ className = '' }: { className?: string }) {
  return (
    <svg width="32" height="22" viewBox="0 0 40 26" fill="none" className={className}>
      <polygon points="28,13 23,4.3 13,4.3 8,13 13,21.7 23,21.7" fill="currentColor" />
      <circle cx="36" cy="13" r="4"   fill="currentColor" opacity="0.72" />
      <circle cx="4"  cy="13" r="2.5" fill="currentColor" opacity="0.48" />
    </svg>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Background />
      <RolloverModal />

      {/* Nav — paper-toned, lined notebook feel */}
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
          </div>
        </div>
      </nav>

      {/* Page */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/tasks"        element={<TasksPage />} />
          <Route path="/habits"       element={<HabitsPage />} />
          <Route path="/projects"     element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/account"      element={<AccountPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
