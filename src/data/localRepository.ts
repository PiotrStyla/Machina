import { seedData } from "./seed";
import { normalizeData } from "./normalizeData";
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
      const normalized = normalizeData(seedData);
      this.save(normalized);
      return normalized;
    }

    try {
      const parsed = normalizeData(JSON.parse(stored) as MachinaData);
      this.save(parsed);
      return parsed;
    } catch {
      const normalized = normalizeData(seedData);
      this.save(normalized);
      return normalized;
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
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
