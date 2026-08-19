import type { MachinaData } from "../types";

const now = new Date();
const deadlineOne = new Date(now);
deadlineOne.setDate(now.getDate() + 5);
const deadlineTwo = new Date(now);
deadlineTwo.setDate(now.getDate() + 9);

export const seedData: MachinaData = {
  seededAt: now.toISOString(),
  activeTimer: null,
  jobs: [
    {
      id: "job-042",
      number: "042",
      title: "Tuleje aluminiowe",
      client: "Kowalski",
      description: "Seria tulei aluminiowych, tolerancja kontrolowana po pierwszej operacji.",
      status: "active",
      deadline: deadlineOne.toISOString().slice(0, 10),
      estimatedMinutes: 330,
      createdAt: now.toISOString(),
    },
    {
      id: "job-041",
      number: "041",
      title: "Płyty montażowe",
      client: "Nowak Sp. z o.o.",
      description: "Płyty z kieszeniami i gwintowaniem, przygotowanie pod anodowanie.",
      status: "planned",
      deadline: deadlineTwo.toISOString().slice(0, 10),
      estimatedMinutes: 240,
      createdAt: now.toISOString(),
    },
  ],
  tasks: [
    {
      id: "task-042-1",
      jobId: "job-042",
      title: "Przygotowanie materiału",
      estimatedMinutes: 30,
      status: "done",
      position: 0,
      createdAt: now.toISOString(),
    },
    {
      id: "task-042-2",
      jobId: "job-042",
      title: "Ustawienie CNC",
      estimatedMinutes: 60,
      status: "done",
      position: 1,
      createdAt: now.toISOString(),
    },
    {
      id: "task-042-3",
      jobId: "job-042",
      title: "Frezowanie operacja 1",
      estimatedMinutes: 180,
      status: "todo",
      position: 2,
      createdAt: now.toISOString(),
    },
    {
      id: "task-042-4",
      jobId: "job-042",
      title: "Kontrola wymiarów",
      estimatedMinutes: 60,
      status: "todo",
      position: 3,
      createdAt: now.toISOString(),
    },
    {
      id: "task-041-1",
      jobId: "job-041",
      title: "Programowanie ścieżek",
      estimatedMinutes: 70,
      status: "todo",
      position: 0,
      createdAt: now.toISOString(),
    },
    {
      id: "task-041-2",
      jobId: "job-041",
      title: "Frezowanie kieszeni",
      estimatedMinutes: 170,
      status: "todo",
      position: 1,
      createdAt: now.toISOString(),
    },
  ],
  sessions: [
    {
      id: "session-042-1",
      taskId: "task-042-1",
      startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 12).toISOString(),
      stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 37).toISOString(),
      durationSeconds: 25 * 60,
    },
    {
      id: "session-042-2",
      taskId: "task-042-2",
      startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 3).toISOString(),
      stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 45).toISOString(),
      durationSeconds: 42 * 60,
    },
  ],
};
