<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { t } from "../lib/copy";
import { looksLikeDocumentNumber } from "../lib/provision";
import { LIMIT_OPTIONS, type Limit, type SearchStore } from "../stores/searchStore";

const props = defineProps<{ store: SearchStore }>();
const emit = defineEmits<{ submitted: [] }>();

const form = props.store.form;
const qInput = ref<HTMLInputElement | null>(null);
const asOfInput = ref<HTMLInputElement | null>(null);

const qLength = computed(() => form.q.length);
const showDocNumberHint = computed(() => looksLikeDocumentNumber(form.q));
const errors = computed(() => props.store.fieldErrors.value);

onMounted(() => {
    // Desktop only: on mobile the keyboard would hide the guidance.
    if (typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches) {
        qInput.value?.focus();
    }
});

async function focusFirstInvalid() {
    await nextTick();
    if (errors.value.q) qInput.value?.focus();
    else if (errors.value.asOf) asOfInput.value?.focus();
}

function onSubmit() {
    const pending = props.store.submit();
    if (pending) emit("submitted");
    else if (!props.store.loading.value) void focusFirstInvalid();
}

function onLimitChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value) as Limit;
    const pending = props.store.changeLimit(value);
    if (!pending && props.store.hasSubmitted.value) void focusFirstInvalid();
}
</script>

<template>
  <form class="search-bar" novalidate @submit.prevent="onSubmit">
    <div class="field field-q">
      <label for="q">{{ t("search.q.label") }}</label>
      <input
        id="q"
        ref="qInput"
        v-model="form.q"
        type="search"
        name="q"
        autocomplete="off"
        :placeholder="t('search.q.placeholder')"
        :aria-invalid="errors.q ? 'true' : undefined"
        :aria-describedby="errors.q ? 'q-error' : 'q-hint'"
      />
      <p v-if="qLength >= 260" class="field-meta">{{ t("search.q.counter", { length: qLength }) }}</p>
      <p v-if="errors.q" id="q-error" class="field-error">{{ t(errors.q) }}</p>
      <p v-if="showDocNumberHint" class="field-hint" data-testid="doc-number-hint">
        {{ t("search.hint.docNumber") }}
      </p>
    </div>

    <div class="field field-asof">
      <label for="asOf">{{ t("search.asOf.label") }}</label>
      <div class="asof-row">
        <input
          id="asOf"
          ref="asOfInput"
          v-model="form.asOf"
          type="date"
          name="asOf"
          :aria-invalid="errors.asOf ? 'true' : undefined"
          :aria-describedby="errors.asOf ? 'asOf-error asOf-help' : 'asOf-help'"
        />
        <button type="button" class="btn btn-small" @click="store.setToday()">{{ t("search.asOf.today") }}</button>
      </div>
      <p id="asOf-help" class="field-meta">{{ t("search.asOf.help") }}</p>
      <p v-if="errors.asOf" id="asOf-error" class="field-error">{{ t(errors.asOf) }}</p>
    </div>

    <div class="field field-limit">
      <label for="limit">{{ t("search.limit.label") }}</label>
      <select id="limit" name="limit" :value="form.limit" @change="onLimitChange">
        <option v-for="n in LIMIT_OPTIONS" :key="n" :value="n">{{ n }}</option>
      </select>
      <p v-if="form.limit === 100" class="field-meta">{{ t("search.limit.note100") }}</p>
    </div>

    <div class="field field-submit">
      <button
        type="submit"
        class="btn btn-primary"
        :class="{ 'btn-attention': store.isStale.value }"
        :disabled="store.loading.value"
        :aria-busy="store.loading.value ? 'true' : undefined"
      >
        {{ store.loading.value ? t("search.submit.loading") : t("search.submit") }}
      </button>
    </div>
    <p id="q-hint" class="search-hint">{{ t("search.hint.scope") }}</p>
  </form>
</template>
