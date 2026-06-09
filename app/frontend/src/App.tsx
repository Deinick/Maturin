import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SuggestionPanel from './components/SuggestionPanel';

function Layout() {
  const location = useLocation();
  const isProjectDetail = location.pathname.startsWith('/projects/');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex gap-6">
        <span className="font-bold text-gray-800 mr-4">Planner</span>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Dashboard</NavLink>
        <NavLink to="/tasks" className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Tasks</NavLink>
        <NavLink to="/habits" className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Habits</NavLink>
        <NavLink to="/projects" className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Projects</NavLink>
      </nav>
      <div className="flex gap-6 p-6">
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </main>
        {!isProjectDetail && <SuggestionPanel />}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
