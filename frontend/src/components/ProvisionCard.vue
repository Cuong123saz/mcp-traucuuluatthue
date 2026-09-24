<script setup lang="ts">
import { computed } from "vue";
import { t } from "../lib/copy";
import { inspectProvision, type ReceivedProvision } from "../lib/provision";
import EffectiveBadge from "./EffectiveBadge.vue";
import SourceLink from "./SourceLink.vue";

const props = defineProps<{ provision: ReceivedProvision; asOf: string }>();
const emit = defineEmits<{ openDetail: [provision: ReceivedProvision, trigger: HTMLElement] }>();

const integrity = computed(() => inspectProvision(props.provision, props.asOf));

function open(event: MouseEvent) {
    emit("openDetail", props.provision, event.currentTarget as HTMLElement);
}
</script>

<template>
  <!-- The card itself is not a button, so the text stays selectable. -->
  <article class="card" :class="{ 'card-data-error': integrity.hasDataError }" data-testid="provision-card">
    <header class="card-head">
      <span class="article-key">{{ provision.articleKey }}</span>
      <h3 class="card-heading">{{ provision.heading || provision.articleKey }}</h3>
    </header>
    <p class="doc-line">{{ provision.documentNumber }} · {{ provision.title }}</p>
    <EffectiveBadge :effective="integrity.effective" :as-of="asOf" />
    <p v-if="provision.body" class="body-clamp">{{ provision.body }}</p>
    <p v-else class="body-clamp body-empty">{{ t("card.body.empty") }}</p>
    <footer class="card-foot">
      <SourceLink :source="integrity.source" />
      <button type="button" class="btn" @click="open">{{ t("card.detail") }}</button>
    </footer>
  </article>
</template>
