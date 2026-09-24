<script setup lang="ts">
import { computed } from "vue";
import { formatCalendarDate } from "../lib/calendarDate";
import { t } from "../lib/copy";
import type { EffectiveState } from "../lib/provision";

const props = defineProps<{ effective: EffectiveState; asOf: string }>();

const label = computed(() => {
    const e = props.effective;
    if (e.kind === "missing") return t("card.effective.missing");
    const from = formatCalendarDate(e.from);
    return e.to === null
        ? t("card.effective.open", { from })
        : t("card.effective.closed", { from, to: formatCalendarDate(e.to) });
});
</script>

<template>
  <div class="badge-wrap">
    <span
      class="badge"
      :class="`badge-${effective.kind}`"
      :data-state="effective.kind"
    >{{ label }}</span>
    <template v-if="effective.kind === 'mismatch'">
      <span class="badge badge-mismatch">{{ t("card.effective.mismatch") }}</span>
      <p class="warn-help">{{ t("card.effective.mismatch.help", { asOf: formatCalendarDate(asOf) }) }}</p>
    </template>
  </div>
</template>
