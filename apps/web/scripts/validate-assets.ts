import { LEAGUE_TEAMS } from "../src/lib/team-data";
import { getTeamData } from "../src/components/team-display";

function validateAssets(): number {
  let issues = 0;

  for (const [league, teams] of Object.entries(LEAGUE_TEAMS)) {
    for (const team of teams as readonly string[]) {
      const data = getTeamData(team);

      const isFallbackFlag = data.flag === "⚽";
      const isFallbackBg = data.bgColor === "bg-slate-600";

      if (isFallbackFlag || isFallbackBg) {
        issues++;
        console.error(
          `Missing or fallback asset for team="${team}" in league="${league}"` +
            ` (flag="${data.flag}", bgColor="${data.bgColor}")`
        );
      }
    }
  }

  return issues;
}

export function runAssetValidation(): void {
  const issues = validateAssets();

  if (issues > 0) {
    console.error(`\nAsset validation failed with ${issues} issue(s).`);
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log("Asset validation passed: all LEAGUE_TEAMS entries resolve to rich TEAM_DATA.");
  }
}

if (require.main === module) {
  runAssetValidation();
}
