<script setup lang="ts">
import { t } from "../lib/copy";
import type { Pagination } from "../lib/taxLawApi";

/** No total and no page numbers: the API has neither (DA-01). */
defineProps<{ pagination: Pagination; itemCount: number; loading: boolean }>();
defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <nav class="pager" aria-label="Phân trang">
    <button
      type="button"
      class="btn"
      :disabled="loading || pagination.offset === 0"
      @click="$emit('prev')"
    >{{ t("pager.prev") }}</button>
    <span class="pager-range">{{
      t("pager.range", { from: pagination.offset + 1, to: pagination.offset + itemCount })
    }}</span>
    <button
      type="button"
      class="btn"
      data-testid="pager-next"
      :disabled="loading || pagination.hasMore === false"
      @click="$emit('next')"
    >{{ t("pager.next") }}</button>
  </nav>
  <p v-if="pagination.hasMore === false" class="pager-note">{{ t("pager.end") }}</p>
  <p v-else-if="pagination.hasMore === null" class="pager-note" data-testid="pager-unknown">
    {{ t("pager.unknownMore") }}
  </p>
</template>
