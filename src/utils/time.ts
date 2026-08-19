export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function secondsToClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function secondsToShort(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h) return `${h} h ${m.toString().padStart(2, "0")} min`;
  if (m) return `${m} min`;
  return `${s} s`;
}

export function inputToMinutes(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const hourMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);

  const minuteMatch = normalized.match(/^(\d+)\s*(m|min)?$/i);
  if (minuteMatch) return Number(minuteMatch[1]);

  const decimalHours = Number(normalized);
  return Number.isFinite(decimalHours) ? Math.round(decimalHours * 60) : 0;
}

export function dateShort(dateValue: string): string {
  if (!dateValue) return "Brak terminu";
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(dateValue));
}

export function timeRange(startedAt: string, stoppedAt: string): string {
  const formatter = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(startedAt))}-${formatter.format(new Date(stoppedAt))}`;
}

export function isToday(dateValue: string, now = new Date()): boolean {
  const date = new Date(dateValue);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
