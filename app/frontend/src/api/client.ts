import axios from 'axios';
import type { Task, Habit, HabitLog, Project, Phase, Milestone, Suggestion } from '../types';
import { localDate } from '../utils/date';

const api=axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
    headers: { 'x-user-id': 'user-1'},
});

// Tasks
export const getTasks = (date: string) =>
  api.get<Task[]>(`/tasks?date=${date}`).then(r => r.data);

export const createTask = (text: string, dateAssigned: string, priority: number) =>
  api.post<Task>('/tasks', { userId: 'user-1', text, dateAssigned, priority }).then(r => r.data);

export const updateTask = (id: string, data: Partial<Task>) =>
  api.patch<Task>(`/tasks/${id}`, data).then(r => r.data);

export const deleteTask = (id: string) =>
  api.delete(`/tasks/${id}`).then(r => r.data);

export const rolloverTask = (id: string) =>
  api.post<Task>(`/tasks/${id}/rollover`, { targetDate: localDate() }).then(r => r.data);



// Habits
export const getHabits = () =>
  api.get<Habit[]>('/habits').then(r => r.data);

export const createHabit = (name: string) =>
  api.post<Habit>('/habits', { userId: 'user-1', name }).then(r => r.data);

export const logHabit = (id: string, date: string, status: string) =>
  api.post<HabitLog>(`/habits/${id}/log`, { date, status }).then(r => r.data);

export const updateHabitLog = (logId: string, status: string) =>
  api.patch<HabitLog>(`/habits/log/${logId}`, { status }).then(r => r.data);

export const deleteHabit = (id: string) =>
  api.delete(`/habits/${id}`).then(r => r.data);




// Projects
export const getProjects = () =>
  api.get<Project[]>('/projects').then(r => r.data);

export const createProject = (title: string, description?: string, targetEndDate?: string) =>
  api.post<Project>('/projects', { userId: 'user-1', title, description, targetEndDate }).then(r => r.data);

export const createPhase = (projectId: string, title: string, order: number) =>
  api.post<Phase>(`/projects/${projectId}/phases`, { title, order }).then(r => r.data);

export const createMilestone = (phaseId: string, title: string, order: number, dueDate?: string) =>
  api.post<Milestone>(`/projects/phases/${phaseId}/milestones`, { title, order, dueDate }).then(r => r.data);

export const updateMilestone = (id: string, data: Partial<Milestone>) =>
  api.patch<Milestone>(`/projects/milestones/${id}`, data).then(r => r.data);

export const updatePhase = (id: string, data: Partial<Phase>) =>
  api.patch<Phase>(`/projects/phases/${id}`, data).then(r => r.data);

export const updateProject = (id: string, data: Partial<Project>) =>
  api.patch<Project>(`/projects/${id}`, data).then(r => r.data);

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`).then(r => r.data);

export const deletePhase = (id: string) =>
  api.delete(`/projects/phases/${id}`).then(r => r.data);

export const deleteMilestone = (id: string) =>
  api.delete(`/projects/milestones/${id}`).then(r => r.data);




// Rollover
export const runRollover = () =>
  api.post('/rollover').then(r => r.data);




// Stats
export const getProductivity = () =>
  api.get('/stats/productivity').then(r => r.data);




// Suggestions
export const getSuggestions = () =>
  api.get<Suggestion[] | { suggestions: Suggestion[] }>('/suggestions').then(r =>
    Array.isArray(r.data) ? r.data : r.data.suggestions ?? []
  );
