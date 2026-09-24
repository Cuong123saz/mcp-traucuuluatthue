import { invalidArgument, type DomainErrorDetail } from "../domain/errors.js";
import { isCalendarDate, type DateString } from "../domain/date.js";
import { PAGINATION_DEFAULTS, STRING_LIMITS } from "../domain/dto.js";

/**
 * Domain validation, applied by the Service so REST and MCP cannot drift.
 * Transport adapters do their own shape/parameter checks first, but they never
 * replace these rules.
 */

export interface ValidatedSearchInput {
    q: string;
    asOf: DateString;
    limit: number;
    offset: number;
}

export interface ValidatedProvisionInput {
    documentNumber: string;
    articleKey: string;
    asOf: DateString;
}

export interface RawSearchInput {
    q?: unknown;
    asOf?: unknown;
    limit?: unknown;
    offset?: unknown;
}

export interface RawProvisionInput {
    documentNumber?: unknown;
    articleKey?: unknown;
    asOf?: unknown;
}

class DetailCollector {
    readonly details: DomainErrorDetail[] = [];

    add(field: string, issue: string): void {
        this.details.push({ field, issue });
    }
}

export function validateSearchInput(raw: RawSearchInput): ValidatedSearchInput {
    const errors = new DetailCollector();

    const q = requireTrimmedString(raw.q, "q", STRING_LIMITS.qMin, STRING_LIMITS.qMax, errors);
    const asOf = requireCalendarDate(raw.asOf, "asOf", errors);
    const limit = optionalBoundedInteger(
        raw.limit,
        "limit",
        PAGINATION_DEFAULTS.minLimit,
        PAGINATION_DEFAULTS.maxLimit,
        PAGINATION_DEFAULTS.limit,
        errors
    );
    const offset = optionalBoundedInteger(
        raw.offset,
        "offset",
        0,
        Number.MAX_SAFE_INTEGER,
        PAGINATION_DEFAULTS.offset,
        errors
    );

    throwIfInvalid(errors);
    return { q: q as string, asOf: asOf as DateString, limit, offset };
}

export function validateProvisionInput(raw: RawProvisionInput): ValidatedProvisionInput {
    const errors = new DetailCollector();

    const documentNumber = requireTrimmedString(
        raw.documentNumber,
        "documentNumber",
        STRING_LIMITS.identifierMin,
        STRING_LIMITS.identifierMax,
        errors
    );
    const articleKey = requireTrimmedString(
        raw.articleKey,
        "articleKey",
        STRING_LIMITS.identifierMin,
        STRING_LIMITS.identifierMax,
        errors
    );
    const asOf = requireCalendarDate(raw.asOf, "asOf", errors);

    throwIfInvalid(errors);
    return {
        documentNumber: documentNumber as string,
        articleKey: articleKey as string,
        asOf: asOf as DateString
    };
}

function requireTrimmedString(
    value: unknown,
    field: string,
    min: number,
    max: number,
    errors: DetailCollector
): string | undefined {
    if (value === undefined || value === null) {
        errors.add(field, "Bắt buộc.");
        return undefined;
    }
    if (typeof value !== "string") {
        errors.add(field, "Phải là chuỗi.");
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length < min) {
        errors.add(field, "Không được để trống.");
        return undefined;
    }
    if (trimmed.length > max) {
        errors.add(field, `Tối đa ${max} ký tự.`);
        return undefined;
    }
    return trimmed;
}

/**
 * asOf is never defaulted to "today": a missing date is a client error
 * (api-contract.md "Quy ước dữ liệu"), not something the backend fills in.
 */
function requireCalendarDate(value: unknown, field: string, errors: DetailCollector): DateString | undefined {
    if (value === undefined || value === null || value === "") {
        errors.add(field, "Bắt buộc, định dạng YYYY-MM-DD.");
        return undefined;
    }
    if (typeof value !== "string") {
        errors.add(field, "Phải là chuỗi ngày YYYY-MM-DD.");
        return undefined;
    }
    if (!isCalendarDate(value)) {
        errors.add(field, "Không phải ngày lịch hợp lệ (YYYY-MM-DD).");
        return undefined;
    }
    return value;
}

/**
 * Accepts a JSON integer or the decimal string a query string produces.
 * Floats, exponent forms, empty strings and out-of-range values are rejected
 * rather than coerced.
 */
function optionalBoundedInteger(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
    errors: DetailCollector
): number {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    let parsed: number;
    if (typeof value === "number") {
        parsed = value;
    } else if (typeof value === "string") {
        if (!/^-?[0-9]+$/.test(value.trim())) {
            errors.add(field, "Phải là số nguyên.");
            return fallback;
        }
        parsed = Number(value.trim());
    } else {
        errors.add(field, "Phải là số nguyên.");
        return fallback;
    }

    if (!Number.isInteger(parsed)) {
        errors.add(field, "Phải là số nguyên.");
        return fallback;
    }
    if (parsed < min || parsed > max) {
        errors.add(field, max === Number.MAX_SAFE_INTEGER ? `Phải >= ${min}.` : `Phải trong khoảng ${min}..${max}.`);
        return fallback;
    }
    return parsed;
}

function throwIfInvalid(errors: DetailCollector): void {
    if (errors.details.length > 0) {
        throw invalidArgument("Tham số không hợp lệ.", errors.details);
    }
}
