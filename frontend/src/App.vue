<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { formatCalendarDate } from "./lib/calendarDate";
import { t } from "./lib/copy";
import { inspectProvision, provisionKey, type ReceivedProvision } from "./lib/provision";
import type { SearchStore } from "./stores/searchStore";
import DetailPanel from "./components/DetailPanel.vue";
import ErrorBanner from "./components/ErrorBanner.vue";
import PaginationBar from "./components/PaginationBar.vue";
import ProvisionCard from "./components/ProvisionCard.vue";
import SearchBar from "./components/SearchBar.vue";

const props = defineProps<{ store: SearchStore }>();
const s = props.store;

const resultsHeading = ref<HTMLElement | null>(null);
let detailTrigger: HTMLElement | null = null;

const snapshot = computed(() => s.snapshot.value);
const status = computed(() => s.status.value);
/** Date shown next to results is always the snapshot's, never the form's. */
const snapshotAsOf = computed(() => (snapshot.value ? formatCalendarDate(snapshot.value.input.asOf) : ""));

const showCards = computed(
    () => !!snapshot.value && snapshot.value.items.length > 0 && !s.emptyPage.value
);
const firstLoad = computed(() => status.value === "loading" && !snapshot.value);
const skeletonCount = computed(() => Math.min(s.pending.value?.limit ?? s.form.limit, 5));

const dataErrorCount = computed(() => {
    const snap = snapshot.value;
    if (!snap || !showCards.value) return 0;
    return snap.items.filter((item) => inspectProvision(item, snap.input.asOf).hasDataError).length;
});

const liveMessage = computed(() => {
    const snap = snapshot.value;
    switch (status.value) {
        case "loading":
            return t("loading.srAnnounce");
        case "success":
            return snap ? t("result.liveRegion", { count: snap.items.length, asOf: snapshotAsOf.value }) : "";
        case "empty":
            return s.emptyPage.value
                ? t("empty.endOfResults.title")
                : t("empty.noResults.title", { asOf: snapshotAsOf.value });
        case "error":
            return s.failure.value ? t(s.failure.value.presentation.titleKey) : "";
        default:
            return "";
    }
});

async function focusResults() {
    await nextTick();
    resultsHeading.value?.focus();
    resultsHeading.value?.scrollIntoView?.({ block: "start" });
}

async function page(direction: "prev" | "next") {
    const run = direction === "next" ? s.nextPage() : s.prevPage();
    if (!run) return;
    await run;
    if (s.status.value === "success" || s.status.value === "empty") await focusResults();
}

async function backFromEmptyPage() {
    s.backFromEmptyPage();
    await focusResults();
}

function openDetail(provision: ReceivedProvision, trigger: HTMLElement) {
    detailTrigger = trigger;
    s.openDetail(provision);
}

async function closeDetail() {
    s.closeDetail();
    await nextTick();
    // Return focus to the card's button; if the list changed and it is gone,
    // fall back to the results heading.
    if (detailTrigger?.isConnected) detailTrigger.focus();
    else resultsHeading.value?.focus();
    detailTrigger = null;
}
</script>

<template>
  <div class="page" :inert="s.detail.value ? true : undefined">
    <header class="app-header">
      <h1>{{ t("app.title") }}</h1>
      <p>{{ t("app.subtitle") }}</p>
    </header>

    <SearchBar :store="s" />

    <section class="results" :aria-busy="status === 'loading' ? 'true' : 'false'">
      <div class="sr-only" aria-live="polite" data-testid="live-region">{{ liveMessage }}</div>

      <!-- idle: static guidance, no API call (DA-05, DA-07) -->
      <div v-if="status === 'idle'" class="empty" data-testid="empty-first-run">
        <h2>{{ t("empty.firstRun.title") }}</h2>
        <p>{{ t("empty.firstRun.body") }}</p>
        <p>
          <strong>{{ t("empty.firstRun.examplesLabel") }}:</strong>
          {{ t("empty.firstRun.examples") }}
        </p>
      </div>

      <template v-if="snapshot">
        <h2 ref="resultsHeading" class="result-context" tabindex="-1" data-testid="result-context">
          {{ t("result.context", { asOf: snapshotAsOf }) }}
        </h2>
        <p v-if="showCards" class="result-count">
          {{ t("result.count", { count: snapshot.items.length }) }}
        </p>
      </template>

      <p v-if="s.isStale.value && snapshot" class="banner banner-warning" data-testid="stale-notice">
        {{ t("result.stale", { asOf: snapshotAsOf }) }}
      </p>

      <p v-if="status === 'loading' && snapshot" class="loading-inline">{{ t("loading.results") }}</p>

      <ErrorBanner
        v-if="status === 'error' && s.failure.value"
        data-testid="error-banner"
        :title-key="s.failure.value.presentation.titleKey"
        :body="t(s.failure.value.presentation.bodyKey)"
        :request-id="s.failure.value.presentation.requestId"
        :retryable="s.failure.value.presentation.retryable"
        @retry="s.retry()"
      />
      <p v-if="status === 'error' && showCards" class="result-previous" data-testid="previous-notice">
        {{ t("fe.result.previous", { asOf: snapshotAsOf }) }}
      </p>

      <ErrorBanner
        v-if="dataErrorCount > 0 && snapshot"
        data-testid="data-error-banner"
        tone="warning"
        title-key="fe.dataError.title"
        :body="t('fe.dataError.body', { count: dataErrorCount })"
        :request-id="snapshot.requestId"
      />

      <!-- first load: skeleton only; later loads keep the previous cards -->
      <div v-if="firstLoad" class="skeletons" data-testid="loading-skeleton" aria-hidden="true">
        <div v-for="n in skeletonCount" :key="n" class="card skeleton">
          <span class="sk sk-short"></span><span class="sk"></span><span class="sk"></span>
        </div>
      </div>

      <div
        v-if="status === 'empty' && s.emptyPage.value"
        class="empty"
        data-testid="empty-end-of-results"
      >
        <h3>{{ t("empty.endOfResults.title") }}</h3>
        <p>{{ t("empty.endOfResults.body") }}</p>
        <button type="button" class="btn" @click="backFromEmptyPage">{{ t("empty.endOfResults.action") }}</button>
      </div>

      <div
        v-else-if="status === 'empty' && snapshot"
        class="empty"
        data-testid="empty-no-results"
      >
        <h3>{{ t("empty.noResults.title", { asOf: snapshotAsOf }) }}</h3>
        <p>{{ t("empty.noResults.body") }}</p>
        <p><strong>{{ t("empty.noResults.tipsLabel") }}</strong></p>
        <ul>
          <li>{{ t("empty.noResults.tip1") }}</li>
          <li>{{ t("empty.noResults.tip2") }}</li>
          <li>{{ t("empty.noResults.tip3") }}</li>
          <li>{{ t("empty.noResults.tip4") }}</li>
        </ul>
      </div>

      <template v-if="showCards && snapshot">
        <div
          class="card-list"
          :class="{ dimmed: s.isStale.value || status === 'loading' }"
          data-testid="card-list"
        >
          <ProvisionCard
            v-for="item in snapshot.items"
            :key="provisionKey(item)"
            :provision="item"
            :as-of="snapshot.input.asOf"
            @open-detail="openDetail"
          />
        </div>
        <PaginationBar
          :pagination="snapshot.pagination"
          :item-count="snapshot.items.length"
          :loading="status === 'loading'"
          @prev="page('prev')"
          @next="page('next')"
        />
      </template>
    </section>
  </div>

  <DetailPanel v-if="s.detail.value" :key="provisionKey(s.detail.value.provision)" :selection="s.detail.value" @close="closeDetail" />
</template>
