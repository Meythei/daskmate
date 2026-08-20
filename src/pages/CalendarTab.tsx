import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { eventColor } from "../lib/colors";
import {
  addDaysIso,
  dayOfWeekShort,
  minutesSinceMidnight,
  parseHHMM,
  shortDateLabel,
  startOfWeekIso,
  timeLabel,
  todayIso,
  weekDatesIso,
  weekRangeLabel,
} from "../lib/time";
import type { CalendarEvent } from "../lib/types";
import { useSettings } from "../state/SettingsContext";

const PX_PER_MIN = 1.5;
const ROW_MIN = 30;
const AXIS_WIDTH = 48;
const COL_MIN_WIDTH = 128;

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function CalendarTab() {
  const { settings } = useSettings();
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(startOfWeekIso(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const weekDates = useMemo(() => weekDatesIso(weekStart), [weekStart]);

  const refresh = async () => {
    setLoading(true);
    try {
      const evs = await api.listWeekEvents(weekStart);
      setEvents(evs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const d of weekDates) map[d] = [];
    for (const ev of events) {
      const k = dateKey(ev.start);
      if (map[k]) map[k].push(ev);
    }
    return map;
  }, [events, weekDates]);

  const workStartMin = parseHHMM(settings?.work_start ?? "09:00");
  const workEndMin = parseHHMM(settings?.work_end ?? "18:00");
  const totalMin = Math.max(workEndMin - workStartMin, ROW_MIN);
  const gridHeight = totalMin * PX_PER_MIN;

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = Math.ceil(workStartMin / 60) * 60; m <= workEndMin; m += 60) marks.push(m);
    return marks;
  }, [workStartMin, workEndMin]);

  const goWeek = (delta: number) => setWeekStart((w) => addDaysIso(w, delta * 7));
  const goToday = () => {
    setWeekStart(startOfWeekIso(today));
    setSelectedDate(today);
  };

  const handleQuickFill = async (templateId: string) => {
    setErr(null);
    setFillingId(templateId);
    try {
      const updated = await api.quickFillTemplate(selectedDate, templateId);
      await refresh();
      if (updated[0]) {
        setJustUpdated(updated[0].id);
        setTimeout(() => setJustUpdated(null), 900);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFillingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteCalendarEvent(id);
    } catch {
      refresh();
    }
  };

  const findTemplateColor = (summary: string) =>
    settings?.templates.find((t) => t.title === summary)?.color;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goWeek(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-dim transition-colors hover:border-border-hi hover:text-ink"
          >
            ‹
          </button>
          <div className="min-w-[170px] text-center text-sm font-semibold">{weekRangeLabel(weekStart)}</div>
          <button
            onClick={() => goWeek(1)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-dim transition-colors hover:border-border-hi hover:text-ink"
          >
            ›
          </button>
          {weekStart !== startOfWeekIso(today) && (
            <button
              onClick={goToday}
              className="ml-1 rounded-lg border border-border px-2.5 py-1 text-xs text-ink-dim transition-colors hover:border-border-hi hover:text-ink"
            >
              今週
            </button>
          )}
        </div>
        <div className="text-xs text-ink-faint">
          標準出勤時間 {settings?.work_start}–{settings?.work_end}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-faint">
          {shortDateLabel(selectedDate)}（{dayOfWeekShort(selectedDate)}）に追加:
        </span>
        {(settings?.templates ?? []).map((tpl) => (
          <motion.button
            key={tpl.id}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            disabled={fillingId !== null}
            onClick={() => handleQuickFill(tpl.id)}
            className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
            style={{
              borderColor: `${tpl.color}55`,
              backgroundColor: `${tpl.color}1a`,
              color: tpl.color,
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tpl.color }} />
            {tpl.title}
            <span className="text-[10px] opacity-60">{tpl.duration_min}分</span>
            {fillingId === tpl.id && (
              <motion.span
                className="h-3 w-3 rounded-full border-2 border-current/30 border-t-current"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
              />
            )}
          </motion.button>
        ))}
        {(settings?.templates ?? []).length === 0 && (
          <p className="text-xs text-ink-faint">設定タブでよく使う予定テンプレートを追加できます。</p>
        )}
      </div>

      <AnimatePresence>
        {err && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad"
          >
            {err}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1 overflow-auto rounded-2xl border border-border bg-surface/50">
        {loading && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-surface/40">
            <motion.span
              className="h-5 w-5 rounded-full border-2 border-border-hi border-t-brand-2"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
            />
          </div>
        )}
        <div style={{ minWidth: AXIS_WIDTH + COL_MIN_WIDTH * 7 }}>
          {/* Day header row */}
          <div
            className="sticky top-0 z-20 grid border-b border-border bg-surface/95 backdrop-blur-sm"
            style={{ gridTemplateColumns: `${AXIS_WIDTH}px repeat(7, 1fr)` }}
          >
            <div />
            {weekDates.map((d) => {
              const isToday = d === today;
              const isSelected = d === selectedDate;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className="relative flex flex-col items-center gap-0.5 border-l border-border/60 px-1 py-2 transition-colors hover:bg-overlay/5"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="week-day-selected"
                      className="absolute inset-x-1 inset-y-1 rounded-lg bg-gradient-to-br from-brand-1/25 to-brand-2/25"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={`relative z-10 text-[11px] ${isToday ? "text-brand-2 font-semibold" : "text-ink-faint"}`}>
                    {dayOfWeekShort(d)}
                  </span>
                  <span className={`relative z-10 text-sm font-semibold ${isToday ? "text-ink" : "text-ink-dim"}`}>
                    {shortDateLabel(d)}
                  </span>
                  {isToday && <span className="relative z-10 h-1 w-1 rounded-full bg-brand-2" />}
                </button>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative grid" style={{ gridTemplateColumns: `${AXIS_WIDTH}px repeat(7, 1fr)`, height: gridHeight + 16 }}>
            <div className="relative">
              {hourMarks.map((m) => (
                <div
                  key={m}
                  className="absolute right-2 text-right text-[10px] text-ink-faint"
                  style={{ top: (m - workStartMin) * PX_PER_MIN + 4 }}
                >
                  {String(Math.floor(m / 60)).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {weekDates.map((d) => {
              const isToday = d === today;
              return (
                <div key={d} className={`relative border-l border-border/50 ${isToday ? "bg-overlay/[0.03]" : ""}`}>
                  {hourMarks.map((m) => (
                    <div
                      key={m}
                      className="absolute left-0 right-0 border-t border-border/40"
                      style={{ top: (m - workStartMin) * PX_PER_MIN + 4 }}
                    />
                  ))}

                  <AnimatePresence>
                    {!loading &&
                      eventsByDate[d]?.map((ev) => {
                        const start = Math.max(minutesSinceMidnight(ev.start), workStartMin);
                        const end = Math.min(minutesSinceMidnight(ev.end), workEndMin);
                        if (end <= start) return null;
                        const top = (start - workStartMin) * PX_PER_MIN + 4;
                        const height = Math.max((end - start) * PX_PER_MIN - 3, 18);
                        const color = findTemplateColor(ev.summary) ?? eventColor(ev.color_id);
                        const pulsing = ev.id === justUpdated;
                        return (
                          <motion.div
                            key={ev.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{
                              opacity: 1,
                              scale: pulsing ? [1, 1.04, 1] : 1,
                              boxShadow: pulsing
                                ? [
                                    "0 0 0 0 rgba(161,161,170,0)",
                                    "0 0 0 5px rgba(161,161,170,0.35)",
                                    "0 0 0 0 rgba(161,161,170,0)",
                                  ]
                                : "0 0 0 0 rgba(0,0,0,0)",
                            }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className="group absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[11px]"
                            style={{
                              top,
                              height,
                              backgroundColor: `${color}22`,
                              borderColor: `${color}55`,
                              borderLeftWidth: 3,
                              borderLeftColor: color,
                            }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="truncate font-semibold leading-tight" style={{ color }}>
                                  {ev.summary}
                                </p>
                                {height > 30 && (
                                  <p className="truncate text-[9px] text-ink-faint">
                                    {timeLabel(ev.start)}–{timeLabel(ev.end)}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDelete(ev.id)}
                                className="shrink-0 text-[10px] text-ink-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
                                aria-label="削除"
                              >
                                ✕
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
