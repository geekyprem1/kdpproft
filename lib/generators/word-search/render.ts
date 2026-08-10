/**
 * Word-search page rendering.
 *
 * Produces the HTML body for a puzzle page and a solution page. These are
 * consumed as `InteriorPageContent` by the generic PDF engine — the engine
 * itself knows nothing about word search.
 */

import { solutionCells } from "./generate";
import type { WordSearchPuzzle } from "./types";

/** Max width (in) the grid may occupy; cells are sized to fit. */
const MAX_GRID_WIDTH_IN = 6.5;

function gridGeometry(size: number, largePrint = false) {
  const maxW = largePrint ? 6.9 : MAX_GRID_WIDTH_IN;
  const maxCell = largePrint ? 0.66 : 0.5;
  const cellIn = Math.min(maxCell, maxW / size);
  const fontPt = Math.max(9, Math.round(cellIn * 72 * (largePrint ? 0.58 : 0.52)));
  return { cellIn, fontPt };
}

function gridTable(
  puzzle: WordSearchPuzzle,
  opts: { highlight?: Set<string>; dimOthers?: boolean; largePrint?: boolean }
): string {
  const { cellIn, fontPt } = gridGeometry(puzzle.size, opts.largePrint);
  const highlight = opts.highlight;
  const dim = opts.dimOthers ?? false;

  const rows = puzzle.grid
    .map((row, r) => {
      const cells = row
        .map((ch, c) => {
          const isHi = highlight?.has(`${r},${c}`) ?? false;
          const style = isHi
            ? "background:#111;color:#fff;font-weight:bold;"
            : dim
              ? "color:#bbb;"
              : "";
          return `<td style="${style}">${ch}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <table class="ws-grid" style="
      border-collapse:collapse;
      margin:0.15in auto;
      font-family:'Courier New',monospace;
      font-size:${fontPt}pt;
    ">
      <style>
        .ws-grid td {
          width:${cellIn}in; height:${cellIn}in;
          text-align:center; vertical-align:middle;
          border:1px solid #ccc;
        }
      </style>
      ${rows}
    </table>`;
}

function wordList(words: string[], widthIn: number, columns = 3, largePrint = false): string {
  if (words.length === 0) return "";
  const cols = largePrint ? 2 : columns;
  const fontSize = largePrint ? "15pt" : "11pt";
  const sorted = [...words].sort();
  const items = sorted.map((w) => `<li>${w}</li>`).join("");
  // Match the grid's width and center the block so the word list lines up under
  // the grid instead of spilling out to the left.
  return `
    <ul style="
      columns:${cols};
      column-gap:0.3in;
      list-style:none;
      padding:0;
      margin:0.12in auto 0;
      max-width:${widthIn}in;
      font-size:${fontSize};
      line-height:1.7;
      letter-spacing:0.02em;
    ">${items}</ul>`;
}

/** Puzzle page body (grid + word list to find). */
export function renderPuzzleBody(puzzle: WordSearchPuzzle, index: number, largePrint = false): string {
  const words = puzzle.words.map((w) => w.word);
  const { cellIn } = gridGeometry(puzzle.size, largePrint);
  const gridWidthIn = cellIn * puzzle.size;
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Puzzle ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0 0 0.1in">Theme: ${puzzle.theme} &middot; ${puzzle.difficulty}</p>
    ${gridTable(puzzle, { largePrint })}
    <p style="text-align:center;font-weight:bold;margin:0.15in 0 0">Find these words:</p>
    ${wordList(words, gridWidthIn, 3, largePrint)}`;
}

/** Solution page body (grid with answers highlighted, fillers dimmed). */
export function renderSolutionBody(puzzle: WordSearchPuzzle, index: number, largePrint = false): string {
  const hi = new Set<string>();
  for (const w of puzzle.words) {
    for (const cell of solutionCells(w)) hi.add(cell);
  }
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Solution ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0 0 0.1in">Theme: ${puzzle.theme}</p>
    ${gridTable(puzzle, { highlight: hi, dimOthers: true, largePrint })}`;
}
