import axios from 'axios';
import type { Task, Habit, HabitLog, Project, Phase, Milestone, Suggestion, PendingChange } from '../types';
import { localDate } from '../utils/date';
/*




CHANGE LINK WHEN DEPLOYMENT







CHANGE LINK WHEN DEPLOYMENT




*/





const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
});

// Attach JWT from localStorage to every request
api.interceptors.request.use(config =>
{
    const stored = localStorage.getItem('auth');
    if (stored)
    {
        try
        {
            const { token } = JSON.parse(stored);
            if (token) config.headers['Authorization'] = `Bearer ${token}`;
        }
        catch { /* ignore */ }
    }
    return config;
});

// On 401, clear session and redirect to login
api.interceptors.response.use(
    r => r,
    err =>
    {
        if (err.response?.status === 401)
        {
            localStorage.removeItem('auth');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Tasks
export const getTasks = (date: string) =>
    api.get<Task[]>(`/tasks?date=${date}`).then(r => r.data);

export const createTask = (text: string, dateAssigned: string, priority: number, timeEstimate?: string) =>
    api.post<Task>('/tasks', { text, dateAssigned, priority, timeEstimate }).then(r => r.data);

export const updateTask = (id: string, data: Partial<Task>) =>
    api.patch<Task>(`/tasks/${id}`, data).then(r => r.data);

export const deleteTask = (id: string) =>
    api.delete(`/tasks/${id}`).then(r => r.data);

export const rolloverTask = (id: string) =>
    api.post<Task>(`/tasks/${id}/rollover`, { targetDate: localDate() }).then(r => r.data);


// Habits
export const getHabits = () =>
    api.get<Habit[]>('/habits').then(r => r.data);

export const createHabit = (name: string, difficulty?: string, activeDays?: string) =>
    api.post<Habit>('/habits', { name, difficulty, activeDays }).then(r => r.data);

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
    api.post<Project>('/projects', { title, description, targetEndDate }).then(r => r.data);

export const createPhase = (projectId: string, title: string, order: number) =>
    api.post<Phase>(`/projects/${projectId}/phases`, { title, order }).then(r => r.data);

export const createMilestone = (phaseId: string, title: string, order: number, dueDate?: string) =>
    api.post<Milestone>(`/projects/phases/${phaseId}/milestones`, { title, order, dueDate }).then(r => r.data);

export type ApplyResult<T> =
    | { applied: true; data: T }
    | { applied: false; pendingChangeId: string };

export const updateProject = (id: string, data: Partial<Project>) =>
    api.patch<ApplyResult<Project>>(`/projects/${id}`, data).then(r => r.data);

export const updatePhase = (id: string, data: Partial<Phase>) =>
    api.patch<ApplyResult<Phase>>(`/projects/phases/${id}`, data).then(r => r.data);

export const updateMilestone = (id: string, data: Partial<Milestone>) =>
    api.patch<ApplyResult<Milestone>>(`/projects/milestones/${id}`, data).then(r => r.data);

export const getProjectInsights = (projectId: string) =>
    api.get<{
        healthScore: number;
        velocity: { available: false } | {
            available: true;
            weeksElapsed: number;
            completedCount: number;
            actualPerWeek: number;
            plannedPerWeek: number | null;
            remainingCount: number;
            revisedFinishDate: string | null;
            targetFinishDate: string | null;
        };
    }>(`/projects/${projectId}/insights`).then(r => r.data);

export const deleteProject = (id: string) =>
    api.delete(`/projects/${id}`).then(r => r.data);

export const deletePhase = (id: string) =>
    api.delete(`/projects/phases/${id}`).then(r => r.data);

export const deleteMilestone = (id: string) =>
    api.delete(`/projects/milestones/${id}`).then(r => r.data);

export const setMemberPermission = (projectId: string, memberId: string, canApprove: boolean) =>
    api.patch(`/projects/${projectId}/members/${memberId}/permissions`, { canApprove }).then(r => r.data);

// Pending changes
export const getPendingChanges = (projectId: string) =>
    api.get<PendingChange[]>(`/projects/${projectId}/pending-changes`).then(r => r.data);

export const approvePendingChange = (changeId: string) =>
    api.post(`/pending-changes/${changeId}/approve`).then(r => r.data);

export const rejectPendingChange = (changeId: string) =>
    api.post(`/pending-changes/${changeId}/reject`).then(r => r.data);


// Rollover
export const runRollover = () =>
    api.post('/rollover').then(r => r.data);


// Stats
export const getProductivity = () =>
    api.get('/stats/productivity').then(r => r.data);

export const getYearlyStats = () =>
    api.get<{ year: number; tasksCompleted: number; habitsCompleted: number; projectsCompleted: number }>('/stats/yearly').then(r => r.data);

export const getCompletionRate = () =>
    api.get<{ rate: number }>('/stats/completion-rate').then(r => r.data);

export const getWeeklySummary = () =>
    api.get<{
        weekStart: string; weekEnd: string;
        totalLogged: number; completed: number; pending: number; rolledOver: number;
        bestDay: { date: string; completed: number; total: number } | null;
        categoryStats: { category: string; completed: number; total: number; rate: number }[];
    }>('/stats/weekly').then(r => r.data);


// Suggestions
export const getSuggestions = () =>
    api.get<Suggestion[] | { suggestions: Suggestion[] }>('/suggestions').then(r =>
        Array.isArray(r.data) ? r.data : r.data.suggestions ?? []
    );

// Invites
export interface InviteDetails {
    id: string;
    projectId: string;
    invitedEmail: string;
    role: 'contributor' | 'viewer';
    token: string;
    expiresAt: string;
    usedAt: string | null;
    status: 'pending' | 'used' | 'expired';
    project: { id: string; title: string };
    creator: { name: string };
}

export const sendInvite = (projectId: string, email: string, role: 'contributor' | 'viewer') =>
    api.post(`/projects/${projectId}/invites`, { email, role }).then(r => r.data);

export const getInviteDetails = (token: string) =>
    api.get<InviteDetails>(`/invites/${token}`).then(r => r.data);

export const acceptInvite = (token: string) =>
    api.post<{ projectId: string; projectTitle: string }>(`/invites/${token}/accept`).then(r => r.data);

// Export
export async function downloadExport(): Promise<void>
{
    const res = await api.get('/stats/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `steadily-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
