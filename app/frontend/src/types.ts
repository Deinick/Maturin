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
  difficulty: 'easy' | 'medium' | 'hard';
  activeDays: string;
  createdAt: string;
  logs: HabitLog[];
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  status: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'contributor' | 'viewer';
  canApprove: boolean;
  joinedAt: string;
  user: { id: string; name: string; email: string };
}

export interface PendingChange {
  id: string;
  projectId: string;
  entityType: 'project' | 'phase' | 'milestone';
  entityId: string;
  entityLabel: string;
  oldData: Record<string, string | null>;
  newData: Record<string, string | null>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  author: { id: string; name: string };
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  targetEndDate: string | null;
  completed: boolean;
  phases: Phase[];
  members?: ProjectMember[];
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
  assignees: { id: string; name: string; email: string }[];
  title: string;
  description: string | null;
  order: number;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  effortRating: 'easier' | 'as_expected' | 'harder' | null;
  blockReason: 'no_time' | 'unclear' | 'external' | 'motivation' | null;
}

export interface MemberPerformance {
  userId: string;
  name: string;
  email: string;
  role: string;
  canApprove: boolean;
  assigned: number;
  completed: number;
  completedOnTime: number;
  completedLate: number;
  overdue: number;
  pending: number;
  avgDaysLate: number;
  score: number;
}

export interface Suggestion {
  type: string;
  message: string;
  id?: string;
}