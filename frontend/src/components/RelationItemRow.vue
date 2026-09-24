<script setup lang="ts">
import { computed } from "vue";
import { relationRange } from "../lib/relations";
import { inspectSourceUrl } from "../lib/sourceUrl";
import type { RelationItem } from "../lib/taxLawApi";
import SourceLink from "./SourceLink.vue";

/**
 * One relation (design-spec.md §11.3). label is shown verbatim; relationType
 * is not rendered. documentNumber is plain text, not a link (DA-15). The range
 * is the relation's own interval and never uses the green "applicable" badge.
 */
const props = defineProps<{ item: RelationItem; warn: boolean }>();
const source = computed(() => inspectSourceUrl(props.item.sourceUrl));
</script>

<template>
  <li class="relation-item" data-testid="relation-item">
    <span :class="warn ? 'warn-label' : 'relation-label'" class="relation-tag">{{ item.label }}</span>
    <p class="relation-doc">
      <strong>{{ item.documentNumber }}</strong><template v-if="item.title"> · {{ item.title }}</template>
    </p>
    <p class="relation-range">{{ relationRange(item) }}</p>
    <SourceLink :source="source" />
  </li>
</template>
