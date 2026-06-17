import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { calculateStonevaleBatchPrice } from "./lib/stonevalePricing";
import { CsvRow, parseCsv, stringifyCsv } from "./lib/csv";

const REQUIRED_HEADERS = [
  "address_line1",
  "city",
  "state",
  "zip",
];

const OUTPUT_HEADERS = [
  "property_address_short",
  "refresh_from",
  "detail_from",
  "plan_monthly",
  "living_sqft",
  "roof_sqft",
  "story_count",
  "story_source",
  "home_size_band",
  "patio_walkway_adder_pct",
  "driveway_sqft",
  "driveway_price",
  "review_flags",
];

type ProcessState = {
  completed: number;
  failed: number;
  running: boolean;
};

const BATCH_ROW_DELAY_MS = 50;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function joinFlags(...flags: Array<string | undefined>): string {
  return flags
    .flatMap((flag) => (flag ?? "").split(";"))
    .map((flag) => flag.trim())
    .filter(Boolean)
    .filter((flag, index, all) => all.indexOf(flag) === index)
    .join("; ");
}

function hasReviewFlag(flags: string | undefined, flagToFind: string): boolean {
  return (flags ?? "")
    .split(";")
    .map((flag) => flag.trim().toUpperCase())
    .includes(flagToFind.toUpperCase());
}

function buildPropertyAddress(row: CsvRow, cityOverride?: string): string {
  const street = row.address_line1 || "";
  const locality = [cityOverride ?? row.city, row.state, row.zip].filter(Boolean).join(" ");
  return [street, locality].filter(Boolean).join(", ");
}

function normalizeCandidateKey(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildEstimateCandidates(row: CsvRow): string[] {
  const candidates = [
    buildPropertyAddress(row),
    isCollegeSta(row.city) ? buildPropertyAddress(row, "College Station") : "",
  ];

  if (row.display_address?.trim()) {
    candidates.push(
      [row.display_address, [row.city, row.state, row.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    );
    if (isCollegeSta(row.city)) {
      candidates.push(
        [row.display_address, ["College Station", row.state, row.zip].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ")
      );
    }
  }

  if (row.mailing_address?.trim()) {
    candidates.push(row.mailing_address);
  }

  const seen = new Set<string>();
  return candidates
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .filter((candidate) => {
      const key = normalizeCandidateKey(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isCollegeSta(city: string | undefined): boolean {
  return (city ?? "").trim().toLowerCase() === "college sta";
}

function outsideBcsFlag(row: CsvRow): string {
  const city = (row.city ?? "").trim().toLowerCase();
  if (city === "bryan" || city === "college station" || city === "college sta") return "";
  return "OUTSIDE BCS";
}

function withoutPricing(row: CsvRow, reviewFlags: string): CsvRow {
  return {
    ...row,
    property_address_short: row.display_address ?? "",
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
    review_flags: reviewFlags,
  };
}

async function requestEstimate(address: string) {
  const response = await fetch("/api/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, batchMode: true }),
  });

  if (!response.ok) {
    throw new Error(`Estimate request returned ${response.status}`);
  }

  return response.json();
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CsvBatchImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [outputRows, setOutputRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState("");
  const [windowCheckConfirmed, setWindowCheckConfirmed] = useState(false);
  const [processState, setProcessState] = useState<ProcessState>({
    completed: 0,
    failed: 0,
    running: false,
  });

  const missingHeaders = useMemo(
    () => REQUIRED_HEADERS.filter((header) => !headers.includes(header)),
    [headers]
  );

  const blankGreetingCount = useMemo(
    () => rows.filter((row) => !row.greeting_name?.trim()).length,
    [rows]
  );

  const flaggedCount = useMemo(
    () => rows.filter((row) => row.review_flags?.trim()).length,
    [rows]
  );

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = parseCsv(await file.text());
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setOutputRows([]);
      setWindowCheckConfirmed(false);
      setProcessState({ completed: 0, failed: 0, running: false });
      setError("");
    } catch (fileError) {
      setFileName("");
      setHeaders([]);
      setRows([]);
      setOutputRows([]);
      setError(
        fileError instanceof Error ? fileError.message : "Unable to read the CSV."
      );
    }
  };

  const processRow = async (row: CsvRow): Promise<CsvRow> => {
    if (hasReviewFlag(row.review_flags, "NOT ON GOOGLE MAPS")) {
      return withoutPricing(
        row,
        joinFlags(row.review_flags, outsideBcsFlag(row), "NOT ON GOOGLE MAPS")
      );
    }

    const measurementAddress = buildPropertyAddress(row);
    if (!measurementAddress) {
      return {
        ...row,
        property_address_short: row.display_address ?? "",
        refresh_from: "",
        detail_from: "",
        plan_monthly: "",
        review_flags: joinFlags(
          row.review_flags,
          outsideBcsFlag(row),
          "MISSING_MEASUREMENT_ADDRESS"
        ),
      };
    }

    try {
      let estimate: any = null;
      for (const candidate of buildEstimateCandidates(row)) {
        estimate = await requestEstimate(candidate);
        if (estimate.solarFound) break;
      }

      if (!estimate?.solarFound) {
        return withoutPricing(
          row,
          joinFlags(
            row.review_flags,
            outsideBcsFlag(row),
            "NOT ON GOOGLE MAPS"
          )
        );
      }

      const livingSqft = Number(estimate.homeSizeSqft) || 0;
      const roofSqft = Number(estimate.roofFootprintSqft) || 0;
      const price = calculateStonevaleBatchPrice({
        livingSqft,
        roofSqft,
        existingReviewFlags: row.review_flags,
        carePlanTier: "premium",
      });

      const auditFlags = joinFlags(
        price.review_flag,
        outsideBcsFlag(row),
        !livingSqft ? "MISSING_LIVING_SQFT" : "",
        !roofSqft ? "MISSING_ROOF_SQFT" : ""
      );

      return {
        ...row,
        property_address_short: row.display_address ?? "",
        refresh_from: String(price.refresh_from),
        detail_from: String(price.detail_from),
        plan_monthly: String(price.plan_monthly),
        living_sqft: livingSqft ? String(livingSqft) : "",
        roof_sqft: roofSqft ? String(roofSqft) : "",
        story_count: String(price.story_count),
        story_source: price.story_source,
        home_size_band: price.home_size_band,
        patio_walkway_adder_pct: String(price.patio_walkway_adder_pct),
        driveway_sqft: String(price.driveway_sqft),
        driveway_price: String(price.driveway_price),
        review_flags: auditFlags,
      };
    } catch {
      return {
        ...row,
        property_address_short: row.display_address ?? "",
        refresh_from: "",
        detail_from: "",
        plan_monthly: "",
        review_flags: joinFlags(
          row.review_flags,
          outsideBcsFlag(row),
          "ESTIMATE_REQUEST_FAILED"
        ),
      };
    }
  };

  const runBatch = async () => {
    if (
      rows.length === 0 ||
      missingHeaders.length > 0 ||
      !windowCheckConfirmed
    ) {
      return;
    }

    setProcessState({ completed: 0, failed: 0, running: true });
    setOutputRows([]);
    setError("");

    const results = new Array<CsvRow>(rows.length);
    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const workerCount = Math.min(2, rows.length);

    const worker = async () => {
      while (cursor < rows.length) {
        const index = cursor;
        cursor += 1;
        if (index > 0) {
          await sleep(BATCH_ROW_DELAY_MS);
        }
        const result = await processRow(rows[index]);
        results[index] = result;
        if (result.review_flags?.includes("ESTIMATE_REQUEST_FAILED")) {
          failed += 1;
        }
        completed += 1;
        setProcessState({
          completed,
          failed,
          running: true,
        });
      }
    };

    await Promise.all(Array.from({ length: workerCount }, worker));
    setOutputRows(results);
    setProcessState({ completed: rows.length, failed, running: false });
  };

  const exportResults = () => {
    if (outputRows.length === 0) return;
    const outputHeaders = [
      ...headers,
      ...OUTPUT_HEADERS.filter((header) => !headers.includes(header)),
    ];
    const baseName = fileName.replace(/\.csv$/i, "") || "Stonevale_Batch";
    downloadCsv(
      `${baseName}_Priced.csv`,
      stringifyCsv(outputHeaders, outputRows)
    );
  };

  const progressPct =
    rows.length > 0
      ? Math.round((processState.completed / rows.length) * 100)
      : 0;

  return (
    <section className="bg-[#131619] border border-white/10 p-6 sm:p-8 mt-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[#C5A059]">
            <FileSpreadsheet className="h-5 w-5" />
            <h2 className="font-serif text-xl text-white">CSV Batch Pricing</h2>
          </div>
          <p className="text-sm text-white/55 mt-2 max-w-2xl leading-relaxed">
            Import the Drop 1 universe, verify its assigned card data, then run
            property estimates. Original mailing columns, variant IDs, display
            addresses, greeting names, and review notes are preserved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processState.running}
          className="shrink-0 px-5 py-3 bg-[#C5A059] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Choose CSV
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-5 border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              ["File", fileName],
              ["Rows", rows.length.toLocaleString()],
              ["Blank greetings", blankGreetingCount.toLocaleString()],
              ["Rows with notes", flaggedCount.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="border border-white/10 bg-[#0F1113] p-4">
                <span className="block text-[10px] uppercase tracking-wider font-mono text-white/40">
                  {label}
                </span>
                <span className="block mt-1 text-sm text-white truncate">{value}</span>
              </div>
            ))}
          </div>

          {missingHeaders.length > 0 ? (
            <div className="mt-5 flex gap-3 border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Missing required columns: {missingHeaders.join(", ")}</span>
            </div>
          ) : (
            <div className="mt-5 flex gap-3 border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
              <Check className="h-5 w-5 shrink-0" />
              <span>
                Required columns found. Blank greeting names will remain blank
                so the card can fall back to “Neighbor.”
              </span>
            </div>
          )}

          <div className="mt-6 overflow-x-auto border border-white/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-white/[0.04] text-white/55 uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Display address</th>
                  <th className="px-4 py-3">Greeting</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Review notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, index) => (
                  <tr key={`${row.variant_id}-${index}`} className="border-t border-white/10 text-white/75">
                    <td className="px-4 py-3 text-[#C5A059] font-bold">{row.variant_id}</td>
                    <td className="px-4 py-3">{row.display_address}</td>
                    <td className="px-4 py-3">{row.greeting_name || "Neighbor"}</td>
                    <td className="px-4 py-3">{row.city}</td>
                    <td className="px-4 py-3 text-white/45">{row.review_flags || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] font-mono text-white/35 mt-2">
            Previewing the first 5 of {rows.length.toLocaleString()} rows.
          </p>

          <div className="mt-6 border border-white/10 bg-[#0F1113] p-5">
            <h3 className="text-sm font-serif text-white">Required preflight</h3>
            <p className="text-xs text-white/45 mt-1">
              Confirm the pricing check before the 600-home run. CSV pricing
              always uses the approved 2-story assumption.
            </p>
            <label className="flex items-start gap-3 mt-4 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={windowCheckConfirmed}
                onChange={(event) => setWindowCheckConfirmed(event.target.checked)}
                disabled={processState.running}
                className="mt-0.5 accent-[#C5A059]"
              />
              <span>
                Window worksheet check passed within approximately 15% using
                the locked 2-story window multiplier.
              </span>
            </label>
          </div>

          {processState.running && (
            <div className="mt-6">
              <div className="flex justify-between text-xs text-white/60 mb-2">
                <span>Running property estimates</span>
                <span>
                  {processState.completed} / {rows.length} ({progressPct}%)
                </span>
              </div>
              <div className="h-2 bg-[#0F1113] border border-white/10">
                <div
                  className="h-full bg-[#C5A059] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={runBatch}
              disabled={
                processState.running ||
                missingHeaders.length > 0 ||
                !windowCheckConfirmed
              }
              className="px-6 py-3 border border-[#C5A059] text-[#C5A059] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {processState.running ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {processState.running ? "Running Batch" : "Run Batch Estimates"}
            </button>
            <button
              type="button"
              onClick={exportResults}
              disabled={outputRows.length === 0 || processState.running}
              className="px-6 py-3 bg-[#C5A059] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Download Priced CSV
            </button>
          </div>

          {outputRows.length > 0 && (
            <p className="text-xs text-white/50 mt-4 text-right">
              Completed {outputRows.length.toLocaleString()} rows
              {processState.failed > 0
                ? ` with ${processState.failed} request failures flagged for review.`
                : " with no request failures."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
