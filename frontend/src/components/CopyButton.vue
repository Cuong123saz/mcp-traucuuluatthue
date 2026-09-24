<script setup lang="ts">
import { ref } from "vue";
import { t, type CopyKey } from "../lib/copy";

const props = defineProps<{ text: string; labelKey: CopyKey }>();
const state = ref<"idle" | "copied" | "failed">("idle");
let timer: ReturnType<typeof setTimeout> | undefined;

// "Đã sao chép" only after the clipboard write actually resolved.
async function copy() {
    clearTimeout(timer);
    try {
        if (!navigator.clipboard) throw new Error("clipboard unavailable");
        await navigator.clipboard.writeText(props.text);
        state.value = "copied";
    } catch {
        state.value = "failed";
    }
    timer = setTimeout(() => (state.value = "idle"), 2500);
}
</script>

<template>
  <span class="copy">
    <button type="button" class="btn btn-small" @click="copy">{{ t(labelKey) }}</button>
    <span class="copy-status" role="status">
      <template v-if="state === 'copied'">{{ t("detail.copied") }}</template>
      <template v-else-if="state === 'failed'">{{ t("fe.copy.failed") }}</template>
    </span>
  </span>
</template>
