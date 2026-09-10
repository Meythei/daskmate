import { invokeCmd } from "./tauri";
import type { AuthProfile, CalendarEvent, ChatSpace, Settings } from "./types";

export const api = {
  isConfigured: () => invokeCmd<boolean>("is_configured"),

  startGoogleLogin: () => invokeCmd<AuthProfile>("start_google_login"),

  checkStoredLogin: () => invokeCmd<AuthProfile | null>("check_stored_login"),

  logout: () => invokeCmd<void>("logout"),

  getSettings: () => invokeCmd<Settings>("get_settings"),

  saveSettings: (settings: Settings) => invokeCmd<void>("save_settings", { settings }),

  listCalendarEvents: (date: string) => invokeCmd<CalendarEvent[]>("list_calendar_events", { date }),

  listWeekEvents: (weekStart: string) => invokeCmd<CalendarEvent[]>("list_week_events", { weekStart }),

  quickFillTemplate: (date: string, templateId: string) =>
    invokeCmd<CalendarEvent[]>("quick_fill_template", { date, templateId }),

  deleteCalendarEvent: (eventId: string) => invokeCmd<void>("delete_calendar_event", { eventId }),

  listChatSpaces: () => invokeCmd<ChatSpace[]>("list_chat_spaces"),

  sendChatMessage: (spaceName: string, text: string) =>
    invokeCmd<void>("send_chat_message", { spaceName, text }),

  pollMailNow: () => invokeCmd<void>("poll_mail_now"),
};
