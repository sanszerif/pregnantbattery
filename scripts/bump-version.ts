import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execSync } from "node:child_process";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;
const TYPE_RE =
  /^(fix|feat|ci|huge|refac|chore)(?:\([A-Za-z0-9._/-]+\))?!?:\s+/;

export function computeNextVersion(
  currentVersion: string,
  commitHeader: string,
): string | null {
  const header = commitHeader.trim();
  if (!header || /^chore\(release\):/i.test(header)) return null;

  const tm = TYPE_RE.exec(header);
  if (!tm) return null;

  const vm = SEMVER_RE.exec(currentVersion.trim());
  if (!vm) return null;

  const major = Number(vm[1]);
  const minor = Number(vm[2]);
  const patch = Number(vm[3]);
  const suffix = vm[4] ?? "";
  const kind = tm[1];

  if (kind === "feat" || kind === "huge") {
    return `${major}.${minor + 1}.0${suffix}`;
  }
  if (kind === "fix" || kind === "ci") {
    return `${major}.${minor}.${patch + 1}${suffix}`;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatFallbackCommits(commits: string[]): string {
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const raw of commits) {
    const msg = raw.trim();
    if (!msg || /^Merge\s+/i.test(msg) || /^chore\(release\):/i.test(msg)) {
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

function getCommitsSinceLastRelease(fallbackHeader: string): string[] {
  try {
    const lastReleaseSha = execSync(
      'git log -n 1 --grep="^chore(release):" --format=%H',
      { encoding: "utf8" },
    ).trim();
    const range = lastReleaseSha ? `${lastReleaseSha}..HEAD` : "";
    if (!range) return [fallbackHeader];
    const out = execSync(`git log ${range} --pretty=%s`, { encoding: "utf8" });
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) => l && !/^Merge\s+/i.test(l) && !/^chore\(release\):/i.test(l),
      );
    return lines.length > 0 ? lines : [fallbackHeader];
  } catch {
    return [fallbackHeader];
  }
}

function alreadyBumpedInLastCommit(): boolean {
  try {
    const diff = execSync("git diff HEAD~1 HEAD -- package.json", {
      encoding: "utf8",
    });
    return /^\+\s*"version":/m.test(diff);
  } catch {
    return false;
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
  const commitMsg =
    process.env.COMMIT_MESSAGE ||
    execSync("git log -1 --pretty=%s", { encoding: "utf8" }).trim();

  if (alreadyBumpedInLastCommit()) {
    console.log(
      `package.json version already updated in HEAD (${pkg.version}); skipping CI bump.`,
    );
    writeGhOutput("bumped", "false");
    writeGhOutput("version", pkg.version);
    process.exit(0);
  }

  const next = computeNextVersion(pkg.version, commitMsg);
  if (!next) {
    console.log(
      `Commit "${commitMsg}" does not trigger a version bump (staying at ${pkg.version}).`,
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
      getCommitsSinceLastRelease(commitMsg),
    );
    writeFileSync(changelogPath, updatedChangelog, "utf8");
    console.log(`Updated ${changelogPath} for ${next} (${releaseDate})`);
  }

  writeGhOutput("bumped", "true");
  writeGhOutput("version", next);
}
