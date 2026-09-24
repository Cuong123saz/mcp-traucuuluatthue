<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { formatCalendarDate } from "../lib/calendarDate";
import { t } from "../lib/copy";
import { inspectProvision } from "../lib/provision";
import type { RelationsState } from "../stores/relationsStore";
import type { DetailSelection } from "../stores/searchStore";
import CopyButton from "./CopyButton.vue";
import EffectiveBadge from "./EffectiveBadge.vue";
import RelatedDocuments from "./RelatedDocuments.vue";
import RelationAlert from "./RelationAlert.vue";
import SourceLink from "./SourceLink.vue";

/**
 * MVP detail: renders the ProvisionResult from the search snapshot (search
 * already returns the full body). No REST detail call until Backend settles
 * GET /documents/:number?articleKey (conflict C-06). asOf is the snapshot's.
 */
const props = defineProps<{ selection: DetailSelection; relations: RelationsState }>();
const emit = defineEmits<{ close: []; retryRelations: [] }>();

const panel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const p = computed(() => props.selection.provision);
const integrity = computed(() => inspectProvision(p.value, props.selection.asOf));

/**
 * Relations are loaded in parallel by the parent (flow 3a); the provision
 * content never waits for them. A state that belongs to another
 * documentNumber/asOf is shown as loading, never as this document's result.
 */
const relationsState = computed<RelationsState>(() => {
    const r = props.relations;
    if (r.status === "idle") return r;
    const matches = r.input.documentNumber === p.value.documentNumber && r.input.asOf === props.selection.asOf;
    return matches ? r : { status: "idle" };
});

onMounted(async () => {
    await nextTick();
    closeButton.value?.focus();
});

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        event.preventDefault();
        emit("close");
        return;
    }
    if (event.key !== "Tab" || !panel.value) return;
    const nodes = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.value.contains(active))) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || !panel.value.contains(active))) {
        event.preventDefault();
        first.focus();
    }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section
      ref="panel"
      class="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-heading"
      data-testid="detail-panel"
      @keydown="onKeydown"
    >
      <header class="detail-head">
        <p class="detail-kicker">{{ t("detail.title") }}</p>
        <button ref="closeButton" type="button" class="btn btn-small" @click="emit('close')">
          {{ t("detail.close") }}
        </button>
      </header>

      <span class="article-key">{{ p.articleKey }}</span>
      <h2 id="detail-heading" class="detail-heading">{{ p.heading || p.articleKey }}</h2>
      <p class="doc-line">{{ p.documentNumber }} · {{ p.title }}</p>
      <EffectiveBadge :effective="integrity.effective" :as-of="selection.asOf" />
      <RelationAlert
        v-if="relationsState.status === 'success'"
        :incoming="relationsState.data.incoming"
        :document-number="p.documentNumber"
        :as-of="selection.asOf"
      />

      <p v-if="p.body" class="detail-body">{{ p.body }}</p>
      <p v-else class="detail-body body-empty">{{ t("card.body.empty") }}</p>

      <div class="detail-source">
        <SourceLink :source="integrity.source" />
        <CopyButton
          v-if="integrity.source.kind === 'ok'"
          :text="integrity.source.href"
          label-key="detail.copyLink"
        />
      </div>

      <RelatedDocuments
        :state="relationsState"
        :document-number="p.documentNumber"
        :as-of="selection.asOf"
        @retry="emit('retryRelations')"
      />

      <dl class="detail-meta">
        <dt class="detail-meta-title">{{ t("detail.meta.heading") }}</dt>
        <dd>
          <span>{{ t("detail.meta.versionId") }}: </span>
          <code data-testid="detail-version-id">{{ p.versionId }}</code>
          <CopyButton :text="p.versionId" label-key="error.requestId.copy" />
        </dd>
        <dd data-testid="detail-asof">{{ t("detail.meta.asOf") }}: {{ formatCalendarDate(selection.asOf) }}</dd>
        <dd v-if="integrity.hasDataError" class="request-id">
          {{ t("error.requestId", { requestId: selection.requestId }) }}
        </dd>
      </dl>
    </section>
  </div>
</template>
