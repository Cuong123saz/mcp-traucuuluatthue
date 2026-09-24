<script setup lang="ts">
import { computed } from "vue";
import { formatCalendarDate } from "../lib/calendarDate";
import { t } from "../lib/copy";
import { relationAlert, relationAlertLine } from "../lib/relations";
import type { RelationItem } from "../lib/taxLawApi";

/**
 * Warning under the provision badge (design-spec.md §11.2). Rendered only by
 * the parent on a successful relations response; decides from relationType of
 * `incoming` items only (DA-18). No dismiss button, no effect on the badge.
 */
const props = defineProps<{ incoming: readonly RelationItem[]; documentNumber: string; asOf: string }>();

const model = computed(() => relationAlert(props.incoming));
const vars = computed(() => ({ documentNumber: props.documentNumber, asOf: formatCalendarDate(props.asOf) }));

function jump() {
    const heading = document.getElementById("detail-relations-heading");
    heading?.scrollIntoView?.({ block: "start" });
    heading?.focus();
}
</script>

<template>
  <div v-if="model" class="banner banner-warning relation-alert" role="status" data-testid="relation-alert">
    <p class="banner-title"><span aria-hidden="true">⚠ </span>{{ t(model.titleKey, vars) }}</p>
    <p>{{ t(model.bodyKey) }}</p>
    <ul class="relation-alert-lines">
      <li v-for="(line, index) in model.lines" :key="index">{{ relationAlertLine(line) }}</li>
    </ul>
    <a href="#detail-relations" @click.prevent="jump">{{ t("relations.alert.jump") }}</a>
  </div>
</template>
