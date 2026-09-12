#!/usr/bin/env node
/**
 * scripts/copy-scan.mjs
 * Responsible-gambling prohibited-copy scanner.
 * Source of truth for the term list: CLAUDE.md, "Prohibited UI terms".
 *
 * Exit code 0 = clean. Exit code 1 = one or more violations found.
 * No `|| true` permitted anywhere this script is invoked.
 */

import { readFileSync } from "node:fs";
import { globSync } from "glob"; // already a transitive dep via other tooling; add directly if needed

const TARGET_GLOB = "apps/web/src/**/*.{ts,tsx,js,jsx}";

// Each entry: { name, pattern, negationWindow? }
// negationWindow: if a negation word appears within N chars before the match, skip it
// (covers legitimate responsible-gambling disclaimers like "returns are not guaranteed").
const RULES = [
  { name: "lock", pattern: /\block\b/i },
  { name: "banker", pattern: /\bbanker\b/i },
  { name: "guaranteed", pattern: /\bguaranteed\b/i, negationWindow: 20 },
  { name: "guaranteed winner", pattern: /\bguaranteed\s+winner\b/i, negationWindow: 20 },
  { name: "sure bet", pattern: /\bsure\s+bet\b/i },
  { name: "free money", pattern: /\bfree\s+money\b/i },
  { name: "execute immediately", pattern: /\bexecute\s+immediately\b/i },
  { name: "risk-free", pattern: /\brisk[- ]free\b/i, negationWindow: 20 },
  { name: "can't lose", pattern: /\bcan(?:'|\u2019)?t\s+lose\b|\bcannot\s+lose\b/i },
  { name: "certain to win", pattern: /\bcertain\s+to\s+win\b/i },
  { name: "certain profit", pattern: /\bcertain\s+profit\b/i },
  { name: "certain return", pattern: /\bcertain\s+return\b/i },
  { name: "100% certain", pattern: /\b100%\s*certain\b/i },
];

const NEGATION_WORDS = /\b(not|no|never|isn't|aren't|without|non-|un)\b/i;

function isImportLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("import ") || trimmed.startsWith("export ") && trimmed.includes(" from ");
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("* ")
  );
}

function isCamelCaseLockIdentifier(line, matchIndex) {
  // Skip only if "lock"/"Lock" is glued to adjacent identifier characters
  // (useLock, LockIcon, handleLock, lockState) rather than standing as its
  // own word in prose/JSX text content.
  const before = line[matchIndex - 1];
  const after = line[matchIndex + 4]; // 4 = length of "lock"
  const wordChar = /[A-Za-z0-9_]/;
  return (before && wordChar.test(before)) || (after && wordChar.test(after));
}

function hasNearbyNegation(line, matchIndex, window) {
  const start = Math.max(0, matchIndex - window);
  const context = line.slice(start, matchIndex);
  return NEGATION_WORDS.test(context);
}

function scanFile(path) {
  const violations = [];
  const lines = readFileSync(path, "utf8").split("\n");

  lines.forEach((line, idx) => {
    if (isImportLine(line) || isCommentLine(line)) return;

    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;

      if (rule.name === "lock" && isCamelCaseLockIdentifier(line, match.index)) {
        continue;
      }

      if (rule.negationWindow && hasNearbyNegation(line, match.index, rule.negationWindow)) {
        continue;
      }

      violations.push({
        file: path,
        lineNumber: idx + 1,
        term: rule.name,
        snippet: line.trim().slice(0, 120),
      });
    }
  });

  return violations;
}

function main() {
  const files = globSync(TARGET_GLOB, { nodir: true });
  const allViolations = files.flatMap(scanFile);

  if (allViolations.length === 0) {
    console.log(`✅ Responsible gambling copy scan: 0 hits across ${files.length} files.`);
    process.exit(0);
  }

  console.error(`❌ Responsible gambling copy scan: ${allViolations.length} violation(s) found.\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.lineNumber}  [${v.term}]  ${v.snippet}`);
  }
  console.error(
    "\nProhibited terms are defined in CLAUDE.md → 'Prohibited UI terms'. " +
      "If this is a legitimate responsible-gambling disclaimer (e.g. 'returns are not guaranteed'), " +
      "rephrase so a negation word sits within 20 characters before the flagged term, or contact " +
      "the directive owner to adjust the negation window."
  );
  process.exit(1);
}

main();
