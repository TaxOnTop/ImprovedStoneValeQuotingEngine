import fs from "fs";
import { parseCsv, stringifyCsv } from "../src/lib/csv";
import { calculateStonevaleBatchPrice } from "../src/lib/stonevalePricing";

const WINDOW_MULTIPLIERS_LOCKED = false;

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "./Stonevale_Drop1_Output.csv";

if (!WINDOW_MULTIPLIERS_LOCKED) {
  throw new Error(
    "Window multipliers are not locked. Run scripts/check-window-multipliers.ts first, enter Solar roof sqft for the three verification jobs, and set WINDOW_MULTIPLIERS_LOCKED=true only if McGough and Johnson Creek pass."
  );
}

if (!inputPath) {
  throw new Error("Usage: npx tsx scripts/run-stonevale-batch.ts ./Stonevale_Drop1_Universe_v2.csv ./Stonevale_Drop1_Output.csv");
}

const csv = fs.readFileSync(inputPath, "utf8");
const { rows } = parseCsv(csv);

const outputRows: any[] = [];

function joinFlags(...flags: Array<string | undefined>): string {
  return flags
    .flatMap((flag) => (flag ?? "").split(";"))
    .map((flag) => flag.trim())
    .filter(Boolean)
    .filter((flag, index, all) => all.indexOf(flag) === index)
    .join("; ");
}

function outsideBcsFlag(row: Record<string, string>): string {
  const city = (row.city ?? "").trim().toLowerCase();
  if (city === "bryan" || city === "college station" || city === "college sta") return "";
  return "OUTSIDE BCS";
}

function hasReviewFlag(flags: string | undefined, flagToFind: string): boolean {
  return (flags ?? "")
    .split(";")
    .map((flag) => flag.trim().toUpperCase())
    .includes(flagToFind.toUpperCase());
}

for (const row of rows) {
  const displayAddress = row.display_address;
  const greetingName = row.greeting_name ?? "";
  const existingFlags = row.review_flags ?? "";

  if (hasReviewFlag(existingFlags, "NOT ON GOOGLE MAPS")) {
    outputRows.push({
      ...row,
      property_address_short: displayAddress,
      greeting_name: greetingName,
      exterior_refresh: "",
      full_home_detail: "",
      estate_care_plan: "",
      refresh_from: "",
      detail_from: "",
      plan_monthly: "",
      living_sqft: "",
      roof_sqft: "",
      story_count: "",
      story_source: "",
      home_size_band: "",
      patio_walkway_adder_pct: "",
      driveway_sqft: "",
      driveway_price: "",
      review_flags: joinFlags(existingFlags, outsideBcsFlag(row), "NOT ON GOOGLE MAPS"),
    });
    continue;
  }

  const livingSqft = Number(
    row.living_sqft ||
    row.square_footage ||
    row.sqftHome ||
    row.home_sqft ||
    0
  );

  const roofSqft = Number(
    row.solar_roof_sqft ||
    row.roof_sqft ||
    row.roofFootprintSqft ||
    0
  );

  const addressForMeasurement =
    row.display_address ||
    row.property_address ||
    row.address ||
    `${row.street}, ${row.city}, ${row.state} ${row.zip}`;

  const price = calculateStonevaleBatchPrice({
    livingSqft,
    roofSqft,
    existingReviewFlags: existingFlags,
    carePlanTier: "premium",
  });

  const flags = joinFlags(
    price.review_flag,
    outsideBcsFlag(row),
    !livingSqft ? "MISSING_LIVING_SQFT" : "",
    !roofSqft ? "MISSING_ROOF_SQFT" : ""
  );

  outputRows.push({
    variant_id: row.variant_id,
    display_address: displayAddress,
    property_address_short: displayAddress,
    greeting_name: greetingName,

    refresh_from: price.refresh_from,
    detail_from: price.detail_from,
    plan_monthly: price.plan_monthly,

    living_sqft: livingSqft || "",
    roof_sqft: roofSqft || "",
    story_count: price.story_count,
    story_source: price.story_source,
    home_size_band: price.home_size_band,
    patio_walkway_adder_pct: price.patio_walkway_adder_pct,
    driveway_sqft: price.driveway_sqft,
    driveway_price: price.driveway_price,

    review_flags: flags,
  });
}

const outputHeaders = Object.keys(outputRows[0] ?? {});
const outputCsv = stringifyCsv(outputHeaders, outputRows);

fs.writeFileSync(outputPath, outputCsv);

console.log(`Done. Wrote ${outputRows.length} rows to ${outputPath}`);
