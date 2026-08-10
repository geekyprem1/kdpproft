/**
 * Page-body builders for each low-content layout.
 *
 * Each function returns the HTML that fills the interior template's `.content` box
 * (already inside KDP-safe margins). Everything is pure CSS/SVG — black on white,
 * thin rules — so pages print cleanly with no images and no per-book cost. Layouts
 * are UNDATED (the same template repeated), which is how low-content books sell.
 */

import type { LowContentLayout } from "./types";

const INK = "#111";
const RULE = "#c9c9c9";
const FAINT = "#e4e4e4";

/** A block of ruled lines filling the available height. */
function ruledFill(gapIn = 0.34): string {
  return `<div style="flex:1;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(${gapIn}in - 1px), ${RULE} calc(${gapIn}in - 1px), ${RULE} ${gapIn}in)"></div>`;
}

/** A titled header strip with an optional right-side field (e.g. "DATE: ____"). */
function header(title: string, right?: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid ${INK};padding-bottom:0.06in;margin-bottom:0.18in">
    <div style="font-size:13pt;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${INK}">${title}</div>
    ${right ? `<div style="font-size:10pt;color:#555">${right}</div>` : ""}
  </div>`;
}

/** N labelled ruled lines (used by gratitude / notes areas). */
function numberedLines(n: number, gapIn = 0.4): string {
  return Array.from({ length: n }, () =>
    `<div style="border-bottom:1px solid ${RULE};height:${gapIn}in"></div>`
  ).join("");
}

/** A table with header row + `rows` empty ruled rows across `cols` columns. */
function table(headers: string[], rows: number): string {
  const th = headers
    .map((h) => `<th style="border:1px solid ${RULE};padding:5pt 6pt;font-size:9.5pt;text-transform:uppercase;letter-spacing:0.05em;background:#f4f4f4;text-align:left">${h}</th>`)
    .join("");
  const tr = Array.from({ length: rows }, () =>
    `<tr>${headers.map(() => `<td style="border:1px solid ${RULE};height:0.34in"></td>`).join("")}</tr>`
  ).join("");
  return `<table style="width:100%;border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

const fullColumn = (inner: string) =>
  `<div style="display:flex;flex-direction:column;height:100%">${inner}</div>`;

// ── individual layouts ──────────────────────────────────────────────────────

function lined(): string {
  return fullColumn(ruledFill(0.34));
}

function dotgrid(): string {
  return `<div style="height:100%;background-image:radial-gradient(${RULE} 1.1px, transparent 1.2px);background-size:0.25in 0.25in;background-position:0.05in 0.05in"></div>`;
}

function grid(): string {
  return `<div style="height:100%;background-image:linear-gradient(${FAINT} 1px, transparent 1px), linear-gradient(90deg, ${FAINT} 1px, transparent 1px);background-size:0.22in 0.22in"></div>`;
}

function blank(): string {
  return `<div style="height:100%;border:1px solid ${FAINT};border-radius:6px"></div>`;
}

function plannerDaily(): string {
  const slots = [];
  for (let h = 6; h <= 20; h++) {
    const label = h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
    slots.push(`<div style="display:flex;align-items:flex-end;border-bottom:1px solid ${RULE};height:0.33in"><span style="width:0.7in;font-size:9pt;color:#888">${label}</span></div>`);
  }
  const todos = Array.from({ length: 8 }, () =>
    `<div style="display:flex;align-items:center;gap:7pt;height:0.34in;border-bottom:1px solid ${RULE}"><span style="width:12pt;height:12pt;border:1.5px solid ${INK};border-radius:3px;display:inline-block"></span></div>`
  ).join("");
  return fullColumn(`
    ${header("Daily Plan", "DATE: ______________")}
    <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.06in">TODAY'S TOP 3</div>
    ${numberedLines(3, 0.36)}
    <div style="display:flex;gap:0.3in;flex:1;margin-top:0.18in;min-height:0">
      <div style="flex:1.15;display:flex;flex-direction:column;min-height:0">
        <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.04in">SCHEDULE</div>
        <div style="flex:1;overflow:hidden">${slots.join("")}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.04in">TO-DO</div>
        ${todos}
      </div>
    </div>`);
}

function plannerWeekly(): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const blocks = days
    .map((d) => `<div style="border:1px solid ${RULE};border-radius:5px;padding:5pt 7pt;flex:1;min-height:0">
      <div style="font-size:9.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:${INK};border-bottom:1px solid ${FAINT};padding-bottom:3pt;margin-bottom:3pt">${d}</div>
      <div style="background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.26in - 1px), ${FAINT} calc(0.26in - 1px), ${FAINT} 0.26in);height:0.85in"></div>
    </div>`)
    .join("");
  return fullColumn(`
    ${header("Weekly Plan", "WEEK OF: ______________")}
    <div style="display:flex;flex-direction:column;gap:0.09in;flex:1;min-height:0">${blocks}</div>`);
}

function plannerMonthly(): string {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const headRow = dow.map((d) => `<div style="flex:1;text-align:center;font-size:9pt;font-weight:bold;color:#666;padding:3pt 0">${d}</div>`).join("");
  const cell = `<div style="flex:1;border:1px solid ${RULE};min-height:0"></div>`;
  const week = `<div style="display:flex;flex:1;gap:0;min-height:0">${cell.repeat(7)}</div>`;
  return fullColumn(`
    ${header("Monthly Plan", "MONTH: ______________")}
    <div style="display:flex">${headRow}</div>
    <div style="display:flex;flex-direction:column;flex:1;min-height:0">${week.repeat(6)}</div>`);
}

function habitTracker(): string {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const dayHead = days.map((d) => `<th style="border:1px solid ${RULE};width:0.19in;font-size:6.5pt;padding:2pt 0;text-align:center;color:#777">${d}</th>`).join("");
  const rows = Array.from({ length: 16 }, () =>
    `<tr><td style="border:1px solid ${RULE};height:0.32in"></td>${days.map(() => `<td style="border:1px solid ${FAINT}"></td>`).join("")}</tr>`
  ).join("");
  return fullColumn(`
    ${header("Habit Tracker", "MONTH: ______________")}
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr><th style="border:1px solid ${RULE};padding:4pt 6pt;font-size:9pt;text-align:left;background:#f4f4f4">Habit</th>${dayHead}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function gratitude(): string {
  return fullColumn(`
    ${header("Gratitude Journal", "DATE: ______________")}
    <div style="font-size:11pt;color:${INK};margin-bottom:0.1in">Today I am grateful for…</div>
    ${numberedLines(3, 0.46)}
    <div style="font-size:11pt;color:${INK};margin:0.2in 0 0.08in">One thing that made today great…</div>
    ${numberedLines(2, 0.44)}
    <div style="font-size:11pt;color:${INK};margin:0.2in 0 0.08in">A kind thing I did / can do…</div>
    <div style="flex:1;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.4in - 1px), ${RULE} calc(0.4in - 1px), ${RULE} 0.4in)"></div>`);
}

function budget(): string {
  return fullColumn(`
    ${header("Monthly Budget", "MONTH: ______________")}
    <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.06in">INCOME</div>
    ${table(["Source", "Amount"], 4)}
    <div style="font-size:10pt;font-weight:bold;color:#555;margin:0.16in 0 0.06in">EXPENSES</div>
    ${table(["Description", "Category", "Amount"], 11)}
    <div style="display:flex;justify-content:flex-end;margin-top:0.12in;font-size:11pt"><span style="border-top:2px solid ${INK};padding-top:5pt">TOTAL: ______________</span></div>`);
}

function password(): string {
  return fullColumn(`
    ${header("Password Log")}
    ${table(["Website / App", "Username / Email", "Password", "Notes"], 12)}`);
}

function fitnessLog(): string {
  return fullColumn(`
    ${header("Workout Log", "DATE: __________")}
    <div style="display:flex;gap:0.3in;font-size:9.5pt;color:#666;margin-bottom:0.12in"><span>Focus: ____________</span><span>Duration: __________</span></div>
    ${table(["Exercise", "Sets", "Reps", "Weight", "Notes"], 12)}
    <div style="font-size:10pt;font-weight:bold;color:#555;margin:0.16in 0 0.06in">NOTES</div>
    <div style="flex:1;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.34in - 1px), ${RULE} calc(0.34in - 1px), ${RULE} 0.34in)"></div>`);
}

function healthLog(): string {
  return fullColumn(`
    ${header("Health Log", "MONTH: ______________")}
    ${table(["Date", "Time", "Systolic", "Diastolic", "Pulse", "Notes"], 18)}`);
}

function recipe(): string {
  return fullColumn(`
    ${header("Recipe", "SERVES: ______")}
    <div style="display:flex;gap:0.3in;font-size:9.5pt;color:#666;margin-bottom:0.12in"><span>Prep: ________</span><span>Cook: ________</span><span>Temp: ________</span></div>
    <div style="display:flex;gap:0.3in;flex:1;min-height:0">
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.06in">INGREDIENTS</div>
        <div style="flex:1;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.32in - 1px), ${RULE} calc(0.32in - 1px), ${RULE} 0.32in)"></div>
      </div>
      <div style="flex:1.3;display:flex;flex-direction:column;min-height:0">
        <div style="font-size:10pt;font-weight:bold;color:#555;margin-bottom:0.06in">DIRECTIONS</div>
        <div style="flex:1;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.32in - 1px), ${RULE} calc(0.32in - 1px), ${RULE} 0.32in)"></div>
      </div>
    </div>`);
}

/** Registry of page builders keyed by layout. */
export const LAYOUT_BUILDERS: Record<LowContentLayout, () => string> = {
  lined,
  dotgrid,
  grid,
  blank,
  planner_daily: plannerDaily,
  planner_weekly: plannerWeekly,
  planner_monthly: plannerMonthly,
  habit_tracker: habitTracker,
  gratitude,
  budget,
  password,
  fitness_log: fitnessLog,
  health_log: healthLog,
  recipe,
};
