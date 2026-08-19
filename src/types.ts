export type JobStatus = "active" | "planned" | "completed";
export type TaskStatus = "todo" | "in-progress" | "done";

export interface Job {
  id: string;
  number: string;
  title: string;
  client: string;
  description: string;
  status: JobStatus;
  deadline: string;
  estimatedMinutes: number;
  createdAt: string;
}

export interface Task {
  id: string;
  jobId: string;
  title: string;
  estimatedMinutes: number;
  status: TaskStatus;
  position: number;
  createdAt: string;
}

export interface TimeSession {
  id: string;
  taskId: string;
  startedAt: string;
  stoppedAt: string;
  durationSeconds: number;
}

export interface ActiveTimer {
  taskId: string;
  startedAt: string;
}

export interface MachinaData {
  jobs: Job[];
  tasks: Task[];
  sessions: TimeSession[];
  activeTimer: ActiveTimer | null;
  seededAt: string;
}
