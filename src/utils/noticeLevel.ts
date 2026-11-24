/**
 * Notice severity, derived rather than stored.
 *
 * BOINC notices carry no numeric level — only `category` and free text — so a
 * four-band classification has to be inferred from wording. The point is not
 * perfect accuracy but triage: a user opening the panel should be able to skip
 * the "we published a paper" posts and land on the ones that need action.
 *
 *   L0  FYI        project news, publications, milestones
 *   L1  Normal     everything unclassified
 *   L2  Attention  deadlines, low disk, temporary failures
 *   L3  Action     credentials, account, hard failures
 *
 * The rules are ordered: the first matching band wins, hardest first, so a
 * message containing both "warning" and "error" is treated as an error.
 */

export type NoticeLevel = 0 | 1 | 2 | 3;

interface Band {
  level: NoticeLevel;
  patterns: RegExp[];
}

const BANDS: Band[] = [
  {
    level: 3,
    patterns: [
      /\berror\b/i,
      /\bfailed\b/i,
      /\bfailure\b/i,
      /\binvalid\b/i,
      /\bcannot\b/i,
      /\bcan't\b/i,
      /\bdenied\b/i,
      /\bunauthori[sz]ed\b/i,
      /\bexpired\b/i,
      /\bcredentials?\b/i,
      /\bpassword\b/i,
      /\bdisk (?:space|full)\b/i,
      /\bout of (?:disk|memory)\b/i,
      /错误/,
      /失败/,
      /无效/,
      /密码/,
      /未授权/,
      /磁盘(?:空间)?不足/,
    ],
  },
  {
    level: 2,
    patterns: [
      /\bwarning\b/i,
      /\bwarn\b/i,
      /\blow\b/i,
      /\bdeadline\b/i,
      /\bsuspend(?:ed|ing)?\b/i,
      /\bpaused?\b/i,
      /\boffline\b/i,
      /\btemporar(?:y|ily)\b/i,
      /\bdeferred\b/i,
      /\bbacking off\b/i,
      /\bno work\b/i,
      /\boverdue\b/i,
      /警告/,
      /注意/,
      /不足/,
      /暂停/,
      /离线/,
      /截止/,
      /已过期/,
    ],
  },
  {
    level: 0,
    patterns: [
      /\bnews\b/i,
      /\bpublication\b/i,
      /\bpublished\b/i,
      /\bpaper\b/i,
      /\bpreprint\b/i,
      /\bmilestone\b/i,
      /\bcongratulat/i,
      /\bthank/i,
      /\banniversary\b/i,
      /\bbirthday\b/i,
      /新闻/,
      /论文/,
      /发表/,
      /里程碑/,
      /祝贺/,
      /感谢/,
      /周年/,
    ],
  },
];

export function classifyNotice(
  title: string | null | undefined,
  description: string | null | undefined,
): NoticeLevel {
  // Title carries the signal; description is often a long article body whose
  // incidental words ("we could not have done this without you") would misfire.
  const text = (title ?? "").trim();
  const fallback = `${title ?? ""} ${(description ?? "").slice(0, 120)}`;

  for (const band of BANDS) {
    if (band.patterns.some((p) => p.test(text))) return band.level;
  }
  for (const band of BANDS) {
    if (band.patterns.some((p) => p.test(fallback))) return band.level;
  }
  return 1;
}

/** i18n key for the badge label. */
export function noticeLevelKey(level: NoticeLevel): string {
  return `notices.level.${level}`;
}

/** CSS modifier suffix, kept separate from the numeric level. */
export function noticeLevelTone(
  level: NoticeLevel,
): "quiet" | "normal" | "warn" | "bad" {
  if (level === 0) return "quiet";
  if (level === 2) return "warn";
  if (level === 3) return "bad";
  return "normal";
}
