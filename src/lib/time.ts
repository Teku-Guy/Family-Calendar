export type ISO = string;

export function toISO(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}
export function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
export function startOfWeek(d = new Date(), weekStartsOn = 0) {
  const x = startOfDay(d); const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7; x.setDate(x.getDate() - diff); return x;
}
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

export function startOfMonth(d = new Date()) {
  const x = startOfDay(d); x.setDate(1); return x;
}
export function addMonths(d: Date, n: number) {
  const x = new Date(d); x.setMonth(x.getMonth() + n); return x;
}
export function daysInMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth()+1, 0); return x.getDate();
}

export const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 → 22