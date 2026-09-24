export type SourceUrlState =
    | { kind: "ok"; href: string; hostname: string }
    | { kind: "missing" }
    | { kind: "invalid" };

/**
 * sourceUrl is untrusted external data (DA-12). Only http/https render as a
 * link; nothing is ever fetched, proxied or previewed.
 */
export function inspectSourceUrl(value: unknown): SourceUrlState {
    if (typeof value !== "string" || value.trim() === "") return { kind: "missing" };
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "invalid" };
        return { kind: "ok", href: url.href, hostname: url.hostname };
    } catch {
        return { kind: "invalid" };
    }
}
