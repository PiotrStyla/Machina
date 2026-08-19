import type { RealtimeChannel } from "@supabase/supabase-js";
import { seedData } from "./seed";
import { normalizeData } from "./normalizeData";
import { supabase } from "./supabaseClient";
import type { Database } from "./database.types";
import type { ActiveTimer, Job, MachinaData, Task, TimeSession } from "../types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type SessionRow = Database["public"]["Tables"]["time_sessions"]["Row"];
type ActiveTimerRow = Database["public"]["Tables"]["active_timer"]["Row"];

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadSupabaseData(): Promise<MachinaData> {
  const client = requireClient();

  const [{ data: jobs, error: jobsError }, { data: tasks, error: tasksError }, { data: sessions, error: sessionsError }, {
    data: activeTimer,
    error: activeTimerError,
  }] = await Promise.all([
    client.from("jobs").select("*").order("created_at", { ascending: false }),
    client.from("tasks").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
    client.from("time_sessions").select("*").order("started_at", { ascending: true }),
    client.from("active_timer").select("*").eq("id", "current").maybeSingle(),
  ]);

  const error = jobsError ?? tasksError ?? sessionsError ?? activeTimerError;
  if (error) throw error;

  if (!jobs || jobs.length === 0) {
    const normalized = normalizeData(seedData);
    await saveSupabaseData(normalized);
    return normalized;
  }

  return normalizeData({
    seededAt: seedData.seededAt,
    jobs: jobs.map(fromJobRow),
    tasks: (tasks ?? []).map(fromTaskRow),
    sessions: (sessions ?? []).map(fromSessionRow),
    activeTimer: activeTimer ? fromActiveTimerRow(activeTimer) : null,
  });
}

export async function saveSupabaseData(data: MachinaData): Promise<void> {
  const client = requireClient();

  if (data.jobs.length > 0) {
    const { error } = await client.from("jobs").upsert(data.jobs.map(toJobRow), { onConflict: "id" });
    if (error) throw error;
  }

  if (data.tasks.length > 0) {
    const { error } = await client.from("tasks").upsert(data.tasks.map(toTaskRow), { onConflict: "id" });
    if (error) throw error;
  }

  if (data.sessions.length > 0) {
    const { error } = await client.from("time_sessions").upsert(data.sessions.map(toSessionRow), { onConflict: "id" });
    if (error) throw error;
  }

  if (data.activeTimer) {
    const { error } = await client.from("active_timer").upsert(toActiveTimerRow(data.activeTimer), { onConflict: "id" });
    if (error) throw error;
  } else {
    const { error } = await client.from("active_timer").delete().eq("id", "current");
    if (error) throw error;
  }
}

export function subscribeToSupabaseChanges(onChange: () => void): () => void {
  const client = requireClient();
  let channel: RealtimeChannel | null = client
    .channel("machina-workshop-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "time_sessions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "active_timer" }, onChange)
    .subscribe();

  return () => {
    if (channel) {
      client.removeChannel(channel);
      channel = null;
    }
  };
}

function toJobRow(job: Job): JobRow {
  return {
    id: job.id,
    number: job.number,
    title: job.title,
    client: job.client,
    description: job.description,
    status: job.status,
    deadline: job.deadline || null,
    estimated_minutes: job.estimatedMinutes,
    created_at: job.createdAt,
  };
}

function fromJobRow(row: JobRow): Job {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    client: row.client,
    description: row.description,
    status: row.status,
    deadline: row.deadline ?? "",
    estimatedMinutes: row.estimated_minutes,
    createdAt: row.created_at,
  };
}

function toTaskRow(task: Task): TaskRow {
  return {
    id: task.id,
    job_id: task.jobId,
    title: task.title,
    estimated_minutes: task.estimatedMinutes,
    status: task.status,
    position: task.position,
    created_at: task.createdAt,
  };
}

function fromTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    jobId: row.job_id,
    title: row.title,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toSessionRow(session: TimeSession): SessionRow {
  return {
    id: session.id,
    task_id: session.taskId,
    started_at: session.startedAt,
    stopped_at: session.stoppedAt,
    duration_seconds: session.durationSeconds,
  };
}

function fromSessionRow(row: SessionRow): TimeSession {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    durationSeconds: row.duration_seconds,
  };
}

function toActiveTimerRow(activeTimer: ActiveTimer): ActiveTimerRow {
  return {
    id: "current",
    task_id: activeTimer.taskId,
    started_at: activeTimer.startedAt,
  };
}

function fromActiveTimerRow(row: ActiveTimerRow): ActiveTimer {
  return {
    taskId: row.task_id,
    startedAt: row.started_at,
  };
}
