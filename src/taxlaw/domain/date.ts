/**
 * asOf is a business calendar date, never a timestamp and never a DB snapshot
 * token (conflict-log A-07/A-08). Parsing stays purely lexical: no Date(),
 * no timezone conversion, so the value sent by the client is the value bound
 * into SQL.
 */
export type DateString = string;

const CALENDAR_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return isLeap ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** True only for a real calendar day in `YYYY-MM-DD` form. */
export function isCalendarDate(value: unknown): value is DateString {
    if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
        return false;
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    if (year < 1 || month < 1 || month > 12 || day < 1) {
        return false;
    }
    return day <= daysInMonth(year, month);
}

/**
 * Normalizes whatever the `date` column produced into `YYYY-MM-DD`.
 * The pool installs a raw text parser for OID 1082, so the string path is the
 * normal one; the Date branch only guards a pool built without that parser and
 * uses local getters to avoid shifting the day across a timezone.
 */
export function toDateString(value: unknown): DateString | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "string") {
        return isCalendarDate(value) ? value : null;
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        const year = String(value.getFullYear()).padStart(4, "0");
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    return null;
}
