import { seedData } from "./seed";
import type { ActiveTimer, Job, MachinaData, Task, TimeSession } from "../types";

const STORAGE_KEY = "machina.local.v1";

export interface MachinaRepository {
  load(): MachinaData;
  save(data: MachinaData): void;
}

export const localRepository: MachinaRepository = {
  load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      this.save(seedData);
      return seedData;
    }

    try {
      return JSON.parse(stored) as MachinaData;
    } catch {
      this.save(seedData);
      return seedData;
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};

export function createId(prefix: string): string {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nextJobNumber(jobs: Job[]): string {
  const max = jobs.reduce((highest, job) => Math.max(highest, Number(job.number) || 0), 0);
  return String(max + 1).padStart(3, "0");
}

export type StoredEntity = Job | Task | TimeSession | ActiveTimer;
