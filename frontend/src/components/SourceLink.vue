<script setup lang="ts">
import { t } from "../lib/copy";
import type { SourceUrlState } from "../lib/sourceUrl";

defineProps<{ source: SourceUrlState }>();
</script>

<template>
  <a
    v-if="source.kind === 'ok'"
    class="source-link"
    :href="source.href"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ t("card.source") }} <span aria-hidden="true">↗</span>
    <span class="host">{{ source.hostname }}</span>
  </a>
  <span v-else class="warn-label" data-testid="source-warning">
    {{ source.kind === "missing" ? t("card.source.missing") : t("card.source.invalid") }}
  </span>
</template>
