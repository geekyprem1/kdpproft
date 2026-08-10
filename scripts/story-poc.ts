/**
 * Storybook POC — character consistency proof.
 *
 *   npm run story:poc          (uses .env.local: OPENROUTER + REPLICATE_API_TOKEN)
 *
 * Builds a character bible, a locked reference image, then 6 scenes via FLUX
 * Kontext (conditioned on the reference). Each scene is judged for character
 * consistency by a vision model. Outputs a visual report + cost/time analysis to
 * output/story-poc/.
 *
 * Without REPLICATE_API_TOKEN it runs OFFLINE with placeholder art (harness check
 * only — not a real consistency proof; vision eval is skipped).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { closeBrowser, renderPdfFromCss } from "../lib/pdf";
import { evaluateConsistency, type ConsistencyResult } from "../lib/ai/vision";
import {
  buildBible,
  referencePrompt,
  scenePrompt,
  SCENES,
} from "../lib/generators/story-poc/character";
import {
  generateReference,
  generateScene,
  toDataUri,
  isImageConfigured,
  isSiliconFlowConfigured,
  KONTEXT_MODEL,
} from "../lib/generators/story-poc/images";

// Indicative provider rates (USD). Adjust to live pricing.
// SiliconFlow FLUX.1-Kontext-dev is ~$0.015/image; Replicate kontext-pro ~$0.04.
const RATE = {
  schnell: 0.003,
  kontext: isSiliconFlowConfigured() ? 0.015 : 0.04,
  vision: 0.001,
  text: 0.01,
};
const PASS_SCORE = 0.7;

interface SceneOut {
  scene: string;
  dataUri: string;
  ms: number;
  eval: ConsistencyResult | null;
  evalMs: number;
  error?: string;
}

function badge(s: SceneOut): { label: string; color: string; pass: boolean } {
  if (!s.eval) return { label: "not evaluated", color: "#9ca3af", pass: false };
  const pass = s.eval.sameCharacter && s.eval.score >= PASS_SCORE;
  const score = s.eval.score;
  const color = score >= 0.8 ? "#16a34a" : score >= 0.6 ? "#d97706" : "#dc2626";
  return { label: `${(score * 100).toFixed(0)}% ${pass ? "PASS" : "FAIL"}`, color, pass };
}

async function main() {
  const live = isImageConfigured();
  const provider = isSiliconFlowConfigured() ? "SiliconFlow" : "Replicate";
  const outDir = path.resolve(process.cwd(), "output", "story-poc");
  await mkdir(outDir, { recursive: true });

  console.log("── Storybook POC: character consistency ────────");
  console.log(live ? `LIVE · ${provider} · Kontext model: ${KONTEXT_MODEL}` : "OFFLINE · placeholder art (not a real proof)");

  // 1) Character bible
  const bible = await buildBible();
  console.log(`Character: ${bible.name} (bible by ${bible.generatedBy})`);
  console.log(`Descriptor: ${bible.descriptor}`);

  // 2) Reference (master) image
  const tRef = Date.now();
  const refBytes = await generateReference({ prompt: referencePrompt(bible), seed: 101 });
  const refMs = Date.now() - tRef;
  const refUri = toDataUri(refBytes);
  await writeFile(path.join(outDir, "reference.png"), Buffer.from(refBytes));

  // 3) Six scenes (reference-conditioned) + 4) consistency validation
  const scenes: SceneOut[] = [];
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const t0 = Date.now();
    let dataUri = "";
    let err: string | undefined;
    let evalRes: ConsistencyResult | null = null;
    let evalMs = 0;
    try {
      const bytes = await generateScene({ prompt: scenePrompt(bible, scene), referenceDataUri: refUri, seed: 200 + i });
      await writeFile(path.join(outDir, `scene-${i + 1}.png`), Buffer.from(bytes));
      dataUri = toDataUri(bytes);
      if (live) {
        const te = Date.now();
        evalRes = await evaluateConsistency({ referenceDataUri: refUri, sceneDataUri: dataUri, descriptor: bible.descriptor });
        evalMs = Date.now() - te;
      }
    } catch (e) {
      err = (e as Error).message;
    }
    const s: SceneOut = { scene, dataUri, ms: Date.now() - t0, eval: evalRes, evalMs, error: err };
    scenes.push(s);
    const b = badge(s);
    console.log(`  ${i + 1}. ${scene} — ${b.label} (${(s.ms / 1000).toFixed(1)}s)${err ? " ERROR: " + err : ""}`);
  }

  // 7) Cost + time
  const perScene = RATE.kontext + (live ? RATE.vision : 0);
  const pocCost = RATE.schnell + 6 * perScene + RATE.text;
  const book = (n: number) => RATE.schnell + n * (RATE.kontext + RATE.vision) + RATE.text * 5 + RATE.kontext; // +cover
  const avgSceneMs = scenes.reduce((a, s) => a + s.ms, 0) / scenes.length;
  const totalMs = refMs + scenes.reduce((a, s) => a + s.ms + s.evalMs, 0);
  const estBook = (n: number) => refMs + Math.ceil(n / 4) * avgSceneMs; // concurrency 4

  const passCount = scenes.filter((s) => badge(s).pass).length;
  const allPass = live && passCount === scenes.length;

  // 6) Visual report
  const card = (s: SceneOut, i: number) => {
    const b = badge(s);
    return `<div class="card">
      <div class="imgwrap">${s.dataUri ? `<img src="${s.dataUri}"/>` : `<div class="err">no image</div>`}</div>
      <div class="meta">
        <div class="row"><b>${i + 1}. ${s.scene}</b><span class="pill" style="background:${b.color}">${b.label}</span></div>
        ${s.eval ? `<div class="reasons">${s.eval.reasons.map((r) => `• ${r}`).join("<br/>") || "no issues noted"}</div>` : `<div class="reasons muted">${live ? "" : "consistency eval skipped (offline placeholder)"}${s.error ? "ERROR: " + s.error : ""}</div>`}
      </div>
    </div>`;
  };

  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page{size:8.5in 11in;margin:0.5in}
    body{font-family:Arial,sans-serif;color:#111;margin:0}
    h1{font-size:20pt;margin:0 0 2pt} .sub{color:#555;font-size:9pt}
    .banner{padding:8pt 10pt;border-radius:6px;margin:10pt 0;font-weight:bold;color:#fff;background:${allPass ? "#16a34a" : live ? "#dc2626" : "#6b7280"}}
    .ref{display:flex;gap:12pt;align-items:center;border:1px solid #ddd;border-radius:8px;padding:10pt;margin-bottom:10pt}
    .ref img{width:1.8in;height:1.8in;object-fit:contain;border:1px solid #eee;border-radius:6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8pt}
    .card{border:1px solid #ddd;border-radius:8px;overflow:hidden;break-inside:avoid}
    .imgwrap{height:2.4in;background:#fafafa;display:flex;align-items:center;justify-content:center}
    .imgwrap img{max-width:100%;max-height:100%;object-fit:contain}
    .meta{padding:7pt 9pt} .row{display:flex;justify-content:space-between;align-items:center;gap:6pt;font-size:10pt}
    .pill{color:#fff;font-size:8pt;padding:2pt 7pt;border-radius:999px;white-space:nowrap}
    .reasons{margin-top:4pt;font-size:8.5pt;color:#444} .muted{color:#999}
    table{border-collapse:collapse;font-size:9pt;margin-top:6pt;width:100%}
    td,th{border:1px solid #e5e5e5;padding:4pt 8pt;text-align:left}
    .err{color:#dc2626;font-size:9pt}
  </style></head><body>
    <h1>Storybook POC — Character Consistency</h1>
    <div class="sub">${live ? `LIVE · ${KONTEXT_MODEL}` : "OFFLINE placeholder run (not a real proof)"} · ${new Date().toLocaleString()}</div>
    <div class="banner">${live ? `${passCount}/6 scenes consistent — ${allPass ? "✅ SUCCESS: dragon stayed on-model" : "❌ drift detected"}` : "OFFLINE: add SILICONFLOW_API_KEY (or REPLICATE_API_TOKEN) and re-run for a real proof"}</div>

    <div class="ref">
      <img src="${refUri}"/>
      <div><b>${bible.name}</b> — locked reference<br/><span class="sub">${bible.descriptor}</span></div>
    </div>

    <div class="grid">${scenes.map(card).join("")}</div>

    <h3>Cost &amp; time</h3>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Cost per scene image (Kontext${live ? " + vision" : ""})</td><td>$${perScene.toFixed(3)}</td></tr>
      <tr><td>This POC (1 reference + 6 scenes + bible)</td><td>$${pocCost.toFixed(2)}</td></tr>
      <tr><td>Est. cost per 12-page book</td><td>$${book(12).toFixed(2)}</td></tr>
      <tr><td>Est. cost per 24-page book</td><td>$${book(24).toFixed(2)}</td></tr>
      <tr><td>Avg time per scene</td><td>${(avgSceneMs / 1000).toFixed(1)}s${live ? "" : " (placeholder — not meaningful)"}</td></tr>
      <tr><td>This POC total time</td><td>${(totalMs / 1000).toFixed(1)}s</td></tr>
      <tr><td>Est. time per 24-page book (concurrency 4)</td><td>${(estBook(24) / 1000).toFixed(0)}s${live ? "" : " (n/a offline)"}</td></tr>
    </table>
    <p class="sub">Rates are indicative: FLUX Schnell ~$${RATE.schnell}/img, FLUX Kontext ~$${RATE.kontext}/img, vision ~$${RATE.vision}/call.</p>
  </body></html>`;

  await writeFile(path.join(outDir, "report.html"), html);
  await writeFile(path.join(outDir, "report.pdf"), Buffer.from(await renderPdfFromCss(html)));

  console.log("\n── Cost ────────────────────────────────────────");
  console.log(`per scene: $${perScene.toFixed(3)} · POC: $${pocCost.toFixed(2)} · 12pg: $${book(12).toFixed(2)} · 24pg: $${book(24).toFixed(2)}`);
  console.log(`\nReport: ${path.join(outDir, "report.html")} (+ report.pdf, reference.png, scene-*.png)`);
  if (live) console.log(allPass ? "✅ SUCCESS: dragon consistent across all 6 scenes" : `⚠ ${passCount}/6 consistent — review report`);
  else console.log("⚠ OFFLINE: set SILICONFLOW_API_KEY (or REPLICATE_API_TOKEN) in .env.local for the real proof.");

  await closeBrowser();
}

main().catch(async (err) => {
  await closeBrowser().catch(() => {});
  console.error("POC failed:", err);
  process.exit(1);
});
