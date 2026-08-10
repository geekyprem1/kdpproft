/**
 * Maze HTML/SVG rendering for the PDF engine — maze pages and solution pages.
 * Start is the top-left cell (open top edge, "START"); finish is bottom-right
 * (open bottom edge, "FINISH"). Solution pages overlay the unique path.
 */

import { WALL, type Maze } from "./types";

const U = 10; // viewBox units per cell
const SIDE_IN = 6.5; // physical square size on the page

function mazeSvg(maze: Maze, showSolution: boolean): string {
  const { width: w, height: h, cells } = maze;
  const W = w * U;
  const H = h * U;
  const idx = (r: number, c: number) => r * w + c;

  const lines: string[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const v = cells[idx(r, c)];
      const x = c * U;
      const y = r * U;
      // North wall (skip for the start cell to make an entrance)
      if (v & WALL.N && !(r === 0 && c === 0)) lines.push(`M${x} ${y}h${U}`);
      // West wall
      if (v & WALL.W) lines.push(`M${x} ${y}v${U}`);
      // East wall only on the last column
      if (c === w - 1 && v & WALL.E) lines.push(`M${x + U} ${y}v${U}`);
      // South wall only on the last row (skip the finish cell for an exit)
      if (r === h - 1 && v & WALL.S && !(r === h - 1 && c === w - 1)) {
        lines.push(`M${x} ${y + U}h${U}`);
      }
    }
  }

  const path = `<path d="${lines.join("")}" fill="none" stroke="#111" stroke-width="1.2" stroke-linecap="square"/>`;

  let solution = "";
  if (showSolution) {
    const pts = maze.solution.map(([r, c]) => `${c * U + U / 2},${r * U + U / 2}`);
    // extend the line out through the entrance and exit openings
    const first = `${U / 2},0`;
    const last = `${(w - 1) * U + U / 2},${H}`;
    solution = `<polyline points="${first} ${pts.join(" ")} ${last}" fill="none" stroke="#9aa0a6" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  return `
    <div style="text-align:center;margin:0.15in 0">
      <svg viewBox="-1 -1 ${W + 2} ${H + 2}" width="${SIDE_IN}in" height="${SIDE_IN}in" xmlns="http://www.w3.org/2000/svg">
        ${solution}
        ${path}
      </svg>
    </div>`;
}

export function renderMazePageBody(maze: Maze, index: number): string {
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Maze ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0;text-transform:capitalize">${maze.difficulty} &middot; ${maze.width}&times;${maze.height}</p>
    <p style="text-align:center;color:#444;margin:0.05in 0 0;font-size:10pt;font-weight:bold;letter-spacing:0.15em">START ▸ top-left &nbsp;&nbsp; FINISH ▸ bottom-right</p>
    ${mazeSvg(maze, false)}`;
}

export function renderMazeSolutionBody(maze: Maze, index: number): string {
  return `
    <h2 style="text-align:center;margin-bottom:0.05in">Solution ${index + 1}</h2>
    <p style="text-align:center;color:#666;margin:0 0 0.05in;text-transform:capitalize">${maze.difficulty}</p>
    ${mazeSvg(maze, true)}`;
}
