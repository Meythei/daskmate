export interface AuthProfile {
  email: string;
  name: string;
  picture: string;
  uid: string;
}

export interface EventTemplate {
  id: string;
  title: string;
  color: string;
  duration_min: number;
}

export interface Settings {
  watched_senders: string[];
  work_start: string; // "HH:MM"
  work_end: string; // "HH:MM"
  poll_interval_sec: number;
  mail_watch_enabled: boolean;
  templates: EventTemplate[];
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // RFC3339
  end: string; // RFC3339
  color_id?: string | null;
}

export interface MailNotice {
  from: string;
  subject: string;
}
