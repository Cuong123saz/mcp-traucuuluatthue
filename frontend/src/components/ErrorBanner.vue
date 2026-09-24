<script setup lang="ts">
import { t, type CopyKey } from "../lib/copy";
import CopyButton from "./CopyButton.vue";

defineProps<{
    titleKey: CopyKey;
    body: string;
    requestId?: string;
    retryable?: boolean;
    tone?: "error" | "warning";
}>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="banner" :class="tone === 'warning' ? 'banner-warning' : 'banner-error'" role="alert">
    <p class="banner-title">{{ t(titleKey) }}</p>
    <p>{{ body }}</p>
    <p v-if="requestId" class="request-id">
      <span>{{ t("error.requestId", { requestId }) }}</span>
      <CopyButton :text="requestId" label-key="error.requestId.copy" />
    </p>
    <button v-if="retryable" type="button" class="btn" @click="$emit('retry')">{{ t("error.retry") }}</button>
  </div>
</template>
