<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useStatisticsStore } from "../stores/statistics";
import { useProjectsStore } from "../stores/projects";
import type { DailyStats } from "../types/boinc";
import PageHeader from "../components/PageHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import StatisticsChart from "../components/StatisticsChart.vue";
import AppSelect from "../components/AppSelect.vue";
import { onKeyStroke } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { SERIES_COLORS, CHART_PALETTE } from "../constants/chartColors";

const { t } = useI18n();
const store = useStatisticsStore();
const projectsStore = useProjectsStore();

/** 两种视图：单项目 / 全部项目合并。 */
type ViewMode = "single" | "all";
/** 时间区间，由父级持有，两张图共用，保证切换同步。 */
type RangeKey = "7" | "30" | "all";

const viewMode = ref<ViewMode>("single");
const range = ref<RangeKey>("30");
const selectedProjectUrl = ref("");
const pickerOpen = ref(false);

const RANGE_LABELS: { key: RangeKey; labelKey: string }[] = [
  { key: "7", labelKey: "statistics.range.week" },
  { key: "30", labelKey: "statistics.range.month" },
  { key: "all", labelKey: "statistics.range.all" },
];

const actorColors = SERIES_COLORS;

const enabledActors = ref<Set<string>>(new Set(["user", "host"]));

function toggleActor(actor: string) {
  const next = new Set(enabledActors.value);
  if (next.has(actor)) {
    if (next.size > 1) next.delete(actor);
  } else {
    next.add(actor);
  }
  enabledActors.value = next;
}

function hasRecentActivity(stats: DailyStats[]): boolean {
  if (stats.length === 0) return false;
  if (stats.length === 1) return true;
  const first = stats[0];
  const last = stats[stats.length - 1];
  return (
    last.user_total_credit > first.user_total_credit ||
    last.host_total_credit > first.host_total_credit
  );
}

const enabledTotalSeries = computed(() => {
  const set = new Set<string>();
  if (enabledActors.value.has("user")) set.add("user_total_credit");
  if (enabledActors.value.has("host")) set.add("host_total_credit");
  return set;
});

const enabledAvgSeries = computed(() => {
  const set = new Set<string>();
  if (enabledActors.value.has("user")) set.add("user_expavg_credit");
  if (enabledActors.value.has("host")) set.add("host_expavg_credit");
  return set;
});

function projectLabel(masterUrl: string): string {
  const project = projectsStore.projects.find(
    (proj) => proj.master_url === masterUrl,
  );
  return project?.project_name || masterUrl;
}

const projectOptions = computed(() =>
  store.projectStats
    .filter((p) => hasRecentActivity(p.daily_statistics))
    .map((p) => ({
      value: p.master_url,
      label: projectLabel(p.master_url),
    })),
);

const activeProject = computed(() => {
  if (!selectedProjectUrl.value && projectOptions.value.length > 0) {
    selectedProjectUrl.value = projectOptions.value[0].value;
  }
  return store.projectStats.find(
    (p) => p.master_url === selectedProjectUrl.value,
  );
});

function mergeAllProjects(): DailyStats[] {
  const dayMap = new Map<number, DailyStats>();
  for (const project of store.projectStats) {
    for (const ds of project.daily_statistics) {
      const existing = dayMap.get(ds.day);
      if (existing) {
        existing.user_total_credit += ds.user_total_credit;
        existing.user_expavg_credit += ds.user_expavg_credit;
        existing.host_total_credit += ds.host_total_credit;
        existing.host_expavg_credit += ds.host_expavg_credit;
      } else {
        dayMap.set(ds.day, { ...ds });
      }
    }
  }
  return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
}

const chartData = computed(() => {
  if (store.projectStats.length === 0) return null;

  if (viewMode.value === "single") {
    if (!activeProject.value) return null;
    const stats = activeProject.value.daily_statistics;
    return stats.length === 0 ? null : stats;
  }
  const stats = mergeAllProjects();
  return stats.length === 0 ? null : stats;
});

/** 全部模式下参与合并的项目及其配色，用于图例展示。 */
const projectLegend = computed(() => {
  if (viewMode.value !== "all") return [];
  return store.projectStats
    .filter((p) => p.daily_statistics.length > 0)
    .map((p, index) => ({
      label: projectLabel(p.master_url),
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    }));
});

/** 数据可用天数，用于区间不足提示。 */
const availableDays = computed(() => chartData.value?.length ?? 0);
const rangeInsufficient = computed(() => {
  if (range.value === "all") return false;
  const need = range.value === "7" ? 7 : 30;
  return availableDays.value > 0 && availableDays.value < need;
});

onMounted(() => {
  store.fetchStatistics();
});

onUnmounted(() => {
  // nothing to clean up
});

// Keyboard shortcuts
function isTypingInInput(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    pickerOpen.value
  );
}

const viewModes: ViewMode[] = ["single", "all"];

onKeyStroke(["1", "2"], (e) => {
  if (isTypingInInput(e)) return;
  e.preventDefault();
  viewMode.value = viewModes[Number(e.key) - 1];
});

onKeyStroke("u", (e) => {
  if (isTypingInInput(e)) return;
  if (e.repeat) return;
  toggleActor("user");
});

onKeyStroke("h", (e) => {
  if (isTypingInInput(e)) return;
  if (e.repeat) return;
  toggleActor("host");
});
</script>

<template>
  <div class="statistics-view">
    <PageHeader />

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <div
      v-if="store.loading && store.projectStats.length === 0"
      class="loading-text"
    >
      {{ $t("statistics.loading") }}
    </div>

    <EmptyState
      v-else-if="store.projectStats.length === 0 && !store.loading"
      icon="chart"
      :message="$t('statistics.empty')"
    />

    <template v-else>
      <!-- Controls bar -->
      <div class="controls-bar">
        <div class="segmented-control">
          <button
            :class="['segment', { active: viewMode === 'single' }]"
            @click="viewMode = 'single'"
          >
            {{ $t("statistics.singleProject") }}
          </button>
          <button
            :class="['segment', { active: viewMode === 'all' }]"
            @click="viewMode = 'all'"
          >
            {{ $t("statistics.allProjects") }}
          </button>
        </div>

        <AppSelect
          v-if="viewMode === 'single'"
          v-model="selectedProjectUrl"
          :options="projectOptions"
          :placeholder="$t('statistics.selectProject')"
          @open="pickerOpen = true"
          @close="pickerOpen = false"
        />
      </div>

      <!-- Range selector: shared by both charts -->
      <div class="range-bar">
        <button
          v-for="opt in RANGE_LABELS"
          :key="opt.key"
          :class="['segment', { active: range === opt.key }]"
          @click="range = opt.key"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
      <p v-if="rangeInsufficient" class="range-note">
        {{ $t("statistics.range.insufficient", { n: availableDays }) }}
      </p>

      <!-- Actor toggles -->
      <div class="series-toggles">
        <label class="series-toggle">
          <input
            type="checkbox"
            :checked="enabledActors.has('user')"
            @change="toggleActor('user')"
          />
          <span
            class="series-swatch"
            :style="{ background: actorColors.user }"
          ></span>
          <span class="series-label">{{ $t("statistics.user") }}</span>
        </label>
        <label class="series-toggle">
          <input
            type="checkbox"
            :checked="enabledActors.has('host')"
            @change="toggleActor('host')"
          />
          <span
            class="series-swatch"
            :style="{ background: actorColors.host }"
          ></span>
          <span class="series-label">{{ $t("statistics.host") }}</span>
        </label>
      </div>

      <!-- Project legend in "all" mode -->
      <div v-if="viewMode === 'all' && projectLegend.length > 0" class="project-legend">
        <span v-for="item in projectLegend" :key="item.label" class="project-legend-item">
          <span class="series-swatch" :style="{ background: item.color }"></span>
          {{ item.label }}
        </span>
      </div>

      <!-- Both charts share the same range -->
      <template v-if="chartData">
        <StatisticsChart
          :data="chartData"
          :title="$t('statistics.totalCredit')"
          :enabled-series="enabledTotalSeries"
          :range="range"
          mode="delta"
        />
        <StatisticsChart
          :data="chartData"
          :title="$t('statistics.avgCredit')"
          :enabled-series="enabledAvgSeries"
          :range="range"
          mode="line"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.statistics-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto;
  padding: 0 var(--space-lg) var(--space-lg);
}

.error-text {
  color: var(--color-danger);
  font-size: var(--font-size-md);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  padding: var(--space-xl) 0;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
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

.range-bar {
  display: inline-flex;
  align-self: flex-start;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
  margin-bottom: var(--space-sm);
}

.range-note {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-warning-text);
}

.project-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: var(--space-sm);
}

.project-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.series-toggles {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.series-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.series-toggle input {
  display: none;
}

.series-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.series-label {
  font-weight: 500;
}

.series-toggle:has(input:not(:checked)) .series-swatch {
  opacity: 0.3;
}

.series-toggle:has(input:not(:checked)) .series-label {
  opacity: 0.5;
  text-decoration: line-through;
}

</style>
