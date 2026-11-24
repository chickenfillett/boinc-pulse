/**
 * Chinese-locale formatting helpers.
 *
 * BOINC hands us raw integers (credits in the millions, byte counts, unix
 * timestamps). Western shorthand such as "8.6M" is unreadable for a Chinese
 * user, so credits are folded into 万 / 亿 and every date renders in the
 * 年月日 order. All formatters are pure and safe on nullish input — the
 * dashboard renders during the first RPC round-trip when fields are still
 * undefined.
 */

const TEN_THOUSAND = 10_000;
const ONE_HUNDRED_MILLION = 100_000_000;

/** Trim trailing zeros: 8.60 → "8.6", 9.00 → "9". */
function trimZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

/**
 * Format a credit-like integer with Chinese units.
 *   8_641_260   → "864.1 万"
 *   123_456_789 → "1.23 亿"
 *   9_500       → "9,500"
 */
export function formatCredit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= ONE_HUNDRED_MILLION) {
    return `${sign}${trimZeros((abs / ONE_HUNDRED_MILLION).toFixed(2))} 亿`;
  }
  if (abs >= TEN_THOUSAND) {
    return `${sign}${trimZeros((abs / TEN_THOUSAND).toFixed(1))} 万`;
  }
  return `${sign}${Math.round(abs).toLocaleString("zh-CN")}`;
}

/** Same rules as formatCredit but without the trailing unit, for tight tiles. */
export function formatCreditParts(value: number | null | undefined): {
  value: string;
  unit: string;
} {
  if (value == null || !Number.isFinite(value)) return { value: "—", unit: "" };
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= ONE_HUNDRED_MILLION) {
    return {
      value: `${sign}${trimZeros((abs / ONE_HUNDRED_MILLION).toFixed(2))}`,
      unit: "亿",
    };
  }
  if (abs >= TEN_THOUSAND) {
    return {
      value: `${sign}${trimZeros((abs / TEN_THOUSAND).toFixed(1))}`,
      unit: "万",
    };
  }
  return { value: `${sign}${Math.round(abs).toLocaleString("zh-CN")}`, unit: "" };
}

/**
 * Short duration for metric tiles: "4,570 小时", "36 分钟", "12 天".
 * Uses 小时 once the span exceeds two days, which is how BOINC users talk
 * about accumulated runtime.
 */
export function formatDurationShort(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} 秒`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rem = minutes % 60;
    return rem > 0 ? `${hours} 小时 ${rem} 分` : `${hours} 小时`;
  }
  const days = Math.floor(hours / 24);
  return `${days.toLocaleString("zh-CN")} 天`;
}

/**
 * Precise remaining-time string for a running task: "1 小时 23 分".
 * Returns "计算中" when the client has no estimate yet (common in the first
 * minutes after a task starts).
 */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return "正在估算";
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours > 0 ? `${days} 天 ${restHours} 小时` : `${days} 天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }
  if (minutes > 0) return `${minutes} 分钟`;
  return "不到 1 分钟";
}

/** Right-aligned percent with one decimal only when it adds information. */
export function formatPercent(
  ratio: number | null | undefined,
  digits = 1,
): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  const pct = ratio * 100;
  if (pct >= 99.95) return "100%";
  if (pct < 0.1 && pct > 0) return "<0.1%";
  const fixed = pct.toFixed(pct < 10 ? digits : 0);
  return `${trimZeros(fixed)}%`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "2026年11月23日 22:59" */
export function formatDateTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

/** "11月23日 22:59" — for dense lists where the year is implied. */
export function formatDateTimeShort(
  unixSeconds: number | null | undefined,
): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`;
}

/** "3 分钟前" / "刚刚" */
export function formatRelativeTime(
  unixSeconds: number | null | undefined,
): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return formatDateTimeShort(unixSeconds);
}

/** Bytes → "31.9 GB" (binary units, matching what Windows shows). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = idx >= 3 ? 1 : 0;
  return `${trimZeros(value.toFixed(digits))} ${units[idx]}`;
}

/**
 * Strip a BOINC project URL down to its hostname so the dashboard can label a
 * project without loading the full project record.
 */
export function projectHost(masterUrl: string | null | undefined): string {
  if (!masterUrl) return "未知项目";
  try {
    const url = new URL(masterUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return masterUrl;
  }
}
