export type StorySource =
  | "living_roof_heuristic"
  | "batch_assumption"
  | "manual"
  | "unknown";

export type PriceBand =
  | "1800-2200"
  | "2200-3000"
  | "3000-4000"
  | "4000-5000"
  | "5000+";

export type CarePlan = {
  essential: number;
  premium: number;
  signature: number;
};

export type StonevaleBatchPrice = {
  refresh_from: number | "";
  detail_from: number | "";
  plan_monthly: number | "";
  home_size_band: PriceBand;
  patio_walkway_adder_pct: number;
  driveway_sqft: number;
  driveway_price: number;
  story_source: StorySource;
  story_count: number | "";
  review_flag: string;
};

const SOFT_WASH_ROOF_RATE = 0.3; // per sqft
const WINDOW_MULTIPLIER_1_STORY = 0.10;
const WINDOW_MULTIPLIER_2_STORY = 0.16;

const STORY_UPCHARGE_2_STORY = 150;
const STORY_UPCHARGE_3_STORY = 300;

const DETAIL_MINIMUM = 1200;
const DRIVEWAY_RATE = 0.25;

export const CARE_PLANS: Record<PriceBand, CarePlan> = {
  "1800-2200": { essential: 99, premium: 229, signature: 429 },
  "2200-3000": { essential: 129, premium: 299, signature: 549 },
  "3000-4000": { essential: 159, premium: 399, signature: 729 },
  "4000-5000": { essential: 189, premium: 529, signature: 949 },
  "5000+": { essential: 249, premium: 649, signature: 1199 },
};

export function getHomeSizeBand(livingSqft: number): PriceBand {
  if (livingSqft <= 0) return "1800-2200";
  if (livingSqft <= 2200) return "1800-2200";
  if (livingSqft <= 3000) return "2200-3000";
  if (livingSqft <= 4000) return "3000-4000";
  if (livingSqft <= 5000) return "4000-5000";
  return "5000+";
}

export function inferStories(params: {
  livingSqft: number;
  roofSqft: number;
  manualStories?: number | null;
}): { stories: number | ""; source: StorySource } {
  if (params.manualStories && params.manualStories >= 1) {
    return {
      stories: Math.round(params.manualStories),
      source: "manual",
    };
  }

  if (params.livingSqft > 0 && params.roofSqft > 0) {
    const ratio = params.livingSqft / params.roofSqft;

    if (ratio >= 1.8) {
      return {
        stories: 2,
        source: "living_roof_heuristic",
      };
    }

    return {
      stories: 1,
      source: "living_roof_heuristic",
    };
  }

  return {
    stories: "",
    source: "unknown",
  };
}

function getStoryUpcharge(stories: number | ""): number {
  if (stories === "") return 0;
  if (typeof stories === "number") {
    if (stories >= 3) return STORY_UPCHARGE_3_STORY;
    if (stories === 2) return STORY_UPCHARGE_2_STORY;
  }
  return 0;
}

function getWindowMultiplier(stories: number | ""): number {
  if (stories === "") return WINDOW_MULTIPLIER_2_STORY;
  return typeof stories === "number" && stories >= 2 ? WINDOW_MULTIPLIER_2_STORY : WINDOW_MULTIPLIER_1_STORY;
}

function roundDollar(value: number): number {
  return Math.round(value);
}

function getPatioWalkwayAdderPct(band: PriceBand): number {
  if (band === "5000+") return 0;
  if (band === "1800-2200" || band === "2200-3000") return 0.15;
  if (band === "3000-4000") return 0.25;
  return 0.35;
}

function getBatchPatioWalkwayAdderPct(livingSqft: number): number {
  if (livingSqft < 3000) return 0.15;
  if (livingSqft <= 4500) return 0.25;
  return 0.35;
}

export function estimateDrivewaySqft(roofSqft: number): number {
  const multiplier =
    roofSqft < 3000 ? 0.207 :
    roofSqft <= 4500 ? 0.225 :
    0.243;

  return Math.round(roofSqft * multiplier);
}

export function calculateStonevaleBatchPrice(params: {
  livingSqft: number;
  roofSqft: number;
  manualStories?: number | null;
  existingReviewFlags?: string;
  carePlanTier?: keyof CarePlan;
}): StonevaleBatchPrice {
  const carePlanTier = (params.carePlanTier as keyof CarePlan) ?? "premium";
  const band = getHomeSizeBand(params.livingSqft);
  const carePlanSqft = Math.round(params.roofSqft);
  const carePlanBand = getHomeSizeBand(carePlanSqft);

  const story = inferStories({
    livingSqft: params.livingSqft,
    roofSqft: params.roofSqft,
    manualStories: params.manualStories,
  });

  const flags: string[] = [];
  if (params.existingReviewFlags) flags.push(params.existingReviewFlags);

  const adderPct = getBatchPatioWalkwayAdderPct(params.livingSqft);
  const storyUpcharge = STORY_UPCHARGE_2_STORY;
  const windowMultiplier = WINDOW_MULTIPLIER_2_STORY;
  const drivewaySqft = estimateDrivewaySqft(params.roofSqft);
  const drivewayPrice = roundDollar(drivewaySqft * DRIVEWAY_RATE);

  const softWashPrice = roundDollar(
    params.roofSqft * SOFT_WASH_ROOF_RATE + storyUpcharge
  );
  const windowPrice = roundDollar(params.roofSqft * windowMultiplier);
  const refreshBase = softWashPrice + windowPrice;

  const detailBase = refreshBase + drivewayPrice;

  const detailWithAdder = Math.max(DETAIL_MINIMUM, detailBase * (1 + adderPct));
  const detailFrom = roundDollar(detailWithAdder);

  if (band === "5000+") {
    flags.push("MANSION");
  }

  if (detailFrom < 3000) {
    flags.push("VERY LOW");
  }

  return {
    refresh_from: roundDollar(refreshBase),
    detail_from: detailFrom,
    plan_monthly: CARE_PLANS[carePlanBand][carePlanTier],
    home_size_band: band,
    patio_walkway_adder_pct: adderPct,
    driveway_sqft: drivewaySqft,
    driveway_price: drivewayPrice,
    story_source: "batch_assumption",
    story_count: 2,
    review_flag: flags.join("; "),
  };
}
