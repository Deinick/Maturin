import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Background from './components/Background';
import RolloverModal from './components/RolloverModal';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AccountPage from './pages/AccountPage';

import navTurtle from './assets/Turtles/0609 (1)(4).png';

const NAV_LINKS = [
  { to: '/',         label: 'Dashboard', end: true  },
  { to: '/tasks',    label: 'Tasks',     end: false },
  { to: '/habits',   label: 'Habits',    end: false },
  { to: '/projects', label: 'Projects',  end: false },
];

export default function App() {
  return (
    <BrowserRouter>
      <Background />
      <RolloverModal />

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[#EDE8DC]/80 backdrop-blur-md border-b border-[#D6CFC0]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <img src={navTurtle} alt="Steadily" className="turtle-img w-10 h-10 object-contain" />
            <span className="serif text-xl font-bold text-stone-800 tracking-tight">Steadily</span>
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
                      : 'text-stone-600 hover:bg-[#D6CFC0] hover:text-stone-800'
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
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/"           element={<DashboardPage />} />
          <Route path="/tasks"      element={<TasksPage />} />
          <Route path="/habits"     element={<HabitsPage />} />
          <Route path="/projects"   element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/account"    element={<AccountPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
