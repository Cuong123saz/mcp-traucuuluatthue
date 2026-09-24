/**
 * Dates in the API are plain calendar strings (YYYY-MM-DD, no timezone).
 * They are never passed through `new Date(str)`: parsing as UTC and
 * formatting in local time shifts the day in negative-offset timezones.
 */
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return leap ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isCalendarDate(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const match = CALENDAR_DATE.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** "2026-01-31" -> "31/01/2026" by string split only. Caller validates first. */
export function formatCalendarDate(value: string): string {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

/** Today on the client's local calendar. Not toISOString(): that is UTC. */
export function localToday(now: Date = new Date()): string {
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
