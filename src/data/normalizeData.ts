import type { MachinaData, Task } from "../types";

export function normalizeData(data: MachinaData): MachinaData {
  return {
    ...data,
    tasks: normalizeTaskPositions(data.tasks),
  };
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.position - b.position ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

function normalizeTaskPositions(tasks: Task[]): Task[] {
  const grouped = new Map<string, Task[]>();

  tasks.forEach((task) => {
    const current = grouped.get(task.jobId) ?? [];
    current.push(task);
    grouped.set(task.jobId, current);
  });

  return [...grouped.values()].flatMap((jobTasks) =>
    sortTasks(
      jobTasks.map((task, index) => ({
        ...task,
        position: typeof task.position === "number" ? task.position : index,
      }))
    ).map((task, position) => ({ ...task, position }))
  );
}
