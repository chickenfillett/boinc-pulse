<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useScroll, onKeyStroke } from "@vueuse/core";
import { useMessagesStore } from "../stores/messages";
import { MSG_PRIORITY } from "../types/boinc";
import type { Message } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import DataTable from "../components/DataTable.vue";
import EmptyState from "../components/EmptyState.vue";
import StatusBadge from "../components/StatusBadge.vue";
import LogFlagsDialog from "../components/LogFlagsDialog.vue";
import { useTableState } from "../composables/useTableState";
import { useToastStore } from "../stores/toast";
import { formatDateTime } from "../utils/format";
import { isTranslated, translateLogMessage } from "../utils/logTranslate";
import type { ColumnDef } from "@tanstack/vue-table";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";

const { t } = useI18n();
const store = useMessagesStore();
const toast = useToastStore();
const showLogFlags = ref(false);
const selectedSeqnos = ref<Set<number>>(new Set());
const tableWrapper = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const { y: scrollY } = useScroll(tableWrapper);

type TypeFilter = "all" | "alerts" | "errors";
const typeFilter = ref<TypeFilter>("all");

const { sorting, onSortingChange } = useTableState(
  "event-log-v2",
  ["message", "time", "project", "type"],
  "time",
);

function formatTimestamp(ts: number): string {
  if (ts <= 0) return "---";
  return formatDateTime(ts);
}

/**
 * Project names as they appear in log prefixes. Collected from the messages
 * themselves rather than from the projects store, because a message can name a
 * project that is no longer attached.
 */
const knownProjectNames = computed(() => {
  const names = new Set<string>();
  for (const message of store.messages) {
    if (message.project) names.add(message.project);
  }
  return [...names];
});

function localizedBody(body: string): string {
  return translateLogMessage(body, knownProjectNames.value);
}

function priorityClass(priority: number): string {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "row-error";
  if (priority === MSG_PRIORITY.USER_ALERT) return "row-alert";
  return "";
}

function priorityLabel(priority: number): string {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR)
    return t("messages.priority.error");
  if (priority === MSG_PRIORITY.USER_ALERT) return t("messages.priority.alert");
  return t("messages.priority.info");
}

function priorityVariant(priority: number): "default" | "warning" | "danger" {
  if (priority === MSG_PRIORITY.INTERNAL_ERROR) return "danger";
  if (priority === MSG_PRIORITY.USER_ALERT) return "warning";
  return "default";
}

const columns: ColumnDef<DisplayMessage, unknown>[] = [
  {
    id: "message",
    accessorFn: (row) => row.body,
    header: () => t("messages.col.message"),
    cell: (info) => {
      const original = info.row.original.body;
      const localized = localizedBody(original);
      const row = info.row.original as DisplayMessage;
      const children: unknown[] = [
        isTranslated(original, localized)
          ? h("span", { title: original }, localized)
          : localized,
      ];
      if (row.foldCount && row.foldCount > 1) {
        children.push(
          h(
            "span",
            { class: "fold-count", title: `连续 ${row.foldCount} 条相同消息` },
            ` ×${row.foldCount}`,
          ),
        );
      }
      return children;
    },
    meta: { class: "col-message" },
  },
  {
    id: "time",
    accessorFn: (row) => row.timestamp,
    header: () => t("messages.col.time"),
    cell: (info) => formatTimestamp(info.getValue() as number),
    meta: { class: "col-time" },
  },
  {
    id: "project",
    accessorFn: (row) => row.project,
    header: () => t("messages.col.project"),
    cell: (info) => (info.getValue() as string) || "---",
    meta: { class: "col-project" },
  },
  {
    id: "type",
    accessorFn: (row) => row.priority,
    header: () => t("messages.col.type"),
    cell: (info) =>
      h(
        StatusBadge,
        { variant: priorityVariant(info.getValue() as number) },
        () => priorityLabel(info.getValue() as number),
      ),
    meta: { class: "col-type" },
  },
];

const filteredByType = computed(() => {
  const msgs = store.filteredMessages;
  if (typeFilter.value === "errors") {
    return msgs.filter((m) => m.priority === MSG_PRIORITY.INTERNAL_ERROR);
  }
  if (typeFilter.value === "alerts") {
    return msgs.filter((m) => m.priority >= MSG_PRIORITY.USER_ALERT);
  }
  return msgs;
});

type DisplayMessage = Message & { foldCount?: number };

/** 规范化消息正文，用于识别同一阶段反复出现的日志。 */
function normalizeBody(body: string): string {
  return body
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^[^:]{1,40}:\s*/, "")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const foldDuplicates = ref(true);

/** 60 秒内完全相同的日志折叠为一行，附 ×N 计数，保留最新一条。 */
const foldedMessages = computed<DisplayMessage[]>(() => {
  const source = filteredByType.value;
  if (!foldDuplicates.value) return source;

  const result: DisplayMessage[] = [];
  const lastByKey = new Map<string, { index: number; ts: number }>();

  for (const msg of source) {
    const key = normalizeBody(msg.body);
    const prev = lastByKey.get(key);
    if (prev && msg.timestamp - prev.ts <= 60_000) {
      const row = result[prev.index] as DisplayMessage;
      row.foldCount = (row.foldCount ?? 1) + 1;
      row.seqno = msg.seqno;
      row.timestamp = msg.timestamp;
      prev.ts = msg.timestamp;
    } else {
      lastByKey.set(key, { index: result.length, ts: msg.timestamp });
      result.push({ ...msg });
    }
  }
  return result;
});

const table = useVueTable({
  get data() {
    return foldedMessages.value;
  },
  columns,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

function isSelected(msg: Message): boolean {
  return selectedSeqnos.value.has(msg.seqno);
}

function handleRowClick(msg: Message, _index: number, event: MouseEvent) {
  const seqno = msg.seqno;
  const next = new Set(selectedSeqnos.value);
  if (event.shiftKey && next.size > 0) {
    const sortedMessages = table.getRowModel().rows.map((r) => r.original);
    const seqnos = sortedMessages.map((m) => m.seqno);
    const lastSelected = Array.from(next).pop()!;
    const startIdx = seqnos.indexOf(lastSelected);
    const endIdx = seqnos.indexOf(seqno);
    if (startIdx >= 0 && endIdx >= 0) {
      const [from, to] =
        startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      for (let i = from; i <= to; i++) {
        next.add(seqnos[i]);
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (next.has(seqno)) {
      next.delete(seqno);
    } else {
      next.add(seqno);
    }
  } else {
    const isOnlySelected = next.size === 1 && next.has(seqno);
    next.clear();
    if (!isOnlySelected) {
      next.add(seqno);
    }
  }
  selectedSeqnos.value = next;
}

function selectAll() {
  selectedSeqnos.value = new Set(
    table.getRowModel().rows.map((r) => r.original.seqno),
  );
}

function formatMessage(m: {
  timestamp: number;
  project: string;
  body: string;
}): string {
  return `[${formatTimestamp(m.timestamp)}] ${m.project ? m.project + ": " : ""}${m.body}`;
}

const visibleSelectedCount = computed(() => {
  if (selectedSeqnos.value.size === 0) return 0;
  return filteredByType.value.filter((m) =>
    selectedSeqnos.value.has(m.seqno),
  ).length;
});

async function copySelectedToClipboard() {
  const visible = filteredByType.value;
  const visibleSelected = visible.filter((m) =>
    selectedSeqnos.value.has(m.seqno),
  );
  const msgs = visibleSelected.length > 0 ? visibleSelected : visible;
  const text = msgs.map(formatMessage).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast.show(t("messages.copySuccess", { n: msgs.length }), "success");
  } catch {
    // WebView 下 clipboard API 可能不可用，用 execCommand 兜底
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      toast.show(
        ok ? t("messages.copySuccess", { n: msgs.length }) : t("messages.copyFailed"),
        ok ? "success" : "error",
      );
    } catch {
      toast.show(t("messages.copyFailed"), "error");
    }
  }
}

// Auto-scroll logic
function scrollToBottom() {
  const el = tableWrapper.value;
  if (el) {
    el.scrollTo({ top: el.scrollHeight });
  }
}

watch(
  () => table.getRowModel().rows.length,
  (newLen, oldLen) => {
    if (newLen <= oldLen) return;

    if (
      isAtBottom.value &&
      sorting.value.length > 0 &&
      sorting.value[0].id === "time" &&
      !sorting.value[0].desc
    ) {
      nextTick(scrollToBottom);
    }
  },
);

// Scroll-up detection for loading older messages
watch(
  () => scrollY.value,
  () => {
    const el = tableWrapper.value;
    if (!el) return;

    const threshold = 30;
    isAtBottom.value =
      el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;

    // Load older messages when scrolled near top
    if (el.scrollTop < 100 && store.hasMore && !store.loadingMore) {
      const prevHeight = el.scrollHeight;
      store.fetchOlderMessages().then(() => {
        // Preserve scroll position after prepending older messages
        nextTick(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop += newHeight - prevHeight;
        });
      });
    }
  },
);

function isTypingInInput(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

onKeyStroke("a", (e) => {
  if (isTypingInInput(e) || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  selectAll();
});

onKeyStroke("Escape", (e) => {
  if (isTypingInInput(e)) return;
  selectedSeqnos.value = new Set();
});

onKeyStroke("c", (e) => {
  if (isTypingInInput(e) || !(e.ctrlKey || e.metaKey)) return;
  if (visibleSelectedCount.value === 0) return;
  e.preventDefault();
  copySelectedToClipboard();
});

onMounted(() => {
  store.startPolling(1000);
  nextTick(() => {
    const wrapper = document.querySelector(
      ".messages-view .data-table-wrapper",
    ) as HTMLElement | null;
    if (wrapper) {
      tableWrapper.value = wrapper;
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  store.stopPolling();
});
</script>

<template>
  <div class="messages-view" @click="selectedSeqnos = new Set()">
    <PageHeader @click.stop>
      <button class="btn" @click="showLogFlags = true">
        {{ $t("messages.logFlags") }}
      </button>
      <button class="btn" @click="selectAll">
        {{ $t("messages.selectAll") }}
      </button>
      <button class="btn" @click="copySelectedToClipboard">
        {{
          visibleSelectedCount > 0
            ? $t("messages.copySelected", visibleSelectedCount)
            : $t("messages.copyAll")
        }}
      </button>
    </PageHeader>

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <input
          v-model="store.searchText"
          type="text"
          class="search-input"
          :placeholder="$t('messages.searchPlaceholder')"
        />
      </div>

      <div class="segmented-control">
        <button
          :class="['segment', { active: typeFilter === 'all' }]"
          @click="typeFilter = 'all'"
        >
          {{ $t("messages.filterAll") }}
        </button>
        <button
          :class="['segment', { active: typeFilter === 'alerts' }]"
          @click="typeFilter = 'alerts'"
        >
          {{ $t("messages.filterAlerts") }}
        </button>
        <button
          :class="['segment', { active: typeFilter === 'errors' }]"
          @click="typeFilter = 'errors'"
        >
          {{ $t("messages.filterErrors") }}
        </button>
      </div>
      <label class="fold-toggle" :title="$t('messages.foldHint')">
        <input v-model="foldDuplicates" type="checkbox" />
        {{ $t("messages.foldDuplicates") }}
      </label>
    </div>

    <EmptyState
      v-if="table.getRowModel().rows.length === 0 && !store.loading"
      icon="messages"
      :message="$t('messages.empty')"
    />

    <template v-else>
      <div v-if="store.loadingMore" class="loading-more">
        {{ $t("messages.loadingMore") }}
      </div>

      <DataTable
        :table="table"
        :is-row-selected="isSelected"
        :row-class="(msg: Message) => priorityClass(msg.priority)"
        @row-click="handleRowClick"
      />
    </template>

    <LogFlagsDialog :open="showLogFlags" @close="showLogFlags = false" />
  </div>
</template>

<style scoped>
.messages-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-md);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.search-input {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  min-width: 220px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.segmented-control {
  display: inline-flex;
  flex-wrap: wrap;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
}

.segment {
  padding: 5px 12px;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  font-weight: 500;
}

.segment.active {
  background: var(--color-bg);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-sm);
}

.segment:hover:not(.active) {
  color: var(--color-text-primary);
}

.loading-more {
  padding: var(--space-sm) var(--space-md);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.col-time {
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 150px;
}

.col-project {
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-type {
  white-space: nowrap;
}

.col-message {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 240px;
}

.fold-count {
  color: var(--color-accent-text);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.fold-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  white-space: nowrap;
}

:deep(.row-error) {
  background: var(--color-danger-light) !important;
}

:deep(.row-error) td {
  color: var(--color-danger-text);
}

:deep(.row-alert) {
  background: var(--color-warning-light) !important;
}

:deep(.row-alert) td {
  color: var(--color-warning-text);
}

:deep(.row-selected) {
  background: var(--color-accent-light) !important;
}

:deep(tr) {
  cursor: pointer;
  user-select: none;
}

@media (max-width: 767px) {
  .search-input {
    min-width: 120px;
  }
}
</style>
