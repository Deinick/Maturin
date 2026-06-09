import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import ProjectsPage from './pages/ProjectsPage';

function App()
{
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex gap-6">
          <span className="font-bold text-gray-800 mr-4">Planner</span>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Tasks</NavLink>
          <NavLink to="/habits" className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Habits</NavLink>
          <NavLink to="/projects" className={({ isActive }) => isActive ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-800'}>Projects</NavLink>
        </nav>
        <main className="p-6">
          <Routes>
            <Route path="/" element={<TasksPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
