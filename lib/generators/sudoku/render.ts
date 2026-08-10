/**
 * Sudoku HTML rendering for the PDF engine — puzzle pages and solution pages.
 */

import type { SudokuPuzzle } from "./types";

const CELL_IN = 0.55; // 9 × 0.55 = 4.95in grid, centered on 8.5in trim
const FONT_PT = 20;
// Large-print edition: bigger cells + numbers for the seniors / low-vision market.
const CELL_IN_LP = 0.72; // 9 × 0.72 = 6.48in
const FONT_PT_LP = 28;

const THIN = "1px solid #b0b0b0";
const THICK = "2.5px solid #111";

function cellStyle(r: number, c: number): string {
  const top = r % 3 === 0 ? THICK : THIN;
  const left = c % 3 === 0 ? THICK : THIN;
  const right = c === 8 ? THICK : THIN;
  const bottom = r === 8 ? THICK : THIN;
  return `border-top:${top};border-left:${left};border-right:${right};border-bottom:${bottom};`;
}

/**
 * Render a 9×9 grid. `cells` holds the numbers to show (0 = blank). When
 * `givens` is provided (solution pages), its non-zero cells are bold so the
 * original clues stand out from the filled-in answers.
 */
function gridTable(cells: number[], givens?: number[], largePrint = false): string {
  const cell = largePrint ? CELL_IN_LP : CELL_IN;
  const font = largePrint ? FONT_PT_LP : FONT_PT;
  const rows: string[] = [];
  for (let r = 0; r < 9; r++) {
    const tds: string[] = [];
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const v = cells[i];
      const isGiven = givens ? givens[i] !== 0 : true;
      const weight = givens ? (isGiven ? "font-weight:bold;color:#111;" : "color:#666;") : "";
      tds.push(
        `<td style="${cellStyle(r, c)}width:${cell}in;height:${cell}in;text-align:center;vertical-align:middle;${weight}">${v || ""}</td>`
      );
    }
    rows.push(`<tr>${tds.join("")}</tr>`);
  }
  return `
    <table style="
      border-collapse:collapse;
      margin:0.2in auto;
      font-family:'Helvetica Neue',Arial,sans-serif;
      font-size:${font}pt;
    ">${rows.join("")}</table>`;
}

export function renderSudokuPuzzleBody(puzzle: SudokuPuzzle, index: number, largePrint = false): string {
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Puzzle ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0 0 0.1in;text-transform:capitalize">${puzzle.difficulty} &middot; ${puzzle.givens} clues</p>
    ${gridTable(puzzle.puzzle, undefined, largePrint)}`;
}

export function renderSudokuSolutionBody(puzzle: SudokuPuzzle, index: number, largePrint = false): string {
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Solution ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0 0 0.1in;text-transform:capitalize">${puzzle.difficulty}</p>
    ${gridTable(puzzle.solution, puzzle.puzzle, largePrint)}`;
}
