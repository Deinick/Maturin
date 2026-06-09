import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { getTasks, createTask, updateTask, deleteTask } from '../api/client';

const TODAY = new Date().toISOString().split('T')[0];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newText, setNewText] = useState('');
  const [priority, setPriority] = useState(1);

  useEffect(() => {
    getTasks(TODAY).then(setTasks);
  }, []);

  async function handleAdd() {
    if (!newText.trim()) return;
    const task = await createTask(newText.trim(), TODAY, priority);
    setTasks(prev => [...prev, task]);
    setNewText('');
    setPriority(1);
  }

  async function handleToggle(task: Task) {
    const updated = await updateTask(task.id, { completed: !task.completed });
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tasks — {TODAY}</h1>

      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="New task..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <select
          className="border border-gray-300 rounded px-2 py-2 text-sm"
          value={priority}
          onChange={e => setPriority(Number(e.target.value))}
        >
          <option value={1}>P1</option>
          <option value={2}>P2</option>
          <option value={3}>P3</option>
        </select>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded px-4 py-3">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => handleToggle(task)}
              className="w-4 h-4"
            />
            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {task.text}
            </span>
            <span className="text-xs text-gray-400">P{task.priority}</span>
            {task.rolloverCount > 0 && (
              <span className="text-xs text-orange-500">↩ {task.rolloverCount}</span>
            )}
            <button
              className="text-red-400 hover:text-red-600 text-sm"
              onClick={() => handleDelete(task.id)}
            >
              ✕
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No tasks for today</p>
        )}
      </ul>
    </div>
  );
}
