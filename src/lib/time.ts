export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function addDaysIso(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayOfWeekShort(dateStr: string): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date(`${dateStr}T00:00:00`).getDay()];
}

export function shortDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Monday of the week containing dateStr (weeks run Mon–Sun). */
export function startOfWeekIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0 = Sun .. 6 = Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(dateStr, offsetToMonday);
}

export function weekDatesIso(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
}

export function weekRangeLabel(weekStart: string): string {
  const end = addDaysIso(weekStart, 6);
  const s = new Date(`${weekStart}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getMonth() + 1}月${s.getDate()}日 〜 ${e.getDate()}日`;
  }
  return `${s.getMonth() + 1}月${s.getDate()}日 〜 ${e.getMonth() + 1}月${e.getDate()}日`;
}
