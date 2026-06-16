const CHECK_JOBS = [
  {
    name: "McGough, 3215 Laurel Trace",
    storyType: "1-story",
    revenue: 372,
    recommended: 0.10,
    solarRoofSqft: 0,
  },
  {
    name: "McManus, 4828 Williams Creek",
    storyType: "unknown",
    revenue: 300,
    recommended: 0.10,
    solarRoofSqft: 0,
  },
  {
    name: "Johnson Creek, 4721",
    storyType: "2-story",
    revenue: 528,
    recommended: 0.16,
    solarRoofSqft: 0,
  },
];

const TOLERANCE = 0.15;

function formatCents(value: number | null) {
  return value === null ? "unknown" : value.toFixed(2);
}

let mcgoughPassed = false;
let johnsonPassed = false;

for (const job of CHECK_JOBS) {
  console.log("----------------------------------------");
  console.log(`Job: ${job.name}`);
  console.log(`Story type: ${job.storyType}`);
  console.log(`Window revenue: $${job.revenue}`);
  console.log(`Recommended multiplier: ${formatCents(job.recommended)}`);
  console.log(`Solar roof sqft: ${job.solarRoofSqft}`);

  if (!job.solarRoofSqft || job.solarRoofSqft === 0) {
    console.log("Result: MISSING solarRoofSqft. Fill this value and rerun the script.");
    continue;
  }

  const impliedCentsPerSqft = job.revenue / job.solarRoofSqft;
  console.log(`Implied cents per sqft: ${impliedCentsPerSqft.toFixed(4)}`);

  if (job.name.includes("McManus") && job.storyType === "unknown") {
    console.log("Result: CHECK STORY TYPE");
    continue;
  }

  if (job.recommended === null) {
    console.log("Result: CHECK STORY TYPE");
    continue;
  }

  const min = job.recommended * (1 - TOLERANCE);
  const max = job.recommended * (1 + TOLERANCE);
  const pass = impliedCentsPerSqft >= min && impliedCentsPerSqft <= max;
  const result = pass ? "PASS" : "FAIL - CALL GARRETT";
  console.log(`Result: ${result}`);

  if (job.name.includes("McGough")) mcgoughPassed = pass;
  if (job.name.includes("Johnson Creek")) johnsonPassed = pass;
}

console.log("----------------------------------------");
if (!mcgoughPassed || !johnsonPassed) {
  console.log("WARNING: If either McGough or Johnson Creek fails, do NOT run the 600-home batch.");
}
console.log("WARNING: Do not re-center by averaging into one multiplier. Keep the 1-story / 2-story split.");
console.log("When both McGough and Johnson Creek pass, set WINDOW_MULTIPLIERS_LOCKED = true in scripts/run-stonevale-batch.ts.");
