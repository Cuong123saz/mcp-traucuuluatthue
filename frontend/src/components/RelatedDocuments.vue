<script setup lang="ts">
import { computed } from "vue";
import { formatCalendarDate } from "../lib/calendarDate";
import { t } from "../lib/copy";
import { isWarningRelation } from "../lib/relations";
import type { RelationsState } from "../stores/relationsStore";
import CopyButton from "./CopyButton.vue";
import RelationItemRow from "./RelationItemRow.vue";

/**
 * "Văn bản liên quan" section (design-spec.md §11.4–11.5). Always rendered
 * with its heading; holds its own loading / empty / error states so that a
 * failure here never replaces the rest of the panel.
 */
const props = defineProps<{ state: RelationsState; documentNumber: string; asOf: string }>();
defineEmits<{ retry: [] }>();

const vars = computed(() => ({ documentNumber: props.documentNumber, asOf: formatCalendarDate(props.asOf) }));
const loading = computed(() => props.state.status === "loading" || props.state.status === "idle");
const groups = computed(() => {
    const s = props.state;
    if (s.status !== "success") return [];
    return (
        [
            { name: "incoming", titleKey: "relations.group.incoming", items: s.data.incoming },
            { name: "outgoing", titleKey: "relations.group.outgoing", items: s.data.outgoing }
        ] as const
    ).filter((g) => g.items.length > 0);
});
</script>

<template>
  <section
    id="detail-relations"
    class="detail-relations"
    aria-labelledby="detail-relations-heading"
    :aria-busy="loading ? 'true' : 'false'"
    data-testid="related-documents"
  >
    <h3 id="detail-relations-heading" class="detail-relations-title" tabindex="-1">{{ t("relations.title") }}</h3>

    <template v-if="state.status === 'success'">
      <p class="relations-note" data-testid="relations-context">{{ t("relations.context", vars) }}</p>
      <template v-if="groups.length > 0">
        <div v-for="group in groups" :key="group.name" :data-testid="`relations-${group.name}`">
          <h4 class="relations-group-title">{{ t(group.titleKey) }}</h4>
          <ul class="relations-list">
            <RelationItemRow
              v-for="(item, index) in group.items"
              :key="index"
              :item="item"
              :warn="isWarningRelation(item, group.name)"
            />
          </ul>
        </div>
      </template>
      <div v-else data-testid="relations-empty">
        <p class="relations-empty">{{ t("relations.empty", vars) }}</p>
        <p class="relations-note">{{ t("relations.empty.note") }}</p>
      </div>
    </template>

    <div
      v-else-if="state.status === 'error'"
      class="banner banner-error"
      role="status"
      data-testid="relations-error"
    >
      <p class="banner-title">{{ t(state.presentation.titleKey, vars) }}</p>
      <p>{{ t(state.presentation.bodyKey, vars) }}</p>
      <p v-if="state.presentation.requestId" class="request-id">
        <span>{{ t("error.requestId", { requestId: state.presentation.requestId }) }}</span>
        <CopyButton :text="state.presentation.requestId" label-key="error.requestId.copy" />
      </p>
      <button v-if="state.presentation.retryable" type="button" class="btn btn-small" @click="$emit('retry')">
        {{ t("error.retry") }}
      </button>
    </div>

    <div v-else data-testid="relations-loading">
      <p class="relations-note">{{ t("relations.loading") }}</p>
      <div class="relations-skeleton" aria-hidden="true">
        <span class="sk sk-short"></span><span class="sk"></span>
      </div>
    </div>
  </section>
</template>
