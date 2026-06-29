/**
 * Build only the canonical Vercel project.
 * Vercel ignores a deployment when this command exits 0 and builds on exit 1.
 */
const canonicalProjectId =
  process.env.SABISCORE_CANONICAL_VERCEL_PROJECT_ID ??
  "prj_OZ9E1XDcZMO1G5Zdhj4Dq6OeSzjo";
const currentProjectId = process.env.VERCEL_PROJECT_ID;

if (!currentProjectId) {
  console.log("VERCEL_PROJECT_ID is absent; continuing non-Vercel/local build.");
  process.exit(1);
}

if (currentProjectId === canonicalProjectId) {
  console.log(`Building canonical SabiScore Vercel project ${currentProjectId}.`);
  process.exit(1);
}

console.log(
  `Ignoring duplicate Vercel project ${currentProjectId}; canonical project is ${canonicalProjectId}.`,
);
process.exit(0);
