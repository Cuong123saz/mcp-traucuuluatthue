import { formatCalendarDate } from "./calendarDate";
import { t, type CopyKey } from "./copy";
import type { RelationItem } from "./taxLawApi";

export interface RelationAlertModel {
    titleKey: CopyKey;
    bodyKey: CopyKey;
    /** repeals first, then amends; API order kept inside each type. */
    lines: readonly RelationItem[];
}

/**
 * design-spec.md §11.2 / DA-18: the alert is decided only by relationType of
 * items in `incoming`. `label` is display text and is never parsed; outgoing
 * relations and guides/consolidates never raise the alert.
 */
export function relationAlert(incoming: readonly RelationItem[]): RelationAlertModel | null {
    const repeals = incoming.filter((i) => i.relationType === "repeals");
    const amends = incoming.filter((i) => i.relationType === "amends");
    if (repeals.length + amends.length === 0) return null;
    const heavy = repeals.length > 0;
    return {
        titleKey: heavy ? "relations.alert.repeals.title" : "relations.alert.amends.title",
        bodyKey: heavy ? "relations.alert.repeals.body" : "relations.alert.amends.body",
        lines: [...repeals, ...amends]
    };
}

/** incoming + repeals/amends: the tag uses warn tokens (component-guidelines §10a). */
export function isWarningRelation(item: RelationItem, group: "incoming" | "outgoing"): boolean {
    return group === "incoming" && (item.relationType === "repeals" || item.relationType === "amends");
}

/** `relations.alert.line` with its lowercase range. Dates by string split only. */
export function relationAlertLine(item: RelationItem): string {
    const from = formatCalendarDate(item.effectiveFrom);
    const range =
        item.effectiveTo === null
            ? t("relations.alert.range.open", { from })
            : t("relations.alert.range.closed", { from, to: formatCalendarDate(item.effectiveTo) });
    return t("relations.alert.line", { label: item.label, documentNumber: item.documentNumber, range });
}

/** Same sentences as the provision badge (card.effective.*), without its colour. */
export function relationRange(item: RelationItem): string {
    const from = formatCalendarDate(item.effectiveFrom);
    return item.effectiveTo === null
        ? t("card.effective.open", { from })
        : t("card.effective.closed", { from, to: formatCalendarDate(item.effectiveTo) });
}
