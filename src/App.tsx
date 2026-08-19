import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ActiveTimer, Job, JobStatus, MachinaData, Task, TaskStatus, TimeSession } from "./types";
import { sortTasks } from "./data/normalizeData";
import { createId, localRepository, nextJobNumber } from "./data/localRepository";
import { isSupabaseConfigured } from "./data/supabaseClient";
import { loadSupabaseData, saveSupabaseData, subscribeToSupabaseChanges } from "./data/supabaseRepository";
import { useNow } from "./hooks/useNow";
import { dateShort, inputToMinutes, isToday, minutesToLabel, secondsToClock, secondsToShort, timeRange } from "./utils/time";

type View = "jobs" | "today" | "time" | "completed";

interface JobDraft {
  title: string;
  client: string;
  description: string;
  estimatedTime: string;
  deadline: string;
}

interface TaskDraft {
  title: string;
  estimatedTime: string;
}

const emptyJobDraft: JobDraft = {
  title: "",
  client: "",
  description: "",
  estimatedTime: "",
  deadline: "",
};

const emptyTaskDraft: TaskDraft = {
  title: "",
  estimatedTime: "",
};

const defaultTaskTemplates: TaskDraft[] = [
  { title: "zamówienie materiału", estimatedTime: "" },
  { title: "programowanie", estimatedTime: "" },
  { title: "obróbka", estimatedTime: "" },
  { title: "kontrola wymiarowa", estimatedTime: "" },
];

const statusLabels: Record<JobStatus, string> = {
  active: "Aktywne",
  planned: "Planowane",
  completed: "Zakończone",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "Oczekuje",
  "in-progress": "W toku",
  done: "Gotowe",
};

function App() {
  const [data, setData] = useState<MachinaData>(() => localRepository.load());
  const [view, setView] = useState<View>("jobs");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobModalOpen, setJobModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "Supabase / łączenie" : "Lokalnie / zapisano");
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured);
  const applyingRemote = useRef(false);
  const saveTimeout = useRef<number | null>(null);
  const reloadTimeout = useRef<number | null>(null);
  const now = useNow();

  useEffect(() => {
    localRepository.save(data);
    if (!isSupabaseConfigured || !remoteReady || applyingRemote.current) return;

    setSyncStatus("Supabase / zapisuję");
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(() => {
      saveSupabaseData(data)
        .then(() => setSyncStatus("Supabase / zapisano"))
        .catch(() => setSyncStatus("Supabase / błąd zapisu"));
    }, 250);

    return () => {
      if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    };
  }, [data, remoteReady]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    setSyncStatus("Supabase / ładowanie");
    loadSupabaseData()
      .then((remoteData) => {
        if (cancelled) return;
        applyingRemote.current = true;
        setData(remoteData);
        localRepository.save(remoteData);
        setRemoteReady(true);
        setSyncStatus("Supabase / zapisano");
        window.setTimeout(() => {
          applyingRemote.current = false;
        }, 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteReady(false);
        setSyncStatus("Lokalnie / błąd Supabase");
      });

    const unsubscribe = subscribeToSupabaseChanges(() => {
      if (applyingRemote.current) return;
      if (reloadTimeout.current) window.clearTimeout(reloadTimeout.current);
      reloadTimeout.current = window.setTimeout(() => {
        setSyncStatus("Supabase / odświeżanie");
        loadSupabaseData()
          .then((remoteData) => {
            applyingRemote.current = true;
            setData(remoteData);
            localRepository.save(remoteData);
            setSyncStatus("Supabase / zapisano");
            window.setTimeout(() => {
              applyingRemote.current = false;
            }, 0);
          })
          .catch(() => setSyncStatus("Supabase / błąd odczytu"));
      }, 350);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (reloadTimeout.current) window.clearTimeout(reloadTimeout.current);
    };
  }, []);

  const selectedJob = selectedJobId ? data.jobs.find((job) => job.id === selectedJobId) ?? null : null;
  const activeContext = useMemo(() => getActiveContext(data), [data]);

  function updateData(updater: (current: MachinaData) => MachinaData) {
    setData((current) => updater(current));
  }

  function createJob(draft: JobDraft) {
    const title = draft.title.trim();
    if (!title) return false;

    const createdAt = new Date();
    const job: Job = {
      id: createId("job"),
      number: nextJobNumber(data.jobs),
      title,
      client: draft.client.trim(),
      description: draft.description.trim(),
      status: "active",
      deadline: draft.deadline,
      estimatedMinutes: inputToMinutes(draft.estimatedTime),
      createdAt: createdAt.toISOString(),
    };
    const defaultTasks = createDefaultTasks(job.id, createdAt);

    updateData((current) => ({ ...current, jobs: [job, ...current.jobs], tasks: [...current.tasks, ...defaultTasks] }));
    setSelectedJobId(null);
    setView("jobs");
    return true;
  }

  function updateJob(jobId: string, draft: JobDraft) {
    const title = draft.title.trim();
    if (!title) return false;

    updateData((current) => ({
      ...current,
      jobs: current.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              title,
              client: draft.client.trim(),
              description: draft.description.trim(),
              deadline: draft.deadline,
              estimatedMinutes: inputToMinutes(draft.estimatedTime),
            }
          : job
      ),
    }));
    return true;
  }

  function createTask(jobId: string, draft: TaskDraft) {
    const title = draft.title.trim();
    if (!title) return false;

    updateData((current) => {
      const task: Task = {
        id: createId("task"),
        jobId,
        title,
        estimatedMinutes: inputToMinutes(draft.estimatedTime),
        status: "todo",
        position: getNextTaskPosition(current.tasks, jobId),
        createdAt: new Date().toISOString(),
      };

      return { ...current, tasks: [...current.tasks, task] };
    });
    return true;
  }

  function updateTask(taskId: string, draft: TaskDraft) {
    const title = draft.title.trim();
    if (!title) return false;

    updateData((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title,
              estimatedMinutes: inputToMinutes(draft.estimatedTime),
            }
          : task
      ),
    }));
    return true;
  }

  function startTask(taskId: string) {
    updateData((current) => {
      const activeTimer: ActiveTimer = { taskId, startedAt: new Date().toISOString() };
      return {
        ...current,
        activeTimer,
        tasks: current.tasks.map((task) => ({
          ...task,
          status: task.id === taskId ? "in-progress" : task.status === "in-progress" ? "todo" : task.status,
        })),
      };
    });
  }

  function finishActiveSession(current: MachinaData): MachinaData {
    if (!current.activeTimer) return current;

    const stoppedAt = new Date();
    const startedAt = new Date(current.activeTimer.startedAt);
    const durationSeconds = Math.max(1, Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000));
    const session: TimeSession = {
      id: createId("session"),
      taskId: current.activeTimer.taskId,
      startedAt: startedAt.toISOString(),
      stoppedAt: stoppedAt.toISOString(),
      durationSeconds,
    };

    return {
      ...current,
      activeTimer: null,
      sessions: [...current.sessions, session],
      tasks: current.tasks.map((task) =>
        task.id === session.taskId ? { ...task, status: "todo" } : task
      ),
    };
  }

  function stopTask() {
    updateData((current) => finishActiveSession(current));
  }

  function completeTask(taskId: string) {
    updateData((current) => {
      const stopped = current.activeTimer?.taskId === taskId ? finishActiveSession(current) : current;
      return {
        ...stopped,
        tasks: stopped.tasks.map((task) => (task.id === taskId ? { ...task, status: "done" } : task)),
      };
    });
  }

  function reopenTask(taskId: string) {
    updateData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status: "todo" } : task)),
    }));
  }

  function moveTask(taskId: string, direction: -1 | 1) {
    updateData((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;

      const jobTasks = sortTasks(current.tasks.filter((item) => item.jobId === task.jobId));
      const currentIndex = jobTasks.findIndex((item) => item.id === taskId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= jobTasks.length) return current;

      const reordered = [...jobTasks];
      [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
      const positions = new Map(reordered.map((item, position) => [item.id, position]));

      return {
        ...current,
        tasks: current.tasks.map((item) =>
          positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item
        ),
      };
    });
  }

  function setJobStatus(jobId: string, status: JobStatus) {
    updateData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, status } : job)),
    }));
  }

  function closeJob(jobId: string) {
    updateData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, status: "completed" } : job)),
    }));
    setSelectedJobId(null);
    setView("completed");
  }

  function goToView(nextView: View) {
    setSelectedJobId(null);
    setView(nextView);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Główna nawigacja">
        <div className="brand">Machina</div>
        <nav className="side-nav">
          <NavButton active={view === "jobs"} label="Zlecenia" onClick={() => goToView("jobs")} />
          <NavButton active={view === "today"} label="Dzisiaj" onClick={() => goToView("today")} />
          <NavButton active={view === "time"} label="Czas" onClick={() => goToView("time")} />
          <NavButton active={view === "completed"} label="Zakończone" onClick={() => goToView("completed")} />
        </nav>
        <div className="sync-state">
          <span aria-hidden="true" />
          {syncStatus}
        </div>
      </aside>

      <main className="main">
        {(view === "jobs" || view === "completed") && selectedJob ? (
          <JobDetail
            job={selectedJob}
            tasks={sortTasks(data.tasks.filter((task) => task.jobId === selectedJob.id))}
            sessions={data.sessions}
            activeTimer={data.activeTimer}
            now={now}
            onBack={() => setSelectedJobId(null)}
            onCreateTask={(draft) => createTask(selectedJob.id, draft)}
            onStart={startTask}
            onStop={stopTask}
            onCompleteTask={completeTask}
            onReopenTask={reopenTask}
            onEditTask={(taskId) => setEditingTaskId(taskId)}
            onMoveTask={moveTask}
            onStatusChange={setJobStatus}
            onCloseJob={closeJob}
            onEdit={() => {
              setEditingJobId(selectedJob.id);
              setJobModalOpen(true);
            }}
          />
        ) : (
          <>
            {view === "jobs" && (
              <JobsView
                jobs={data.jobs.filter((job) => job.status !== "completed")}
                tasks={data.tasks}
                sessions={data.sessions}
                activeTimer={data.activeTimer}
                now={now}
                onNewJob={() => {
                  setEditingJobId(null);
                  setJobModalOpen(true);
                }}
                onOpenJob={(jobId) => setSelectedJobId(jobId)}
              />
            )}
            {view === "completed" && (
              <JobsView
                jobs={data.jobs.filter((job) => job.status === "completed")}
                tasks={data.tasks}
                sessions={data.sessions}
                activeTimer={data.activeTimer}
                now={now}
                title="Zakończone"
                emptyText="Brak zakończonych zleceń."
                onNewJob={() => {
                  setEditingJobId(null);
                  setJobModalOpen(true);
                }}
                onOpenJob={(jobId) => setSelectedJobId(jobId)}
              />
            )}
            {view === "today" && <TodayView data={data} />}
            {view === "time" && <TimeReport data={data} />}
          </>
        )}
      </main>

      <MobileNow activeContext={activeContext} activeTimer={data.activeTimer} now={now} onStop={stopTask} />
      <MobileNav view={view} setView={setView} clearDetail={() => setSelectedJobId(null)} />

      {activeContext && data.activeTimer && (
        <ActiveTimerBar context={activeContext} activeTimer={data.activeTimer} now={now} onStop={stopTask} />
      )}

      {isJobModalOpen && (
        <JobModal
          job={editingJobId ? data.jobs.find((job) => job.id === editingJobId) ?? null : null}
          onClose={() => {
            setEditingJobId(null);
            setJobModalOpen(false);
          }}
          onCreate={(draft) => {
            const created = createJob(draft);
            if (created) {
              setEditingJobId(null);
              setJobModalOpen(false);
            }
            return created;
          }}
          onUpdate={(jobId, draft) => {
            const updated = updateJob(jobId, draft);
            if (updated) {
              setEditingJobId(null);
              setJobModalOpen(false);
            }
            return updated;
          }}
        />
      )}

      {editingTaskId && (
        <TaskModal
          task={data.tasks.find((task) => task.id === editingTaskId) ?? null}
          onClose={() => setEditingTaskId(null)}
          onUpdate={(taskId, draft) => {
            const updated = updateTask(taskId, draft);
            if (updated) setEditingTaskId(null);
            return updated;
          }}
        />
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function NavButton({ active, label, onClick }: NavButtonProps) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-mark" aria-hidden="true" />
      {label}
    </button>
  );
}

interface JobsViewProps {
  jobs: Job[];
  tasks: Task[];
  sessions: TimeSession[];
  activeTimer: ActiveTimer | null;
  now: Date;
  title?: string;
  emptyText?: string;
  onNewJob: () => void;
  onOpenJob: (jobId: string) => void;
}

function JobsView({
  jobs,
  tasks,
  sessions,
  activeTimer,
  now,
  title = "Zlecenia",
  emptyText = "Brak zleceń. Utwórz pierwsze zlecenie, żeby zacząć pracę.",
  onNewJob,
  onOpenJob,
}: JobsViewProps) {
  return (
    <section className="work-view">
      <header className="page-head">
        <h1>{title}</h1>
        <button className="primary-button" onClick={onNewJob}>
          <span aria-hidden="true">+</span>
          Nowe zlecenie
        </button>
      </header>

      <div className="job-list" aria-label="Lista zleceń">
        <div className="job-list-head">
          <span>Zlecenie</span>
          <span>Klient</span>
          <span>Termin</span>
          <span>Plan</span>
          <span>Wykonano</span>
          <span>Postęp</span>
          <span>Status</span>
        </div>
        {jobs.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              tasks={tasks.filter((task) => task.jobId === job.id)}
              sessions={sessions}
              activeTimer={activeTimer}
              now={now}
              onOpen={() => onOpenJob(job.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface JobRowProps {
  job: Job;
  tasks: Task[];
  sessions: TimeSession[];
  activeTimer: ActiveTimer | null;
  now: Date;
  onOpen: () => void;
}

function JobRow({ job, tasks, sessions, activeTimer, now, onOpen }: JobRowProps) {
  const actualSeconds = getJobActualSeconds(job.id, tasks, sessions, activeTimer, now);
  const progress = job.estimatedMinutes ? Math.min(100, Math.round((actualSeconds / 60 / job.estimatedMinutes) * 100)) : 0;

  return (
    <button className="job-row" onClick={onOpen}>
      <span className="job-title">
        <strong>#{job.number} · {job.title}</strong>
        <small>{job.description || "Bez opisu"}</small>
      </span>
      <span>{job.client || "Bez klienta"}</span>
      <span>Termin {dateShort(job.deadline)}</span>
      <span>{minutesToLabel(job.estimatedMinutes)}</span>
      <span>{secondsToShort(actualSeconds)}</span>
      <span className="progress-cell">
        <span>{progress}%</span>
        <span className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </span>
      </span>
      <span className={`status status-${job.status}`}>{statusLabels[job.status]}</span>
    </button>
  );
}

interface JobDetailProps {
  job: Job;
  tasks: Task[];
  sessions: TimeSession[];
  activeTimer: ActiveTimer | null;
  now: Date;
  onBack: () => void;
  onCreateTask: (draft: TaskDraft) => boolean;
  onStart: (taskId: string) => void;
  onStop: () => void;
  onCompleteTask: (taskId: string) => void;
  onReopenTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onMoveTask: (taskId: string, direction: -1 | 1) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onCloseJob: (jobId: string) => void;
  onEdit: () => void;
}

function JobDetail({
  job,
  tasks,
  sessions,
  activeTimer,
  now,
  onBack,
  onCreateTask,
  onStart,
  onStop,
  onCompleteTask,
  onReopenTask,
  onEditTask,
  onMoveTask,
  onStatusChange,
  onCloseJob,
  onEdit,
}: JobDetailProps) {
  const actualSeconds = getJobActualSeconds(job.id, tasks, sessions, activeTimer, now);
  const activeTaskBelongsToJob = tasks.some((task) => task.id === activeTimer?.taskId);
  const canCloseJob = tasks.length > 0 && tasks.every((task) => task.status === "done") && !activeTaskBelongsToJob;

  return (
    <section className="detail-view">
      <header className="detail-head">
        <div>
          <button className="back-button" onClick={onBack}>← Zlecenia</button>
          <p className="job-number">#{job.number}</p>
          <h1>{job.title}</h1>
          <p>{job.client || "Bez klienta"}</p>
        </div>
        <div className="detail-totals">
          <span>Plan <strong>{minutesToLabel(job.estimatedMinutes)}</strong></span>
          <span>Wykonano <strong>{secondsToShort(actualSeconds)}</strong></span>
          <button className="secondary-button compact-button" onClick={onEdit}>Edytuj</button>
          {job.status === "completed" ? (
            <span className="readonly-status">Status <strong>Zakończone</strong></span>
          ) : (
            <label>
              Status
              <select value={job.status} onChange={(event) => onStatusChange(job.id, event.target.value as JobStatus)}>
                <option value="active">Aktywne</option>
                <option value="planned">Planowane</option>
              </select>
            </label>
          )}
        </div>
      </header>

      <div className="task-list">
        <div className="task-list-head">
          <span>Czynność</span>
          <span>Plan</span>
          <span>Wykonano</span>
          <span>Status</span>
          <span>Akcja</span>
        </div>
        {tasks.map((task, index) => {
          const isActive = activeTimer?.taskId === task.id;
          const elapsedSeconds = getTaskActualSeconds(task.id, sessions, activeTimer, now);
          return (
            <div className={`task-row ${isActive ? "is-active" : ""}`} key={task.id}>
              <span className="task-main">
                <span className="task-order-controls" aria-label={`Kolejność czynności: ${task.title}`}>
                  <button
                    type="button"
                    className="order-button"
                    disabled={index === 0}
                    onClick={() => onMoveTask(task.id, -1)}
                    aria-label="Przesuń czynność wyżej"
                    title="Przesuń wyżej"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="order-button"
                    disabled={index === tasks.length - 1}
                    onClick={() => onMoveTask(task.id, 1)}
                    aria-label="Przesuń czynność niżej"
                    title="Przesuń niżej"
                  >
                    ↓
                  </button>
                </span>
                <span className="task-title-copy">
                  <strong>{task.title}</strong>
                  <small>{task.estimatedMinutes ? `Plan: ${minutesToLabel(task.estimatedMinutes)}` : "Plan: brak"}</small>
                </span>
              </span>
              <span>{minutesToLabel(task.estimatedMinutes)}</span>
              <span>{secondsToShort(elapsedSeconds)}</span>
              <span className={`task-status task-${isActive ? "in-progress" : task.status}`}>
                {isActive ? "W toku" : taskStatusLabels[task.status]}
              </span>
              {isActive ? (
                <button className="stop-button" onClick={onStop}>STOP</button>
              ) : task.status === "done" ? (
                <div className="task-actions single-action">
                  <button className="secondary-button task-done-button" onClick={() => onReopenTask(task.id)}>Otwórz</button>
                  <button className="secondary-button task-edit-button" onClick={() => onEditTask(task.id)}>Edytuj</button>
                </div>
              ) : (
                <div className="task-actions">
                  <button className="start-button" onClick={() => onStart(task.id)}>START</button>
                  <button className="secondary-button task-done-button" onClick={() => onCompleteTask(task.id)}>Zakończ</button>
                  <button className="secondary-button task-edit-button" onClick={() => onEditTask(task.id)}>Edytuj</button>
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && <div className="empty-state">Dodaj pierwszą czynność dla tego zlecenia.</div>}
      </div>

      {job.status !== "completed" && (
        <div className="close-job-panel">
          <div>
            <strong>{canCloseJob ? "Wszystkie czynności zakończone" : "Zamknięcie zlecenia"}</strong>
            <span>
              {canCloseJob
                ? "Możesz zamknąć zlecenie i przenieść je do zakończonych."
                : "Najpierw zakończ wszystkie czynności."}
            </span>
          </div>
          <button className="primary-button close-job-button" disabled={!canCloseJob} onClick={() => onCloseJob(job.id)}>
            Zamknij zlecenie
          </button>
        </div>
      )}

      <AddTaskForm onCreate={onCreateTask} />
    </section>
  );
}

function TaskModal({
  task,
  onClose,
  onUpdate,
}: {
  task: Task | null;
  onClose: () => void;
  onUpdate: (taskId: string, draft: TaskDraft) => boolean;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task
      ? {
          title: task.title,
          estimatedTime: `${task.estimatedMinutes} min`,
        }
      : emptyTaskDraft
  );
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!task) return;
    if (!draft.title.trim()) {
      setError("Podaj nazwę czynności.");
      return;
    }
    if (onUpdate(task.id, draft)) setError("");
  }

  if (!task) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="job-modal task-modal" onSubmit={submit} aria-label="Edytuj czynność">
        <header>
          <h2>Edytuj czynność</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">×</button>
        </header>
        <label>
          Nazwa czynności *
          <input
            autoFocus
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label>
          Planowany czas
          <input
            value={draft.estimatedTime}
            onChange={(event) => setDraft({ ...draft, estimatedTime: event.target.value })}
            placeholder="np. 60 min"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width">Zapisz czynność</button>
      </form>
    </div>
  );
}

function AddTaskForm({ onCreate }: { onCreate: (draft: TaskDraft) => boolean }) {
  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError("Podaj nazwę czynności.");
      return;
    }
    if (onCreate(draft)) {
      setDraft(emptyTaskDraft);
      setError("");
    }
  }

  return (
    <form className="add-task" onSubmit={submit}>
      <div>
        <h2>Dodaj czynność</h2>
        {error && <p className="form-error">{error}</p>}
      </div>
      <input
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        placeholder="Nazwa czynności *"
        aria-label="Nazwa czynności"
      />
      <input
        value={draft.estimatedTime}
        onChange={(event) => setDraft({ ...draft, estimatedTime: event.target.value })}
        placeholder="Planowany czas, np. 60 min"
        aria-label="Planowany czas"
      />
      <button className="secondary-button">Dodaj</button>
    </form>
  );
}

function JobModal({
  job,
  onClose,
  onCreate,
  onUpdate,
}: {
  job: Job | null;
  onClose: () => void;
  onCreate: (draft: JobDraft) => boolean;
  onUpdate: (jobId: string, draft: JobDraft) => boolean;
}) {
  const [draft, setDraft] = useState<JobDraft>(() =>
    job
      ? {
          title: job.title,
          client: job.client,
          description: job.description,
          estimatedTime: `${job.estimatedMinutes} min`,
          deadline: job.deadline,
        }
      : emptyJobDraft
  );
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError("Podaj nazwę zlecenia.");
      return;
    }
    const saved = job ? onUpdate(job.id, draft) : onCreate(draft);
    if (saved) setError("");
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="job-modal" onSubmit={submit} aria-label="Nowe zlecenie">
        <header>
          <h2>{job ? "Edytuj zlecenie" : "Nowe zlecenie"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zamknij">×</button>
        </header>
        <label>
          Nazwa zlecenia *
          <input
            autoFocus
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label>
          Klient
          <input value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} />
        </label>
        <label>
          Opis
          <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            Planowany czas
            <input
              value={draft.estimatedTime}
              onChange={(event) => setDraft({ ...draft, estimatedTime: event.target.value })}
              placeholder="np. 2 h"
            />
          </label>
          <label>
            Termin
            <input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width">{job ? "Zapisz zmiany" : "Utwórz zlecenie"}</button>
      </form>
    </div>
  );
}

function ActiveTimerBar({
  context,
  activeTimer,
  now,
  onStop,
}: {
  context: { job: Job; task: Task };
  activeTimer: ActiveTimer;
  now: Date;
  onStop: () => void;
}) {
  const seconds = Math.floor((now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000);
  return (
    <div className="timer-bar" role="status">
      <div>
        <strong>{context.job.title}</strong>
        <span>{context.task.title}</span>
      </div>
      <time>{secondsToClock(seconds)}</time>
      <button className="stop-outline" onClick={onStop}>STOP</button>
    </div>
  );
}

function MobileNow({
  activeContext,
  activeTimer,
  now,
  onStop,
}: {
  activeContext: { job: Job; task: Task } | null;
  activeTimer: ActiveTimer | null;
  now: Date;
  onStop: () => void;
}) {
  if (!activeContext || !activeTimer) return null;
  const seconds = Math.floor((now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000);
  return (
    <section className="mobile-now" aria-label="Teraz robię">
      <p>Teraz robię</p>
      <h2>{activeContext.job.title}</h2>
      <span>{activeContext.task.title}</span>
      <time>{secondsToClock(seconds)}</time>
      <button onClick={onStop}>STOP</button>
    </section>
  );
}

function MobileNav({
  view,
  setView,
  clearDetail,
}: {
  view: View;
  setView: (view: View) => void;
  clearDetail: () => void;
}) {
  function go(next: View) {
    clearDetail();
    setView(next);
  }

  return (
    <nav className="mobile-nav" aria-label="Nawigacja dolna">
      <button className={view === "jobs" ? "active" : ""} onClick={() => go("jobs")}>Zlecenia</button>
      <button className={view === "today" ? "active" : ""} onClick={() => go("today")}>Dzisiaj</button>
      <button className={view === "time" ? "active" : ""} onClick={() => go("time")}>Czas</button>
    </nav>
  );
}

function TodayView({ data }: { data: MachinaData }) {
  const rows = data.sessions
    .filter((session) => isToday(session.stoppedAt))
    .map((session) => {
      const task = data.tasks.find((item) => item.id === session.taskId);
      const job = task ? data.jobs.find((item) => item.id === task.jobId) : undefined;
      return { session, task, job };
    })
    .filter((row) => row.task && row.job)
    .sort((a, b) => a.session.startedAt.localeCompare(b.session.startedAt));
  const total = rows.reduce((sum, row) => sum + row.session.durationSeconds, 0);

  return (
    <section className="simple-view">
      <header className="page-head">
        <h1>Dzisiaj</h1>
        <p>Dzisiaj: <strong>{secondsToShort(total)}</strong></p>
      </header>
      <div className="session-list">
        {rows.map(({ session, task, job }) => (
          <div className="session-row" key={session.id}>
            <time>{timeRange(session.startedAt, session.stoppedAt)}</time>
            <strong>{task!.title}</strong>
            <span>{job!.title}</span>
            <b>{secondsToShort(session.durationSeconds)}</b>
          </div>
        ))}
        {rows.length === 0 && <div className="empty-state">Brak zapisanych sesji dzisiaj.</div>}
      </div>
    </section>
  );
}

function TimeReport({ data }: { data: MachinaData }) {
  return (
    <section className="simple-view">
      <header className="page-head">
        <h1>Czas</h1>
      </header>
      <div className="report-table">
        <div className="report-head">
          <span>Zlecenie</span>
          <span>Plan</span>
          <span>Rzeczywisty</span>
          <span>Różnica</span>
        </div>
        {data.jobs.map((job) => {
          const tasks = data.tasks.filter((task) => task.jobId === job.id);
          const actualSeconds = getJobActualSeconds(job.id, tasks, data.sessions, data.activeTimer, new Date());
          const diffMinutes = Math.round(actualSeconds / 60) - job.estimatedMinutes;
          return (
            <div className="report-row" key={job.id}>
              <span>#{job.number} · {job.title}</span>
              <span>{minutesToLabel(job.estimatedMinutes)}</span>
              <span>{secondsToShort(actualSeconds)}</span>
              <span className={diffMinutes > 0 ? "over" : "under"}>
                {diffMinutes > 0 ? "+" : ""}{minutesToLabel(Math.abs(diffMinutes))}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function createDefaultTasks(jobId: string, jobCreatedAt: Date): Task[] {
  return defaultTaskTemplates.map((template, position) => ({
    id: createId("task"),
    jobId,
    title: template.title,
    estimatedMinutes: inputToMinutes(template.estimatedTime),
    status: "todo",
    position,
    createdAt: new Date(jobCreatedAt.getTime() + position).toISOString(),
  }));
}

function getNextTaskPosition(tasks: Task[], jobId: string): number {
  const jobTasks = tasks.filter((task) => task.jobId === jobId);
  if (jobTasks.length === 0) return 0;
  return Math.max(...jobTasks.map((task) => task.position)) + 1;
}

function getActiveContext(data: MachinaData): { job: Job; task: Task } | null {
  if (!data.activeTimer) return null;
  const task = data.tasks.find((item) => item.id === data.activeTimer?.taskId);
  const job = task ? data.jobs.find((item) => item.id === task.jobId) : undefined;
  return task && job ? { job, task } : null;
}

function getTaskActualSeconds(taskId: string, sessions: TimeSession[], activeTimer: ActiveTimer | null, now: Date): number {
  const stored = sessions
    .filter((session) => session.taskId === taskId)
    .reduce((sum, session) => sum + session.durationSeconds, 0);
  if (activeTimer?.taskId !== taskId) return stored;
  return stored + Math.max(0, Math.floor((now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000));
}

function getJobActualSeconds(
  jobId: string,
  tasks: Task[],
  sessions: TimeSession[],
  activeTimer: ActiveTimer | null,
  now: Date
): number {
  return tasks
    .filter((task) => task.jobId === jobId)
    .reduce((sum, task) => sum + getTaskActualSeconds(task.id, sessions, activeTimer, now), 0);
}

export default App;
