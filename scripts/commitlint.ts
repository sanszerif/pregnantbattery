import { readFileSync } from "node:fs";

export const ALLOWED_COMMIT_TYPES = [
  "fix",
  "feat",
  "ci",
  "huge",
  "refac",
  "chore",
] as const;

const HEADER_RE = new RegExp(
  `^(${ALLOWED_COMMIT_TYPES.join("|")})(?:\\([a-z0-9._-]+\\))?!?:\\s+\\S+`,
);

export function validateCommitMessage(raw: string): {
  valid: boolean;
  header: string;
  reason?: string;
} {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const header = lines[0] ?? "";

  if (!header) {
    return { valid: false, header, reason: "Commit message is empty." };
  }

  if (
    header.startsWith("Merge ") ||
    header.startsWith("Revert ") ||
    header.startsWith("fixup! ") ||
    header.startsWith("squash! ")
  ) {
    return { valid: true, header };
  }

  if (!HEADER_RE.test(header)) {
    return {
      valid: false,
      header,
      reason: `Expected "<type>(scope): <description>" with one of: ${ALLOWED_COMMIT_TYPES.join(", ")}.`,
    };
  }

  return { valid: true, header };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let raw = "";
  const msgIdx = args.indexOf("--msg");
  if (msgIdx >= 0 && args[msgIdx + 1] !== undefined) {
    raw = args[msgIdx + 1];
  } else if (args[0]) {
    raw = readFileSync(args[0], "utf8");
  } else {
    console.error("Usage: bun scripts/commitlint.ts <msg-file> | --msg <text>");
    process.exit(1);
  }

  const res = validateCommitMessage(raw);
  if (!res.valid) {
    console.error(`Invalid commit message: "${res.header}"`);
    console.error(res.reason);
    console.error("Example: feat(profiles): add pixel 9a thermal silhouette");
    process.exit(1);
  }
}
