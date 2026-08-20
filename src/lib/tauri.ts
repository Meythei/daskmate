import type { AuthProfile, CalendarEvent, EventTemplate, MailNotice, Settings } from "./types";

// When this app is opened as a plain web page (e.g. `vite dev` in a browser,
// used only to preview/design the UI) there is no Tauri runtime backing the
// `invoke`/`listen` calls. This module transparently falls back to an
// in-memory mock so the interface can still be exercised end to end.
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const defaultTemplates: EventTemplate[] = [
  { id: "tpl-meeting", title: "定例MTG", color: "#d4d4d8", duration_min: 30 },
  { id: "tpl-focus", title: "集中作業", color: "#71717a", duration_min: 60 },
  { id: "tpl-review", title: "レビュー", color: "#3f3f46", duration_min: 30 },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function isoAt(dateStr: string, hh: number, mm: number) {
  return `${dateStr}T${pad(hh)}:${pad(mm)}:00`;
}

class MockBackend {
  loggedIn = false;
  profile: AuthProfile = {
    email: "you@example.com",
    name: "山田 太郎",
    picture: "",
    uid: "mock-uid",
  };
  settings: Settings = {
    watched_senders: ["boss@example.com", "client@example.co.jp"],
    work_start: "09:00",
    work_end: "18:00",
    poll_interval_sec: 60,
    mail_watch_enabled: true,
    templates: defaultTemplates,
  };
  eventsByDate: Record<string, CalendarEvent[]> = {};
  seq = 100;

  seedIfNeeded(date: string) {
    if (this.eventsByDate[date]) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    if (date !== todayStr) {
      this.eventsByDate[date] = [];
      return;
    }
    this.eventsByDate[date] = [
      {
        id: "seed-1",
        summary: "朝会",
        start: isoAt(date, 9, 0),
        end: isoAt(date, 9, 30),
        color_id: "7",
      },
      {
        id: "seed-2",
        summary: "顧客MTG",
        start: isoAt(date, 13, 0),
        end: isoAt(date, 14, 0),
        color_id: "9",
      },
    ];
  }

  listEvents(date: string): CalendarEvent[] {
    this.seedIfNeeded(date);
    return [...this.eventsByDate[date]].sort((a, b) => a.start.localeCompare(b.start));
  }

  listWeekEvents(weekStart: string): CalendarEvent[] {
    const [y, m, d] = weekStart.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const all: CalendarEvent[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + i);
      const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      all.push(...this.listEvents(dateStr));
    }
    return all;
  }

  quickFill(date: string, templateId: string): CalendarEvent[] {
    this.seedIfNeeded(date);
    const tpl = this.settings.templates.find((t) => t.id === templateId);
    if (!tpl) throw new Error("テンプレートが見つかりません");

    const [wsH, wsM] = this.settings.work_start.split(":").map(Number);
    const [weH, weM] = this.settings.work_end.split(":").map(Number);
    const dayStart = new Date(`${date}T${pad(wsH)}:${pad(wsM)}:00`);
    const dayEnd = new Date(`${date}T${pad(weH)}:${pad(weM)}:00`);
    const stepMs = 30 * 60_000;
    const wantMs = tpl.duration_min * 60_000;

    const existing = this.eventsByDate[date];
    let cursor = dayStart.getTime();
    let foundStart: number | null = null;
    while (cursor + wantMs <= dayEnd.getTime()) {
      const slotEnd = cursor + wantMs;
      const overlaps = existing.some((e) => {
        const es = new Date(e.start).getTime();
        const ee = new Date(e.end).getTime();
        return es < slotEnd && cursor < ee;
      });
      if (!overlaps) {
        foundStart = cursor;
        break;
      }
      cursor += stepMs;
    }
    if (foundStart === null) throw new Error("空いている時間がありません");

    const start = foundStart;
    const end = start + wantMs;

    const prevIdx = existing.findIndex(
      (e) => e.summary === tpl.title && new Date(e.end).getTime() === start,
    );
    const nextIdx = existing.findIndex(
      (e) => e.summary === tpl.title && new Date(e.start).getTime() === end,
    );

    const toIso = (ms: number) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    };

    if (prevIdx >= 0 && nextIdx >= 0) {
      const prev = existing[prevIdx];
      const next = existing[nextIdx];
      prev.end = next.end;
      this.eventsByDate[date] = existing.filter((_, i) => i !== nextIdx);
      return [prev];
    }
    if (prevIdx >= 0) {
      existing[prevIdx].end = toIso(end);
      return [existing[prevIdx]];
    }
    if (nextIdx >= 0) {
      existing[nextIdx].start = toIso(start);
      return [existing[nextIdx]];
    }
    const created: CalendarEvent = {
      id: `mock-${this.seq++}`,
      summary: tpl.title,
      start: toIso(start),
      end: toIso(end),
      color_id: null,
    };
    existing.push(created);
    return [created];
  }

  deleteEvent(date: string, id: string) {
    this.eventsByDate[date] = (this.eventsByDate[date] ?? []).filter((e) => e.id !== id);
  }
}

const mock = new MockBackend();

type Handler = (payload: unknown) => void;
const mockListeners = new Map<string, Set<Handler>>();
function emitMock(event: string, payload: unknown) {
  mockListeners.get(event)?.forEach((cb) => cb(payload));
}

export async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }

  await new Promise((r) => setTimeout(r, 220 + Math.random() * 260));

  switch (cmd) {
    case "start_google_login":
      mock.loggedIn = true;
      return mock.profile as unknown as T;
    case "check_stored_login":
      return (mock.loggedIn ? mock.profile : null) as unknown as T;
    case "logout":
      mock.loggedIn = false;
      return undefined as unknown as T;
    case "get_settings":
      return mock.settings as unknown as T;
    case "save_settings":
      mock.settings = args?.settings as Settings;
      return undefined as unknown as T;
    case "list_calendar_events":
      return mock.listEvents(args?.date as string) as unknown as T;
    case "list_week_events":
      return mock.listWeekEvents(args?.weekStart as string) as unknown as T;
    case "quick_fill_template":
      return mock.quickFill(args?.date as string, args?.templateId as string) as unknown as T;
    case "delete_calendar_event": {
      const id = args?.eventId as string;
      for (const dateKey of Object.keys(mock.eventsByDate)) {
        mock.deleteEvent(dateKey, id);
      }
      return undefined as unknown as T;
    }
    case "poll_mail_now": {
      const notice: MailNotice = { from: "client@example.co.jp", subject: "【至急】見積もりの件" };
      setTimeout(() => emitMock("mail://new", notice), 400);
      return undefined as unknown as T;
    }
    default:
      throw new Error(`mock: unhandled command ${cmd}`);
  }
}

export async function listenEvent<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  if (isTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    const un = await listen<T>(event, (e) => cb(e.payload));
    return un;
  }
  const handler = (payload: unknown) => cb(payload as T);
  if (!mockListeners.has(event)) mockListeners.set(event, new Set());
  mockListeners.get(event)!.add(handler);
  return () => mockListeners.get(event)?.delete(handler);
}
