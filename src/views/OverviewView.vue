<script setup lang="ts">
/**
 * Overview — the single screen that answers "is it working, what is it doing,
 * and is my machine fine?" without a single click.
 *
 * Design constraints (deliberate, not stylistic):
 *  - Fits 460×640 with no vertical scroll; never scrolls horizontally.
 *  - Reuses the polling stores started by App.vue — no extra RPC loops.
 *  - Shows only numbers that exist in client_state; nothing is estimated.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTasksStore } from "../stores/tasks";
import { useProjectsStore } from "../stores/projects";
import { useClientStore } from "../stores/client";
import { useConnectionStore } from "../stores/connection";
import { getHostInfo } from "../composables/useRpc";
import type { HostInfo, TaskResult } from "../types/boinc";
import { ACTIVE_TASK_STATE, CONNECTION_STATE, RUN_MODE } from "../types/boinc";
import {
  formatBytes,
  formatCreditParts,
  formatDurationShort,
  formatEta,
  formatPercent,
} from "../utils/format";
import { lookupProjectCard, projectHomeLink } from "../utils/projectInfo";
import { colorForIndex } from "../constants/chartColors";

const { t } = useI18n();
const router = useRouter();

const tasksStore = useTasksStore();
const projectsStore = useProjectsStore();
const clientStore = useClientStore();
const connection = useConnectionStore();

const hostInfo = ref<HostInfo | null>(null);
let hostTimer: ReturnType<typeof setInterval> | null = null;

async function loadHost() {
  try {
    hostInfo.value = await getHostInfo();
  } catch {
    // Host info is cosmetic; a failure must not blank the dashboard.
  }
}

onMounted(() => {
  loadHost();
  hostTimer = setInterval(loadHost, 60_000);
});

onUnmounted(() => {
  if (hostTimer !== null) clearInterval(hostTimer);
});

/* ---------- run state ---------- */

const isPaused = computed(() => clientStore.status.task_mode === RUN_MODE.NEVER);
const isSuspended = computed(() => {
  const s = clientStore.status;
  return s.task_suspend_reason !== 0 || s.gpu_suspend_reason !== 0;
});

/**
 * `active_task` only means "loaded into a slot". A task can be loaded and
 * suspended, so the honest state has to come from ACTIVE_TASK_STATE — otherwise
 * the header claims "computing" while nothing is running.
 */
const loadedTasks = computed(() =>
  tasksStore.tasks.filter((task) => task.active_task),
);
const executingTasks = computed(() => loadedTasks.value.filter(isExecuting));

const runStateLabel = computed(() => {
  if (isPaused.value) return t("overview.state.paused");
  if (isSuspended.value) return t("overview.state.suspended");
  if (loadedTasks.value.length === 0) return t("overview.state.idle");
  if (executingTasks.value.length === 0) return t("overview.state.allSuspended");
  return t("overview.state.running");
});

async function togglePause() {
  await clientStore.setRunMode(isPaused.value ? RUN_MODE.AUTO : RUN_MODE.NEVER);
}

/* ---------- tasks ---------- */

const projectNameByUrl = computed(() => {
  const map = new Map<string, string>();
  for (const p of projectsStore.projects) {
    map.set(p.master_url, p.project_name);
  }
  return map;
});

function nameFor(task: TaskResult): string {
  return (
    lookupProjectCard(task.project_url)?.name ??
    projectNameByUrl.value.get(task.project_url) ??
    t("overview.unknownProject")
  );
}

function isExecuting(task: TaskResult): boolean {
  return (
    task.active_task &&
    task.active_task_state === ACTIVE_TASK_STATE.EXECUTING &&
    !task.suspended_via_gui &&
    !task.project_suspended_via_gui
  );
}

/** Executing tasks when there are any, otherwise the paused ones for context. */
const runningTasks = computed(() =>
  executingTasks.value.length > 0 ? executingTasks.value : loadedTasks.value,
);

const primaryTask = computed(() => runningTasks.value[0] ?? null);
const secondaryTasks = computed(() => runningTasks.value.slice(1, 3));
const hiddenTaskCount = computed(() =>
  Math.max(0, runningTasks.value.length - 3),
);

function isGpuTask(task: TaskResult): boolean {
  return /GPU/i.test(task.resources ?? "");
}

function progressOf(task: TaskResult): number {
  return Math.min(1, Math.max(0, task.fraction_done ?? 0));
}

/* ---------- credits ---------- */

const totalCredit = computed(() =>
  projectsStore.projects.reduce(
    (sum, p) => sum + (p.user_total_credit ?? 0),
    0,
  ),
);
const hostCredit = computed(() =>
  projectsStore.projects.reduce((sum, p) => sum + (p.host_total_credit ?? 0), 0),
);
const dailyCredit = computed(() =>
  projectsStore.projects.reduce(
    (sum, p) => sum + (p.user_expavg_credit ?? 0),
    0,
  ),
);

const jobCounts = computed(() => {
  let ok = 0;
  let err = 0;
  for (const p of projectsStore.projects) {
    ok += p.njobs_success ?? 0;
    err += p.njobs_error ?? 0;
  }
  return { ok, err };
});

const successRate = computed(() => {
  const { ok, err } = jobCounts.value;
  const total = ok + err;
  return total > 0 ? ok / total : null;
});

/* ---------- project share ---------- */

const projectShares = computed(() => {
  const total = totalCredit.value;
  return projectsStore.projects
    .map((p) => ({
      url: p.master_url,
      name: lookupProjectCard(p.master_url)?.name ?? p.project_name,
      credit: p.user_total_credit ?? 0,
      share: total > 0 ? (p.user_total_credit ?? 0) / total : 0,
    }))
    .filter((row) => row.credit > 0)
    .sort((a, b) => b.credit - a.credit);
});

function shareColor(index: number): string {
  return colorForIndex(index);
}

/* ---------- machine ---------- */

const cpuLabel = computed(() => {
  const h = hostInfo.value;
  if (!h) return t("overview.machine.loading");
  const model = (h.p_model ?? "")
    .replace(/\(R\)|\(TM\)|CPU|@.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${h.p_ncpus} 核${model ? ` · ${model}` : ""}`;
});

const gpuLabel = computed(() => {
  const coprocs = hostInfo.value?.coprocs ?? [];
  const gpu = coprocs.find((c) => /GPU|CUDA|OpenCL/i.test(c.coproc_type));
  if (!gpu) return t("overview.machine.noGpu");
  return `${gpu.name}${gpu.count > 1 ? ` ×${gpu.count}` : ""}`;
});

const memoryLabel = computed(() => {
  const h = hostInfo.value;
  if (!h) return "—";
  return formatBytes(h.m_nbytes);
});

const diskFreeRatio = computed(() => {
  const h = hostInfo.value;
  if (!h || !h.d_total) return null;
  return h.d_free / h.d_total;
});

const diskLabel = computed(() => {
  const h = hostInfo.value;
  if (!h) return "—";
  return `${t("overview.machine.diskFree")} ${formatBytes(h.d_free)}`;
});

/** Three-level health verdict, read-only. */
const diskTone = computed<"ok" | "warn" | "bad">(() => {
  const ratio = diskFreeRatio.value;
  if (ratio == null) return "ok";
  if (ratio < 0.03) return "bad";
  if (ratio < 0.1) return "warn";
  return "ok";
});

const overallTone = computed<"ok" | "warn" | "bad">(() => {
  const tones: Array<"ok" | "warn" | "bad"> = [diskTone.value];
  if (successRate.value != null && successRate.value < 0.9) tones.push("warn");
  if (tones.includes("bad")) return "bad";
  if (tones.includes("warn")) return "warn";
  return "ok";
});

const overallLabel = computed(() => {
  if (overallTone.value === "bad") return t("overview.health.bad");
  if (overallTone.value === "warn") return t("overview.health.warn");
  return t("overview.health.ok");
});

/* ---------- navigation ---------- */

function go(path: string) {
  router.push(path);
}

/** Open the project's own site — the only "real world" link that always works. */
async function openProjectSite(masterUrl: string) {
  const link = projectHomeLink(masterUrl);
  if (!link) return;
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(link);
  } catch {
    window.open(link, "_blank", "noopener");
  }
}

const connected = computed(() => connection.state === CONNECTION_STATE.CONNECTED);
</script>

<template>
  <div class="overview">
    <!-- Run state -->
    <header class="run-strip">
      <div class="run-text">
        <span class="run-state">{{ runStateLabel }}</span>
        <span v-if="runningTasks.length > 0" class="run-count">
          {{ t("overview.taskCount", { n: runningTasks.length }) }}
        </span>
      </div>
      <button
        type="button"
        class="run-toggle"
        :aria-label="isPaused ? t('overview.resume') : t('overview.pause')"
        @click="togglePause"
      >
        <svg
          v-if="isPaused"
          viewBox="0 0 20 20"
          fill="currentColor"
          width="14"
          height="14"
        >
          <path d="M6 4l9 6-9 6V4z" />
        </svg>
        <svg v-else viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M5 4h3.5v12H5V4zm6.5 0H15v12h-3.5V4z" />
        </svg>
        <span>{{ isPaused ? t("overview.resume") : t("overview.pause") }}</span>
      </button>
    </header>

    <!-- Primary running task -->
    <section v-if="primaryTask" class="card primary-task">
      <div class="task-head">
        <span class="task-project">{{ nameFor(primaryTask) }}</span>
        <span v-if="isGpuTask(primaryTask)" class="chip chip-gpu">GPU</span>
      </div>
      <div class="task-name" :title="primaryTask.wu_name">
        {{ primaryTask.wu_name }}
      </div>

      <div class="bar-row">
        <div class="bar">
          <div
            class="bar-fill"
            :style="{ width: `${progressOf(primaryTask) * 100}%` }"
          ></div>
        </div>
        <span class="bar-pct">{{ formatPercent(progressOf(primaryTask)) }}</span>
      </div>

      <div class="task-meta">
        <span>
          {{ t("overview.eta") }}
          {{ formatEta(primaryTask.estimated_cpu_time_remaining) }}
        </span>
        <span class="meta-dim">
          {{ t("overview.elapsed") }}
          {{ formatDurationShort(primaryTask.elapsed_time) }}
        </span>
      </div>
    </section>

    <section v-else class="card empty-task">
      <span class="empty-title">{{ t("overview.noActiveTask") }}</span>
    </section>

    <!-- Secondary tasks -->
    <ul v-if="secondaryTasks.length > 0" class="task-list">
      <li
        v-for="task in secondaryTasks"
        :key="`${task.project_url}:${task.name}`"
        class="task-row"
      >
        <span class="row-name">{{ nameFor(task) }}</span>
        <div class="row-bar">
          <div
            class="row-fill"
            :style="{ width: `${progressOf(task) * 100}%` }"
          ></div>
        </div>
        <span class="row-pct">{{ formatPercent(progressOf(task)) }}</span>
      </li>
      <li
        v-if="hiddenTaskCount > 0"
        class="task-row more-row"
        @click="go('/tasks')"
      >
        <span class="row-name">
          {{ t("overview.moreTasks", { n: hiddenTaskCount }) }}
        </span>
      </li>
    </ul>

    <!-- Metrics -->
    <div class="metrics">
      <button type="button" class="metric" @click="go('/statistics')">
        <span class="metric-value">
          {{ formatCreditParts(totalCredit).value
          }}<em>{{ formatCreditParts(totalCredit).unit }}</em>
        </span>
        <span class="metric-label">{{ t("overview.metric.totalCredit") }}</span>
      </button>
      <button type="button" class="metric" @click="go('/host')">
        <span class="metric-value">
          {{ formatCreditParts(hostCredit).value
          }}<em>{{ formatCreditParts(hostCredit).unit }}</em>
        </span>
        <span class="metric-label">{{ t("overview.metric.hostCredit") }}</span>
      </button>
      <div class="metric">
        <span class="metric-value">
          {{ formatCreditParts(dailyCredit).value
          }}<em>{{ formatCreditParts(dailyCredit).unit }}</em>
        </span>
        <span class="metric-label">{{ t("overview.metric.dailyCredit") }}</span>
      </div>
      <div class="metric">
        <span class="metric-value">
          {{ formatCreditParts(jobCounts.ok).value
          }}<em>{{ formatCreditParts(jobCounts.ok).unit }}</em>
        </span>
        <span class="metric-label">{{ t("overview.metric.completedTasks") }}</span>
      </div>
    </div>

    <!-- Project share -->
    <section class="card share-card">
      <div class="card-title">{{ t("overview.share.title") }}</div>
      <ul v-if="projectShares.length > 0" class="share-list">
        <li v-for="(row, idx) in projectShares" :key="row.url" class="share-row">
          <button
            type="button"
            class="share-row-head"
            :title="`${row.name} · ${t('overview.share.open')}`"
            @click="openProjectSite(row.url)"
          >
            <span class="legend-dot" :style="{ background: shareColor(idx) }"></span>
            <span class="share-row-name">{{ row.name }}</span>
            <span class="share-row-pct">{{ formatPercent(row.share) }}</span>
          </button>
          <div class="share-row-track">
            <div
              class="share-row-fill"
              :style="{ width: `${row.share * 100}%`, background: shareColor(idx) }"
            ></div>
          </div>
        </li>
      </ul>
      <p v-else class="share-empty">{{ t("overview.share.empty") }}</p>
    </section>

    <!-- Machine -->
    <section class="card machine-card">
      <div class="machine-head">
        <span class="card-title">{{ t("overview.machine.title") }}</span>
        <span class="health" :class="`tone-${overallTone}`">{{ overallLabel }}</span>
      </div>
      <dl class="machine-grid">
        <div class="machine-item">
          <dt>{{ t("overview.machine.cpu") }}</dt>
          <dd>{{ cpuLabel }}</dd>
        </div>
        <div class="machine-item">
          <dt>{{ t("overview.machine.gpu") }}</dt>
          <dd>{{ gpuLabel }}</dd>
        </div>
        <div class="machine-item">
          <dt>{{ t("overview.machine.memory") }}</dt>
          <dd>{{ memoryLabel }}</dd>
        </div>
        <div class="machine-item">
          <dt>{{ t("overview.machine.disk") }}</dt>
          <dd>{{ diskLabel }}</dd>
        </div>
      </dl>
    </section>

    <p v-if="!connected" class="offline-note">{{ t("overview.offline") }}</p>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 14px;
  /* Must be a flex child of .main-content, not height:100% — the parent has no
     explicit height, so 100% would collapse and clip the dashboard. */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--color-bg);
}

/* --- run strip --- */
.run-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 2px 2px 0;
}

.run-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.run-state {
  font-size: 14px;
  font-weight: 650;
  color: var(--color-text-primary);
  letter-spacing: 0.2px;
}
.run-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.run-toggle {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: var(--transition-fast);
  flex-shrink: 0;
}
.run-toggle:hover {
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

/* --- cards --- */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  flex-shrink: 0;
}

.primary-task {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-project {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-accent-text);
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.chip-gpu {
  color: var(--color-success-text);
  background: var(--color-success-light);
}

.task-name {
  font-size: 13px;
  font-family: var(--font-mono, "Cascadia Mono", Consolas, monospace);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #1b1b26;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-accent);
  transition: width 0.6s ease;
}
.bar-pct {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  min-width: 44px;
  text-align: right;
}

.task-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.meta-dim {
  color: var(--color-text-tertiary);
}

/* --- empty --- */
.empty-task {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 16px 12px;
}
.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
/* --- secondary list --- */
.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}
.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
}
.row-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  max-width: 40%;
}
.row-bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: #1b1b26;
  overflow: hidden;
}
.row-fill {
  height: 100%;
  background: var(--color-accent);
  opacity: 0.75;
}
.row-pct {
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-tertiary);
  min-width: 34px;
  text-align: right;
}
.more-row {
  justify-content: center;
  cursor: pointer;
  background: transparent;
  border-style: dashed;
}
.more-row .row-name {
  max-width: none;
  color: var(--color-text-tertiary);
  font-size: 10.5px;
}
.more-row:hover .row-name {
  color: var(--color-accent-text);
}

/* --- metrics --- */
.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px 10px;
  background: var(--color-bg-secondary);
  border: none;
  text-align: left;
  cursor: default;
  font: inherit;
}
button.metric {
  cursor: pointer;
}
button.metric:hover {
  background: var(--color-bg-tertiary);
}
.metric-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.2px;
  line-height: 1.15;
}
.metric-value em {
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin-left: 2px;
}
.metric-label {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.2px;
}

/* --- share --- */
.share-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.card-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  letter-spacing: 0.6px;
}
.share-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.share-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.share-row-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  font-size: 11px;
  font-family: inherit;
  text-align: left;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
}
.share-row-head:hover .share-row-name {
  color: var(--color-accent-text);
}
.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex-shrink: 0;
}
.share-row-name {
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.share-row-pct {
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.share-row-track {
  height: 5px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--color-bg-tertiary);
}
.share-row-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.share-empty {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* --- machine --- */
.machine-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.machine-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.health {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
}
.health.tone-ok {
  color: var(--color-success-text);
}
.health.tone-warn {
  color: var(--color-warning-text);
}
.health.tone-bad {
  color: var(--color-danger-text);
}

.machine-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  margin: 0;
}
.machine-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.machine-item dt {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  width: 30px;
  flex-shrink: 0;
}
.machine-item dd {
  margin: 0;
  font-size: 11.5px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.offline-note {
  margin: 0;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--color-warning-text);
  background: var(--color-warning-light);
  border-radius: var(--radius-md);
}
</style>
