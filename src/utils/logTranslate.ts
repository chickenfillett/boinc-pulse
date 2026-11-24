/**
 * BOINC event-log translation layer.
 *
 * The BOINC client emits English log lines from C++ (`boinc/util.cpp`,
 * `client/cpu_sched.cpp`, …). Rebuilding the client is out of scope, so this
 * module matches the message shapes instead. It is a *presentation layer*: the
 * original string is always kept and shown on hover, so nothing is lost when a
 * rule misses.
 *
 * Coverage strategy, in order:
 *   1. Suspension / resumption reasons (the lines a user actually reads).
 *   2. Scheduler and transfer milestones (what "is it working?" means).
 *   3. Task lifecycle.
 *   4. Hard errors a user may need to act on.
 * Anything unmatched falls through unchanged, which is the safe failure mode.
 */

type Replacer = string | ((match: RegExpMatchArray) => string);

interface Rule {
  pattern: RegExp;
  replace: Replacer;
}

/** Trim a numeric argument and keep it as-is; BOINC prints raw seconds. */
function num(value: string): string {
  return value.trim();
}

const RULES: Rule[] = [
  // ── startup ────────────────────────────────────────────────────────────
  {
    pattern: /^Starting BOINC client version (\S+) for (\S+)$/i,
    replace: (m) => `正在启动 BOINC 客户端 ${num(m[1])}（${m[2]}）`,
  },
  {
    pattern: /^Projects:\s*(.+)$/i,
    replace: (m) => `已加入项目：${m[1].replace(/,\s*/g, "、")}`,
  },
  {
    pattern: /^Running under account (.+)$/i,
    replace: (m) => `运行账户：${m[1]}`,
  },
  {
    pattern: /^Processor:\s*(.+)$/i,
    replace: (m) => `处理器：${m[1]}`,
  },
  {
    pattern: /^OS:\s*(.+)$/i,
    replace: (m) => `操作系统：${m[1]}`,
  },
  {
    pattern: /^Memory:\s*([\d.]+) MB physical,\s*([\d.]+) MB virtual$/i,
    replace: (m) => `内存：物理 ${m[1]} MB，虚拟 ${m[2]} MB`,
  },
  {
    pattern: /^Library path:\s*(.+)$/i,
    replace: (m) => `库路径：${m[1]}`,
  },
  {
    pattern: /^Data directory:\s*(.+)$/i,
    replace: (m) => `数据目录：${m[1]}`,
  },
  {
    pattern: /^Config: (?:don't|do not) use coprocessor (.+)$/i,
    replace: (m) => `配置：不使用协处理器 ${m[1]}`,
  },
  {
    pattern: /^Local time is UTC([+-]\d+)$/i,
    replace: (m) => `本地时区为 UTC${m[1]}`,
  },
  {
    pattern: /^WSL detection skipped,?\s*running as a service$/i,
    replace: "已跳过 WSL 检测：当前以服务方式运行",
  },
  {
    pattern: /^running as a service$/i,
    replace: "以服务方式运行",
  },
  {
    pattern: /^Computer name:\s*(.+)$/i,
    replace: (m) => `计算机名：${m[1]}`,
  },
  {
    pattern: /^machine id:\s*(.+)$/i,
    replace: (m) => `机器标识：${m[1]}`,
  },
  {
    pattern: /^userid:\s*(.+)$/i,
    replace: (m) => `用户标识：${m[1]}`,
  },
  {
    pattern: /^No general preferences found in the server,?\s*using defaults$/i,
    replace: "服务器未找到通用偏好设置，已使用默认值",
  },
  {
    pattern: /^Reading preferences override file$/i,
    replace: "正在读取偏好设置覆盖文件",
  },

  // ── suspension / resumption ────────────────────────────────────────────
  {
    pattern: /^Suspending computation - user is active$/i,
    replace: "暂停计算：用户正在使用电脑",
  },
  {
    pattern: /^Suspending computation - on batteries$/i,
    replace: "暂停计算：正在使用电池",
  },
  {
    pattern: /^Suspending computation - running on batteries$/i,
    replace: "暂停计算：正在使用电池",
  },
  {
    pattern: /^Suspending computation - CPU usage is too high$/i,
    replace: "暂停计算：CPU 占用率过高",
  },
  {
    pattern: /^Suspending computation - time of day$/i,
    replace: "暂停计算：不在设定的运行时段内",
  },
  {
    pattern: /^Suspending computation - (?:on|due to) (.+)$/i,
    replace: (m) => `暂停计算：${m[1]}`,
  },
  {
    pattern: /^Resuming computation$/i,
    replace: "恢复计算",
  },
  {
    pattern: /^Reason:\s*requested by user$/i,
    replace: "原因：用户手动请求",
  },
  {
    pattern: /^Reason:\s*(.+)$/i,
    replace: (m) => `原因：${m[1]}`,
  },
  {
    pattern: /^Suspending network activity - (.+)$/i,
    replace: (m) => `暂停网络传输：${m[1]}`,
  },
  {
    pattern: /^Resuming network activity$/i,
    replace: "恢复网络传输",
  },
  {
    pattern: /^Suspending GPU computation - (.+)$/i,
    replace: (m) => `暂停显卡计算：${m[1]}`,
  },
  {
    pattern: /^Resuming GPU computation$/i,
    replace: "恢复显卡计算",
  },

  // ── scheduler / server communication ───────────────────────────────────
  {
    pattern: /^Sending scheduler request:\s*To (fetch work|report results)\.?\s*$/i,
    replace: (m) =>
      m[1].toLowerCase() === "report results"
        ? "正在向服务器上报结果"
        : "正在向服务器请求新任务",
  },
  {
    pattern: /^Requesting new tasks for (CPU|GPU|.+)$/i,
    replace: (m) => `正在请求 ${m[1]} 任务`,
  },
  {
    pattern: /^Scheduler request completed:\s*got (\d+) new tasks?$/i,
    replace: (m) => `调度请求完成：获得 ${num(m[1])} 个新任务`,
  },
  {
    pattern: /^Scheduler request completed:\s*(.+)$/i,
    replace: (m) => `调度请求完成：${m[1]}`,
  },
  {
    pattern: /^Scheduler request failed:\s*(.+)$/i,
    replace: (m) => `调度请求失败：${m[1]}`,
  },
  {
    pattern: /^Scheduler request failed:\s*peer certificate cannot be authenticated/i,
    replace: "调度请求失败：服务器证书无法验证",
  },
  {
    pattern: /^Project communication failed:\s*(.+)$/i,
    replace: (m) => `与项目服务器通信失败：${m[1]}`,
  },
  {
    pattern: /^Master file download succeeded$/i,
    replace: "项目主配置文件下载成功",
  },
  {
    pattern: /^Fetching scheduler list$/i,
    replace: "正在获取调度服务器列表",
  },
  {
    pattern: /^Got server version info$/i,
    replace: "已获取服务器版本信息",
  },

  // ── transfers ──────────────────────────────────────────────────────────
  {
    pattern: /^Started download of (.+)$/i,
    replace: (m) => `开始下载 ${m[1]}`,
  },
  {
    pattern: /^Finished download of (.+)$/i,
    replace: (m) => `下载完成 ${m[1]}`,
  },
  {
    pattern: /^Started upload of (.+)$/i,
    replace: (m) => `开始上传 ${m[1]}`,
  },
  {
    pattern: /^Finished upload of (.+)$/i,
    replace: (m) => `上传完成 ${m[1]}`,
  },
  {
    pattern: /^Temporarily failed download of (.+):\s*(.+)$/i,
    replace: (m) => `下载 ${m[1]} 暂时失败：${m[2]}`,
  },
  {
    pattern: /^Temporarily failed upload of (.+):\s*(.+)$/i,
    replace: (m) => `上传 ${m[1]} 暂时失败：${m[2]}`,
  },
  {
    pattern: /^Backing off (\d+) sec$/i,
    replace: (m) => `退避 ${num(m[1])} 秒后重试`,
  },
  {
    pattern: /^Backing off (\d+) sec on (.+)$/i,
    replace: (m) => `对 ${m[2]} 退避 ${num(m[1])} 秒后重试`,
  },

  // ── task lifecycle ─────────────────────────────────────────────────────
  {
    pattern: /^Starting task (.+)$/i,
    replace: (m) => `开始任务 ${m[1]}`,
  },
  {
    pattern: /^Computation for task (.+) finished$/i,
    replace: (m) => `任务 ${m[1]} 计算完成`,
  },
  {
    pattern: /^Task (.+) postponed for ([\d.]+) seconds$/i,
    replace: (m) => `任务 ${m[1]} 推迟 ${num(m[2])} 秒`,
  },
  {
    pattern: /^Task (.+) exited with zero status but no 'finished' file$/i,
    replace: (m) => `任务 ${m[1]} 已退出，但没有生成结果文件`,
  },
  {
    pattern: /^Task (.+) exited with zero status but no 'finished' file; if this happens repeatedly, please tell the project$/i,
    replace: (m) =>
      `任务 ${m[1]} 已退出但未生成结果文件；若反复出现，请告知项目方`,
  },
  {
    pattern: /^Task (.+) exited with (?:non-zero|-?\d+) status$/i,
    replace: (m) => `任务 ${m[1]} 异常退出（非零状态码）`,
  },
  {
    pattern: /^Result (.+) is no longer usable$/i,
    replace: (m) => `结果 ${m[1]} 已不可用`,
  },
  {
    pattern: /^Reporting (.+) \(([\d.]+) CPU (?:sec|seconds?)\)$/i,
    replace: (m) => `正在上报 ${m[1]}（CPU ${m[2]} 秒）`,
  },
  {
    pattern: /^Sending upload of (.+)$/i,
    replace: (m) => `正在上传 ${m[1]}`,
  },

  // ── errors a user may need to act on ──────────────────────────────────
  {
    pattern: /^Can't resolve hostname (.+)$/i,
    replace: (m) => `无法解析主机名 ${m[1]}，请检查网络或 DNS`,
  },
  {
    pattern: /^Failed to connect to (.+)$/i,
    replace: (m) => `无法连接到 ${m[1]}`,
  },
  {
    pattern: /^No work available(?: for .+)?$/i,
    replace: "服务器暂时没有可分配的任务",
  },
  {
    pattern: /^Not requesting tasks:\s*(.+)$/i,
    replace: (m) => `未请求任务：${m[1]}`,
  },
  {
    pattern: /^Communication deferred \((.+)\)$/i,
    replace: (m) => `通信已延后（${m[1]}）`,
  },
  {
    pattern: /^Waiting for ([\d.]+) sec before next RPC$/i,
    replace: (m) => `等待 ${num(m[1])} 秒后进行下一次通信`,
  },
  {
    pattern: /^Deferring communication for (.+)$/i,
    replace: (m) => `暂缓通信 ${m[1]}`,
  },
  {
    pattern: /^Giving up on download of (.+)$/i,
    replace: (m) => `放弃下载 ${m[1]}`,
  },
  {
    pattern: /^Project (.+) is down/i,
    replace: (m) => `项目 ${m[1]} 暂时无法访问`,
  },
  {
    pattern: /^Your account is not authorized for (.+)$/i,
    replace: (m) => `你的账户未获得 ${m[1]} 的授权`,
  },
];

/** BOINC prefixes some lines with `[error]`, `[notice]`, `[warning]`. */
const LEVEL_TAGS: Record<string, string> = {
  "[error]": "［错误］",
  "[notice]": "［通知］",
  "[warning]": "［警告］",
  "[warn]": "［警告］",
};

function translateCore(text: string): string {
  const trimmed = text.trim();

  for (const tag of Object.keys(LEVEL_TAGS)) {
    if (trimmed.toLowerCase().startsWith(tag)) {
      const rest = trimmed.slice(tag.length).trim();
      return `${LEVEL_TAGS[tag]}${translateCore(rest)}`;
    }
  }

  for (const rule of RULES) {
    const match = trimmed.match(rule.pattern);
    if (!match) continue;
    try {
      return typeof rule.replace === "string"
        ? rule.replace
        : rule.replace(match);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Translate one log line, preserving an optional `Project name: ` prefix.
 * Project names are proper nouns and stay in their original form.
 */
export function translateLogMessage(
  body: string,
  projectNames: readonly string[] = [],
): string {
  if (!body) return body;

  const sorted = [...projectNames]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const prefix = `${name}:`;
    if (body.startsWith(prefix)) {
      const rest = body.slice(prefix.length).trim();
      return `${name}：${translateCore(rest)}`;
    }
  }

  // Unsolicited global messages can still start with `something: `, but only
  // translate the tail when the head looks like a label rather than a sentence.
  return translateCore(body);
}

/** True when the line was actually localized — used to decide on hover text. */
export function isTranslated(original: string, translated: string): boolean {
  return original.trim() !== translated.trim();
}
