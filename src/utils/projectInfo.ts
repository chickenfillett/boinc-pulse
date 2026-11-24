/**
 * Offline Chinese cards for well-known BOINC projects.
 *
 * Why offline: the project APIs (`all_project_list.xml`, per-project
 * `project.xml`) are frequently unreachable or rate-limited, which made the
 * "what is this project even researching?" question unanswerable exactly when
 * the network was down. A static catalog answers it instantly and never lies by
 * omission — an unknown project simply shows no card.
 */
import catalog from "../data/projects.zh.json";

export interface ProjectCard {
  /** Chinese display name. */
  name: string;
  /** Short label for tight layouts. */
  short: string;
  /** What the project actually researches, in Chinese. */
  about: string;
  /** Official site, for a one-click jump. */
  home: string;
}

type Catalog = Record<string, Omit<ProjectCard, "home"> & { home: string }>;

const CARDS = catalog as Catalog;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Resolve a project card from a BOINC master URL.
 * Exact host match first, then a suffix match so sub-domains and mirrors
 * (`boinc.example.org`, `www.example.org`) still resolve.
 */
export function lookupProjectCard(
  masterUrl: string | null | undefined,
): ProjectCard | null {
  if (!masterUrl) return null;
  const host = hostOf(masterUrl);
  if (!host) return null;

  const exact = CARDS[host];
  if (exact) return { ...exact };

  const keys = Object.keys(CARDS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (host === key || host.endsWith(`.${key}`) || host.includes(key)) {
      return { ...CARDS[key] };
    }
  }
  return null;
}

/** Chinese name when the catalog knows the project, otherwise the raw name. */
export function displayProjectName(
  masterUrl: string | null | undefined,
  fallback: string,
): string {
  return lookupProjectCard(masterUrl)?.name ?? fallback;
}

/**
 * Build the "open my account on the project site" link.
 *
 * There is no single URL scheme across BOINC projects: WCG uses
 * `/member/<name>`, most stock projects use `/show_user.php?userid=<id>`, and
 * some only expose a host page. Rather than guess and land on a 404, prefer the
 * official home page and let the user navigate — a link that always works beats
 * a deep link that sometimes does not.
 */
export function projectHomeLink(masterUrl: string): string | null {
  const card = lookupProjectCard(masterUrl);
  if (card) return card.home;
  try {
    const url = new URL(masterUrl);
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return null;
  }
}
