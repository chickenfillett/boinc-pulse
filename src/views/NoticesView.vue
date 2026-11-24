<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import DOMPurify from "dompurify";
import { useNoticesStore } from "../stores/notices";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import {
  classifyNotice,
  noticeLevelKey,
  noticeLevelTone,
} from "../utils/noticeLevel";

const store = useNoticesStore();

function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html);
  // Ensure all links open in a new tab without giving the target page window.opener access
  return clean.replace(
    /<a\s/gi,
    '<a target="_blank" rel="noopener noreferrer" ',
  );
}

function formatDate(timestamp: number): string {
  if (timestamp <= 0) return "";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(timestamp: number): string {
  if (timestamp <= 0) return "";
  return new Date(timestamp * 1000).toLocaleString();
}

const sortedNotices = computed(() => {
  return [...store.notices]
    .sort((a, b) => b.create_time - a.create_time)
    .map((notice) => ({
      ...notice,
      level: classifyNotice(notice.title, notice.description),
    }));
});

type LevelFilter = "all" | "action" | "info";
const levelFilter = ref<LevelFilter>("all");

const visibleNotices = computed(() => {
  if (levelFilter.value === "action") {
    return sortedNotices.value.filter((n) => n.level >= 2);
  }
  if (levelFilter.value === "info") {
    return sortedNotices.value.filter((n) => n.level <= 1);
  }
  return sortedNotices.value;
});

const actionCount = computed(
  () => sortedNotices.value.filter((n) => n.level >= 2).length,
);

onMounted(() => {
  store.startPolling();
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="notices-view">
    <PageHeader />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <!-- Severity filter lives outside the loading/empty v-if chain: inserting
         it inside would break the v-else-if sequence. -->
    <div v-if="store.notices.length > 0" class="level-filter" role="group">
      <button
        type="button"
        class="level-btn"
        :class="{ active: levelFilter === 'all' }"
        @click="levelFilter = 'all'"
      >
        {{ $t("notices.filter.all") }}
      </button>
      <button
        type="button"
        class="level-btn"
        :class="{ active: levelFilter === 'action' }"
        @click="levelFilter = 'action'"
      >
        {{ $t("notices.filter.action") }}
        <span v-if="actionCount > 0" class="level-count">{{ actionCount }}</span>
      </button>
      <button
        type="button"
        class="level-btn"
        :class="{ active: levelFilter === 'info' }"
        @click="levelFilter = 'info'"
      >
        {{ $t("notices.filter.info") }}
      </button>
    </div>

    <div
      v-if="store.loading && store.notices.length === 0"
      class="loading-text"
    >
      {{ $t("notices.loading") }}
    </div>

    <EmptyState
      v-else-if="store.notices.length === 0 && !store.loading"
      icon="newspaper"
      :message="$t('notices.empty')"
    />

    <EmptyState
      v-else-if="visibleNotices.length === 0"
      icon="newspaper"
      :message="$t('notices.filter.empty')"
    />

    <div v-else class="notices-list">
      <article
        v-for="notice in visibleNotices"
        :key="notice.seqno"
        class="notice-card"
        :class="`tone-${noticeLevelTone(notice.level)}`"
      >
        <div class="notice-header">
          <h3 class="notice-title">
            <a
              v-if="notice.link"
              :href="notice.link"
              target="_blank"
              rel="noopener"
              class="notice-link"
            >
              {{ notice.title || $t('notices.noticeFromBoinc') }}
            </a>
            <span v-else>{{ notice.title || $t('notices.noticeFromBoinc') }}</span>
          </h3>
          <div class="notice-meta">
            <span
              class="level-badge"
              :class="`tone-${noticeLevelTone(notice.level)}`"
            >
              {{ $t(noticeLevelKey(notice.level)) }}
            </span>
            <StatusBadge v-if="notice.project_name" variant="info">
              {{ notice.project_name }}
            </StatusBadge>
            <StatusBadge v-else-if="!notice.title" variant="info">
              BOINC
            </StatusBadge>
            <span
              class="notice-date"
              :title="formatDateTime(notice.create_time)"
            >
              {{ formatDate(notice.create_time) }}
            </span>
          </div>
        </div>

        <div
          v-if="notice.description"
          class="notice-body"
          v-html="sanitizeHtml(notice.description)"
        />
      </article>
    </div>
  </div>
</template>

<style scoped>
.notices-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto;
  padding: 0 var(--space-lg) var(--space-lg);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  padding: var(--space-xl) 0;
}

.notices-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.notice-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal);
  border-left-width: 3px;
}

/* Severity is a left edge, not another pill: at 460px the card header already
   carries a project badge and a date, and a third chip wraps the line. */
.notice-card.tone-quiet {
  border-left-color: var(--color-border);
}
.notice-card.tone-normal {
  border-left-color: var(--color-accent);
}
.notice-card.tone-warn {
  border-left-color: var(--color-warning);
}
.notice-card.tone-bad {
  border-left-color: var(--color-danger);
}

.level-filter {
  display: flex;
  gap: 4px;
  margin-bottom: var(--space-md);
  padding: 2px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  align-self: flex-start;
}

.level-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 11px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.level-btn.active {
  background: var(--color-accent-light);
  color: var(--color-accent-text);
  font-weight: 600;
}

.level-count {
  min-width: 15px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--color-warning-light);
  color: var(--color-warning-text);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.level-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.level-badge.tone-quiet {
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
}
.level-badge.tone-normal {
  color: var(--color-accent-text);
  background: var(--color-accent-light);
}
.level-badge.tone-warn {
  color: var(--color-warning-text);
  background: var(--color-warning-light);
}
.level-badge.tone-bad {
  color: var(--color-danger-text);
  background: var(--color-danger-light);
}

.notice-card:hover {
  box-shadow: var(--shadow-md);
}

.notice-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.notice-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.notice-link {
  color: var(--color-accent);
  text-decoration: none;
}

.notice-link:hover {
  text-decoration: underline;
}

.notice-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.notice-date {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.notice-body {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.6;
  overflow-wrap: break-word;
}

.notice-body :deep(a) {
  color: var(--color-accent);
  text-decoration: none;
}

.notice-body :deep(a:hover) {
  text-decoration: underline;
}

.notice-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

.notice-body :deep(p) {
  margin: 0 0 var(--space-sm) 0;
}

.notice-body :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
