/**
 * Validate the generated sample books against KDP specifications.
 * Reads examples/manifest.json, checks every book, prints a report, and writes
 * examples/VALIDATION.md.
 *
 *   npm run examples:validate
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateBook, allPass, type Check } from "../lib/pdf";
import type { TrimSize, PaperStock } from "../lib/pdf";

interface ManifestBook {
  slug: string;
  title: string;
  trim: TrimSize;
  paper: PaperStock;
  bleed: boolean;
  pageCount: number;
  interior: string;
  cover: string;
}

async function main() {
  const examplesDir = path.resolve(process.cwd(), "examples");
  const manifestPath = path.join(examplesDir, "manifest.json");

  let manifest: { books: ManifestBook[] };
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    console.error("No examples/manifest.json found. Run `npm run examples:generate` first.");
    process.exitCode = 1;
    return;
  }

  console.log("── KDP validation of sample books ──────────────");
  let overall = true;
  const md: string[] = [
    "# Sample Book Validation",
    "",
    "Automated KDP-spec checks. Authoritative final check remains the KDP previewer upload.",
    "",
  ];

  for (const book of manifest.books) {
    const checks: Check[] = await validateBook({
      interiorPath: path.resolve(process.cwd(), book.interior),
      coverPath: path.resolve(process.cwd(), book.cover),
      trim: book.trim,
      paper: book.paper,
      bleed: book.bleed,
    });
    const ok = allPass(checks);
    overall = overall && ok;

    console.log(`\n${ok ? "✓" : "✗"} ${book.title} (${book.slug})`);
    for (const c of checks) console.log(`   ${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}`);

    md.push(`## ${book.title} ${ok ? "✅" : "❌"}`, "");
    md.push("| Check | Result | Detail |", "|---|---|---|");
    for (const c of checks) md.push(`| ${c.name} | ${c.pass ? "✅" : "❌"} | ${c.detail} |`);
    md.push("");
  }

  md.push("---", "", `Overall: ${overall ? "✅ ALL PASS" : "❌ FAILURES PRESENT"}`, "");
  await writeFile(path.join(examplesDir, "VALIDATION.md"), md.join("\n"));

  console.log("\n────────────────────────────────────────────────");
  console.log(overall ? "✓ ALL SAMPLE BOOKS PASS" : "✗ FAILURES PRESENT");
  console.log("Report: examples/VALIDATION.md");
  if (!overall) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exitCode = 1;
});
