import { computed, reactive, ref, shallowRef } from "vue";
import { isCalendarDate, localToday } from "../lib/calendarDate";
import type { CopyKey } from "../lib/copy";
import { presentSearchError, type ErrorPresentation } from "../lib/errorPresentation";
import type { ReceivedProvision } from "../lib/provision";
import type { ApiError, Pagination, SearchInput, TaxLawApi } from "../lib/taxLawApi";

export const LIMIT_OPTIONS = [10, 20, 50, 100] as const;
export type Limit = (typeof LIMIT_OPTIONS)[number];

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

/**
 * One successful response together with the exact input that produced it
 * (searchState + resultSnapshot in component-map.md §3). Committed as a
 * whole, only after the envelope check; never updated on submit.
 */
export interface Snapshot {
    readonly input: SearchInput;
    readonly items: readonly ReceivedProvision[];
    readonly pagination: Pagination;
    readonly requestId: string;
}

export interface Failure {
    readonly input: SearchInput;
    readonly error: Exclude<ApiError, { kind: "aborted" }>;
    readonly presentation: ErrorPresentation;
}

/** offset > 0 page that came back empty; the previous snapshot stays intact. */
export interface EmptyPageAttempt {
    readonly input: SearchInput;
    readonly requestId: string;
}

/**
 * Captured once when "Xem chi tiết" is clicked. asOf comes from the snapshot
 * that rendered the card — never from the form or a pending request — and
 * the selection does not change when the list behind it changes.
 */
export interface DetailSelection {
    readonly provision: ReceivedProvision;
    readonly asOf: string;
    readonly requestId: string;
}

export interface FieldErrors {
    q?: CopyKey;
    asOf?: CopyKey;
}

export interface SearchStoreOptions {
    today?: () => string;
}

export function validateForm(form: { q: string; asOf: string }): FieldErrors {
    const errors: FieldErrors = {};
    const q = form.q.trim();
    if (q.length === 0) errors.q = "validation.q.required";
    else if (q.length > 300) errors.q = "validation.q.tooLong";
    if (form.asOf === "") errors.asOf = "validation.asOf.required";
    else if (!isCalendarDate(form.asOf)) errors.asOf = "validation.asOf.invalid";
    return errors;
}

export function createSearchStore(api: TaxLawApi, options: SearchStoreOptions = {}) {
    const today = options.today ?? (() => localToday());

    const form = reactive<{ q: string; asOf: string; limit: Limit }>({ q: "", asOf: today(), limit: 20 });
    const fieldErrors = ref<FieldErrors>({});
    const status = ref<SearchStatus>("idle");
    const snapshot = shallowRef<Snapshot | null>(null);
    const pending = shallowRef<SearchInput | null>(null);
    const failure = shallowRef<Failure | null>(null);
    const emptyPage = shallowRef<EmptyPageAttempt | null>(null);
    const detail = shallowRef<DetailSelection | null>(null);
    const hasSubmitted = ref(false);

    let sequence = 0;
    let controller: AbortController | null = null;

    const loading = computed(() => status.value === "loading");

    /** Form differs from the query that produced the list on screen. */
    const isStale = computed(() => {
        const s = snapshot.value;
        if (!s) return false;
        return form.q.trim() !== s.input.q || form.asOf !== s.input.asOf || form.limit !== s.input.limit;
    });

    async function run(input: SearchInput): Promise<void> {
        const mySequence = ++sequence;
        controller?.abort();
        const myController = new AbortController();
        controller = myController;

        hasSubmitted.value = true;
        pending.value = input;
        failure.value = null;
        emptyPage.value = null;
        status.value = "loading";

        const outcome = await api.search(input, myController.signal);
        // A newer request owns the state now; this response is dropped whole.
        if (mySequence !== sequence) return;
        pending.value = null;
        controller = null;

        if (!outcome.ok) {
            if (outcome.error.kind === "aborted") return;
            failure.value = { input, error: outcome.error, presentation: presentSearchError(outcome.error) };
            status.value = "error";
            return;
        }

        const { items, pagination, requestId } = outcome.value;
        if (items.length === 0 && input.offset > 0) {
            emptyPage.value = { input, requestId };
            status.value = "empty";
            return;
        }
        snapshot.value = Object.freeze({ input, items: Object.freeze([...items]), pagination, requestId });
        status.value = items.length > 0 ? "success" : "empty";
    }

    function submitForm(): Promise<void> | undefined {
        const errors = validateForm(form);
        fieldErrors.value = errors;
        if (errors.q || errors.asOf) return undefined;
        return run(Object.freeze({ q: form.q.trim(), asOf: form.asOf, limit: form.limit, offset: 0 }));
    }

    return {
        form,
        fieldErrors,
        status,
        snapshot,
        pending,
        failure,
        emptyPage,
        detail,
        hasSubmitted,
        loading,
        isStale,

        /** Enter / "Tra cứu". Ignored while loading (A-05). */
        submit(): Promise<void> | undefined {
            if (loading.value) return undefined;
            return submitForm();
        },

        /**
         * Before the first search: form only. Afterwards: submit the current
         * form with offset 0 (A-03). May replace an in-flight request; the
         * sequence guard drops the older response.
         */
        changeLimit(limit: Limit): Promise<void> | undefined {
            form.limit = limit;
            if (!hasSubmitted.value) return undefined;
            return submitForm();
        },

        setToday(): void {
            form.asOf = today();
        },

        /** Paging always reuses q/asOf/limit of the list on screen, not the form. */
        nextPage(): Promise<void> | undefined {
            const s = snapshot.value;
            if (!s || loading.value || emptyPage.value || s.pagination.hasMore === false) return undefined;
            if (s.items.length === 0) return undefined;
            return run(Object.freeze({ ...s.input, offset: s.input.offset + s.input.limit }));
        },

        prevPage(): Promise<void> | undefined {
            const s = snapshot.value;
            if (!s || loading.value || s.input.offset === 0) return undefined;
            return run(Object.freeze({ ...s.input, offset: Math.max(0, s.input.offset - s.input.limit) }));
        },

        /** end-of-results "Quay lại trang trước": restore, no new request. */
        backFromEmptyPage(): void {
            if (!emptyPage.value) return;
            emptyPage.value = null;
            const s = snapshot.value;
            status.value = s && s.items.length > 0 ? "success" : "empty";
        },

        /** Re-sends exactly the input that failed; never re-reads the form. */
        retry(): Promise<void> | undefined {
            const f = failure.value;
            if (!f || !f.presentation.retryable || loading.value) return undefined;
            return run(f.input);
        },

        openDetail(provision: ReceivedProvision): void {
            const s = snapshot.value;
            if (!s || !s.items.includes(provision)) return;
            detail.value = Object.freeze({ provision, asOf: s.input.asOf, requestId: s.requestId });
        },

        closeDetail(): void {
            detail.value = null;
        }
    };
}

export type SearchStore = ReturnType<typeof createSearchStore>;
