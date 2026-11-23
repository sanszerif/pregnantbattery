import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;
const TYPE_RE =
  /^(upgrade|feat|huge|fix|ci|housekeep)(?:\([A-Za-z0-9._/-]+\))?:\s+/;
const RELEASE_COMMIT_RE = /^(?:housekeep|chore)\(release\):/i;
const SKIP_BUMP_RE = /\[skip[ -]bump\]/i;

export function computeNextVersion(
  currentVersion: string,
  commitHeader: string,
): string | null {
  const header = commitHeader.trim();
  if (!header || RELEASE_COMMIT_RE.test(header) || SKIP_BUMP_RE.test(header)) {
    return null;
  }

  const tm = TYPE_RE.exec(header);
  if (!tm) return null;

  const vm = SEMVER_RE.exec(currentVersion.trim());
  if (!vm) return null;

  const major = Number(vm[1]);
  const minor = Number(vm[2]);
  const patch = Number(vm[3]);
  const suffix = vm[4] ?? "";
  const kind = tm[1];

  if (kind === "upgrade") {
    return `${major + 1}.0.0${suffix}`;
  }
  if (kind === "feat" || kind === "huge") {
    return `${major}.${minor + 1}.${patch}${suffix}`;
  }
  if (kind === "fix" || kind === "ci") {
    return `${major}.${minor}.${patch + 1}${suffix}`;
  }
  return null;
}

/**
 * Replays commit headers in chronological order (oldest -> newest) so `upgrade`
 * resets minor/patch to 0.0 while `feat`/`huge` and `fix`/`ci` accumulate linearly.
 */
export function computeLinearNextVersion(
  currentVersion: string,
  commitHeadersChronological: string[],
): string | null {
  let cur = currentVersion.trim();
  let changed = false;
  for (const raw of commitHeadersChronological) {
    const next = computeNextVersion(cur, raw);
    if (next) {
      cur = next;
      changed = true;
    }
  }
  return changed ? cur : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatFallbackCommits(commits: string[]): string {
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const raw of commits) {
    const msg = raw.trim();
    if (
      !msg ||
      /^(?:Merge|Revert)\s+/i.test(msg) ||
      RELEASE_COMMIT_RE.test(msg)
    ) {
      continue;
    }
    if (seen.has(msg)) continue;
    seen.add(msg);
    bullets.push(`- ${msg}`);
  }
  return bullets.length > 0
    ? bullets.join("\n")
    : "- Maintenance & release updates.";
}

/**
 * Promotes the `## Unreleased` section of a Markdown changelog into a dated release
 * heading, falling back to commit summaries when `## Unreleased` is empty or absent.
 */
export function promoteChangelog(
  markdown: string,
  nextVersion: string,
  releaseDate: string,
  fallbackCommits: string[],
): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const versionRe = new RegExp(`^## ${escapeRegExp(nextVersion)}\\b`, "m");
  if (versionRe.test(normalized)) {
    return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
  }

  const fallbackBody = formatFallbackCommits(fallbackCommits);
  const unreleasedMatch = /^## Unreleased[ \t]*$/m.exec(normalized);

  if (unreleasedMatch && unreleasedMatch.index !== undefined) {
    const headerStart = unreleasedMatch.index;
    const afterHeader = headerStart + unreleasedMatch[0].length;
    const rest = normalized.slice(afterHeader);
    const nextHeading = /\n##[ \t]+/.exec(rest);
    const sectionEnd = nextHeading
      ? afterHeader + nextHeading.index
      : normalized.length;
    const rawBody = normalized.slice(afterHeader, sectionEnd);
    const stripped = rawBody.replace(/<!--[\s\S]*?-->/g, "").trim();
    const chosenBody = stripped ? rawBody.trim() : fallbackBody;
    const before = normalized.slice(0, headerStart).trimEnd();
    const after = normalized.slice(sectionEnd).trim();
    const promoted = `## Unreleased\n\n## ${nextVersion} (${releaseDate})\n\n${chosenBody}`;
    return `${[before, promoted, after].filter(Boolean).join("\n\n")}\n`;
  }

  const promoted = `## Unreleased\n\n## ${nextVersion} (${releaseDate})\n\n${fallbackBody}`;
  const firstRelease = /^##[ \t]+/m.exec(normalized);
  if (firstRelease && firstRelease.index !== undefined) {
    const before = normalized.slice(0, firstRelease.index).trimEnd();
    const after = normalized.slice(firstRelease.index).trim();
    return `${[before, promoted, after].filter(Boolean).join("\n\n")}\n`;
  }

  const trimmed = normalized.trim();
  return trimmed ? `${trimmed}\n\n${promoted}\n` : `${promoted}\n`;
}

function getCommitsSinceLastVersionChange(): string[] {
  try {
    const lastVersionSha = execFileSync(
      "git",
      [
        "log",
        "-n",
        "1",
        "-G",
        '"version":',
        "--format=%H",
        "--",
        "package.json",
      ],
      { encoding: "utf8" },
    ).trim();
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    if (lastVersionSha && lastVersionSha === headSha) {
      return [];
    }
    const logArgs = lastVersionSha
      ? ["log", "--reverse", `${lastVersionSha}..HEAD`, "--pretty=%s"]
      : ["log", "-n", "1", "--pretty=%s"];
    const out = execFileSync("git", logArgs, { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          l && !/^(?:Merge|Revert)\s+/i.test(l) && !RELEASE_COMMIT_RE.test(l),
      );
  } catch {
    return [];
  }
}

function writeGhOutput(key: string, value: string): void {
  const outPath = process.env.GITHUB_OUTPUT;
  if (outPath) {
    appendFileSync(outPath, `${key}=${value}\n`, "utf8");
  }
}

if (import.meta.main) {
  const pkgPath = "package.json";
  const pkgRaw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw) as { version: string };
  const commits = process.env.COMMIT_MESSAGE
    ? [process.env.COMMIT_MESSAGE.trim()].filter(Boolean)
    : getCommitsSinceLastVersionChange();

  if (commits.length === 0) {
    console.log(
      `No unreleased commits since last package.json version change (staying at ${pkg.version}).`,
    );
    writeGhOutput("bumped", "false");
    writeGhOutput("version", pkg.version);
    process.exit(0);
  }

  const next = computeLinearNextVersion(pkg.version, commits);
  if (!next) {
    console.log(
      `Unreleased commits do not trigger a version bump (staying at ${pkg.version}).`,
    );
    writeGhOutput("bumped", "false");
    writeGhOutput("version", pkg.version);
    process.exit(0);
  }

  pkg.version = next;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`Bumped version -> ${next}`);

  const changelogPath = "CHANGELOG.md";
  if (existsSync(changelogPath)) {
    const rawChangelog = readFileSync(changelogPath, "utf8");
    const releaseDate = new Date().toISOString().slice(0, 10);
    const updatedChangelog = promoteChangelog(
      rawChangelog,
      next,
      releaseDate,
      commits,
    );
    writeFileSync(changelogPath, updatedChangelog, "utf8");
    console.log(`Updated ${changelogPath} for ${next} (${releaseDate})`);
  }

  writeGhOutput("bumped", "true");
  writeGhOutput("version", next);
}
