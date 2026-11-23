import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;
const TYPE_RE = /^(fix|feat|ci|huge|refac|chore)(?:\([a-z0-9._-]+\))?!?:\s+/;

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
  writeGhOutput("bumped", "true");
  writeGhOutput("version", next);
}
