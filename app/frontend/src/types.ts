export interface Task {
  id: string;
  userId: string;
  text: string;
  description: string | null;
  dateAssigned: string;
  status: string;
  completed: boolean;
  rolloverCount: number;
  priority: number;
  timeEstimate: 'quick' | 'medium' | 'deep' | null;
  category: string | null;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  logs: HabitLog[];
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  status: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  targetEndDate: string | null;
  completed: boolean;
  phases: Phase[];
}

export interface Phase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  order: number;
  completed: boolean;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  order: number;
  completed: boolean;
  dueDate: string | null;
}

export interface Suggestion {
  type: string;
  message: string;
  id?: string;
}