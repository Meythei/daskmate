import { config } from "../config";
import { invokeCmd } from "./tauri";
import type { AuthProfile, CalendarEvent, Settings } from "./types";

export const api = {
  startGoogleLogin: () =>
    invokeCmd<AuthProfile>("start_google_login", {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      firebaseApiKey: config.firebaseApiKey,
    }),

  checkStoredLogin: () => invokeCmd<AuthProfile | null>("check_stored_login"),

  logout: () => invokeCmd<void>("logout"),

  getSettings: () => invokeCmd<Settings>("get_settings"),

  saveSettings: (settings: Settings) => invokeCmd<void>("save_settings", { settings }),

  listCalendarEvents: (date: string) => invokeCmd<CalendarEvent[]>("list_calendar_events", { date }),

  listWeekEvents: (weekStart: string) => invokeCmd<CalendarEvent[]>("list_week_events", { weekStart }),

  quickFillTemplate: (date: string, templateId: string) =>
    invokeCmd<CalendarEvent[]>("quick_fill_template", { date, templateId }),

  deleteCalendarEvent: (eventId: string) => invokeCmd<void>("delete_calendar_event", { eventId }),

  pollMailNow: () => invokeCmd<void>("poll_mail_now"),
};
