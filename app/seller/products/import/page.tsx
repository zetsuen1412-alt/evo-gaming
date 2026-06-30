"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  authenticatedFetch,
  authenticatedFetchJson,
} from "@/lib/authenticatedFetch";
import { csvRowsToRecords, parseCsv } from "@/lib/csv";

type CsvRecord = Record<string, string | number>;

type PreviewRow = {
  rowNumber: number;
  action: "create" | "update";
  productId: number | null;
  title: string;
  description: string;
  price: number;
  stock: number;
  status: "active" | "inactive";
  deliveryEtaMinutes: number;
  categoryId: number | null;
  category: string;
  gameId: number | null;
  gameName: string;
  imageUrl: string;
  offerRegion: string;
  offerPlatform: string;
  offerServer: string;
  offerTags: string[];
  slug: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type PreviewResponse = {
  rows: PreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    creates: number;
    updates: number;
    warnings: number;
  };
};

type CommitResponse = {
  ok: boolean;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
  };
  results: Array<{
    rowNumber: number;
    action: "create" | "update";
    productId: number | null;
    title: string;
    ok: boolean;
    error?: string;
  }>;
};

const REQUIRED_COLUMNS = [
  "action",
  "product_id",
  "title",
  "description",
  "price",
  "stock",
  "status",
  "delivery_eta_minutes",
  "category",
  "game_name",
];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(value: string | null, fallback: string) {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export default function BulkListingImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRecord[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [downloading, setDownloading] = useState<"template" | "export" | null>(null);
  const [error, setError] = useState("");

  async function downloadCsv(mode: "template" | "export") {
    setDownloading(mode);
    setError("");
    try {
      const response = await authenticatedFetch(
        `/api/seller/catalog/bulk?mode=${mode}`
      );
      const blob = await response.blob();
      saveBlob(
        blob,
        filenameFromDisposition(
          response.headers.get("content-disposition"),
          mode === "template"
            ? "comeplayers-bulk-listing-template.csv"
            : "comeplayers-listings.csv"
        )
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download CSV."
      );
    } finally {
      setDownloading(null);
    }
  }

  async function readFile(file: File) {
    setLoadingFile(true);
    setError("");
    setPreview(null);
    setResult(null);

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("CSV file must be 5 MB or smaller.");
      }

      const parsedRows = parseCsv(await file.text());
      if (parsedRows.length < 2) throw new Error("CSV has no listing rows.");

      const headers = parsedRows[0].map((header) =>
        header.trim().toLowerCase().replace(/\s+/g, "_")
      );
      const missingColumns = REQUIRED_COLUMNS.filter(
        (column) => !headers.includes(column)
      );
      if (missingColumns.length > 0) {
        throw new Error(`CSV is missing columns: ${missingColumns.join(", ")}.`);
      }

      const records = csvRowsToRecords(parsedRows).map((record, index) => ({
        ...record,
        row_number: index + 2,
      }));
      if (records.length > 200) {
        throw new Error("A bulk import can contain at most 200 listing rows.");
      }

      setRows(records);
      setFileName(file.name);
    } catch (fileError) {
      setRows([]);
      setFileName("");
      setError(
        fileError instanceof Error ? fileError.message : "Failed to read CSV."
      );
    } finally {
      setLoadingFile(false);
    }
  }

  async function previewImport() {
    if (rows.length === 0) return;
    setPreviewing(true);
    setError("");
    setResult(null);

    try {
      const data = await authenticatedFetchJson<PreviewResponse>(
        "/api/seller/catalog/bulk",
        {
          method: "POST",
          body: JSON.stringify({ mode: "preview", rows }),
        }
      );
      setPreview(data);
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Failed to validate CSV."
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function commitImport() {
    if (!preview || preview.summary.invalid > 0 || rows.length === 0) return;
    if (
      !confirm(
        `Import ${preview.summary.creates} new and update ${preview.summary.updates} existing listings?`
      )
    ) {
      return;
    }

    setCommitting(true);
    setError("");
    try {
      const data = await authenticatedFetchJson<CommitResponse>(
        "/api/seller/catalog/bulk",
        {
          method: "POST",
          body: JSON.stringify({ mode: "commit", rows }),
        }
      );
      setResult(data);
    } catch (commitError) {
      setError(
        commitError instanceof Error
          ? commitError.message
          : "Failed to import listings."
      );
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setPreview(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_32%)] px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 lg:flex-row lg:items-start">
          <div>
            <p className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-black text-violet-200">
              Seller Catalog V17
            </p>
            <h1 className="mt-4 text-4xl font-black md:text-6xl">
              Bulk Listing Import
            </h1>
            <p className="mt-4 max-w-3xl text-slate-300">
              Create and update up to 200 marketplace listings from one CSV.
              Every row is checked on the server before any catalog change is
              applied.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/seller/products"
              className="rounded-xl border border-white/10 px-5 py-3 font-black transition hover:border-white/30"
            >
              Products
            </Link>
            <Link
              href="/seller/inventory"
              className="rounded-xl border border-cyan-400/30 px-5 py-3 font-black text-cyan-200 transition hover:border-cyan-300"
            >
              Inventory Center
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">1. Prepare your CSV</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Download the template for new listings, or export your current
              catalog to update existing products. Keep <code>product_id</code>
              empty for create rows and unchanged for update rows.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void downloadCsv("template")}
                disabled={downloading !== null}
                className="rounded-xl border border-violet-400/40 px-5 py-3 font-black text-violet-200 disabled:opacity-50"
              >
                {downloading === "template" ? "Downloading..." : "Download Template"}
              </button>
              <button
                type="button"
                onClick={() => void downloadCsv("export")}
                disabled={downloading !== null}
                className="rounded-xl border border-cyan-400/40 px-5 py-3 font-black text-cyan-200 disabled:opacity-50"
              >
                {downloading === "export" ? "Exporting..." : "Export Current Catalog"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">CSV rules</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <p>• Use exact category and game names, or provide their IDs.</p>
              <p>• Separate offer tags with a vertical bar, for example fast|safe.</p>
              <p>• Descriptions may contain commas and line breaks when quoted.</p>
              <p>• Variant listing price and stock remain controlled in Inventory Center.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">2. Upload and validate</h2>
              <p className="mt-2 text-sm text-slate-400">
                {fileName
                  ? `${fileName} · ${rows.length} data row${rows.length === 1 ? "" : "s"}`
                  : "Choose a UTF-8 CSV file, maximum 5 MB and 200 rows."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {rows.length > 0 ? (
                <button
                  type="button"
                  onClick={reset}
                  disabled={previewing || committing}
                  className="rounded-xl border border-white/10 px-5 py-3 font-black disabled:opacity-50"
                >
                  Reset
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loadingFile || previewing || committing}
                className="rounded-xl border border-white/20 px-5 py-3 font-black disabled:opacity-50"
              >
                {loadingFile ? "Reading..." : "Choose CSV"}
              </button>
              <button
                type="button"
                onClick={() => void previewImport()}
                disabled={rows.length === 0 || previewing || committing}
                className="rounded-xl bg-violet-400 px-5 py-3 font-black text-black disabled:opacity-40"
              >
                {previewing ? "Validating..." : "Validate Preview"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 font-bold text-red-200">
            {error}
          </p>
        ) : null}

        {preview ? (
          <section className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <SummaryCard label="Rows" value={preview.summary.total} />
              <SummaryCard label="Valid" value={preview.summary.valid} tone="green" />
              <SummaryCard label="Invalid" value={preview.summary.invalid} tone="red" />
              <SummaryCard label="Creates" value={preview.summary.creates} tone="violet" />
              <SummaryCard label="Updates" value={preview.summary.updates} tone="cyan" />
              <SummaryCard label="Warnings" value={preview.summary.warnings} tone="yellow" />
            </div>

            <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-black">3. Review and import</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {preview.summary.invalid > 0
                    ? "Fix invalid rows in the CSV, upload it again, and revalidate."
                    : "All rows passed server validation and are ready to import."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void commitImport()}
                disabled={
                  preview.summary.invalid > 0 ||
                  preview.summary.valid === 0 ||
                  committing
                }
                className="rounded-xl bg-cyan-400 px-6 py-3 font-black text-black disabled:opacity-40"
              >
                {committing ? "Importing..." : "Import Validated Listings"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/[0.06] text-left text-slate-300">
                  <tr>
                    <th className="px-4 py-4">Row</th>
                    <th className="px-4 py-4">Action</th>
                    <th className="px-4 py-4">Listing</th>
                    <th className="px-4 py-4">Game / Category</th>
                    <th className="px-4 py-4">Price / Stock</th>
                    <th className="px-4 py-4">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {preview.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.productId || row.title}`} className="bg-black/20 align-top">
                      <td className="px-4 py-4 font-black">{row.rowNumber}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black uppercase">
                          {row.action}
                        </span>
                        {row.productId ? (
                          <p className="mt-2 text-xs text-slate-500">ID {row.productId}</p>
                        ) : null}
                      </td>
                      <td className="max-w-sm px-4 py-4">
                        <p className="font-black">{row.title || "Untitled"}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {row.description || "No description"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-cyan-200">{row.gameName || "-"}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.category || "-"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-black">{Number.isFinite(row.price) ? row.price.toLocaleString("id-ID") : "Invalid"}</p>
                        <p className="mt-1 text-xs text-slate-500">Stock {row.stock} · {row.status}</p>
                      </td>
                      <td className="min-w-72 px-4 py-4">
                        <p className={`font-black ${row.valid ? "text-green-300" : "text-red-300"}`}>
                          {row.valid ? "Ready" : "Needs correction"}
                        </p>
                        {row.errors.map((message) => (
                          <p key={message} className="mt-2 text-xs leading-5 text-red-200">• {message}</p>
                        ))}
                        {row.warnings.map((message) => (
                          <p key={message} className="mt-2 text-xs leading-5 text-yellow-200">• {message}</p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className={`mt-6 rounded-3xl border p-6 ${result.summary.failed > 0 ? "border-yellow-400/30 bg-yellow-400/10" : "border-green-400/30 bg-green-400/10"}`}>
            <h2 className="text-2xl font-black">
              {result.summary.failed > 0 ? "Import completed with errors" : "Import completed"}
            </h2>
            <p className="mt-3 text-slate-200">
              Created {result.summary.created}, updated {result.summary.updated}, failed {result.summary.failed}.
            </p>
            {result.summary.failed > 0 ? (
              <div className="mt-4 space-y-2">
                {result.results.filter((item) => !item.ok).map((item) => (
                  <p key={`${item.rowNumber}-${item.title}`} className="text-sm text-yellow-100">
                    Row {item.rowNumber} · {item.title}: {item.error || "Unknown error"}
                  </p>
                ))}
              </div>
            ) : null}
            <Link
              href="/seller/products"
              className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              View Products
            </Link>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "green" | "red" | "violet" | "cyan" | "yellow";
}) {
  const toneClass = {
    default: "text-white",
    green: "text-green-300",
    red: "text-red-300",
    violet: "text-violet-300",
    cyan: "text-cyan-300",
    yellow: "text-yellow-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
