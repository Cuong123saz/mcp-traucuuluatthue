import { shallowRef } from "vue";
import { presentRelationsError, type ErrorPresentation } from "../lib/errorPresentation";
import type { ApiError, RelationsInput, RelationsResponse, TaxLawApi } from "../lib/taxLawApi";

/**
 * relationsState (component-guidelines.md §10a). Kept apart from the search
 * store: a relations failure never touches search status, snapshot or
 * failure, and never closes the detail panel.
 */
export type RelationsState =
    | { readonly status: "idle" }
    | { readonly status: "loading"; readonly input: RelationsInput }
    | { readonly status: "success"; readonly input: RelationsInput; readonly data: RelationsResponse }
    | {
          readonly status: "error";
          readonly input: RelationsInput;
          readonly error: Exclude<ApiError, { kind: "aborted" }>;
          readonly presentation: ErrorPresentation;
      };

export function createRelationsStore(api: TaxLawApi) {
    const state = shallowRef<RelationsState>({ status: "idle" });

    let sequence = 0;
    let controller: AbortController | null = null;

    function abortCurrent(): void {
        sequence++;
        controller?.abort();
        controller = null;
    }

    async function run(input: RelationsInput): Promise<void> {
        abortCurrent();
        const mySequence = sequence;
        const myController = new AbortController();
        controller = myController;
        state.value = Object.freeze({ status: "loading", input });

        const outcome = await api.relations(input, myController.signal);
        // A newer selection, a retry or closing the panel owns the state now.
        if (mySequence !== sequence) return;
        controller = null;

        if (!outcome.ok) {
            if (outcome.error.kind === "aborted") return;
            state.value = Object.freeze({
                status: "error",
                input,
                error: outcome.error,
                presentation: presentRelationsError(outcome.error)
            });
            return;
        }
        state.value = Object.freeze({ status: "success", input, data: outcome.value });
    }

    return {
        state,

        /**
         * Panel opened on a selection: documentNumber of the provision and
         * asOf of the selection (the search snapshot), never the form or today.
         * Any request for a previous selection is aborted and its response
         * ignored. No automatic retry.
         */
        load(documentNumber: string, asOf: string): Promise<void> {
            return run(Object.freeze({ documentNumber, asOf }));
        },

        /** "Thử lại": only /relations again, same input; only for retryable errors. */
        retry(): Promise<void> | undefined {
            const s = state.value;
            if (s.status !== "error" || !s.presentation.retryable) return undefined;
            return run(s.input);
        },

        /** Panel closed: abort the request and forget the result. */
        cancel(): void {
            abortCurrent();
            state.value = { status: "idle" };
        }
    };
}

export type RelationsStore = ReturnType<typeof createRelationsStore>;
