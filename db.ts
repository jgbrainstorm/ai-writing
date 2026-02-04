
import { WritingEvent } from './types';

const DB_KEY = 'writing_app_logs';

export const logEvent = (event: Omit<WritingEvent, 'event_start_time'>) => {
  const logs = getLogs();
  const newEvent: WritingEvent = {
    ...event,
    event_start_time: Date.now()
  };
  logs.push(newEvent);
  localStorage.setItem(DB_KEY, JSON.stringify(logs));
  console.debug('[Log Entry]', newEvent);
};

export const getLogs = (): WritingEvent[] => {
  const raw = localStorage.getItem(DB_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const clearLogs = () => {
  localStorage.removeItem(DB_KEY);
};

export const exportLogs = () => {
  const logs = getLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `writing_session_${Date.now()}.json`;
  a.click();
};
