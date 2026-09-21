/**
 * Shared helper: pad an interior to KDP's 24-page paperback minimum with lightly
 * ruled "Notes" pages, so a puzzle book with few puzzles is still upload-ready.
 */

import { MIN_PAGE_COUNT } from "../pdf/kdp-specs";
import type { InteriorPageContent } from "../pdf/templates/interior";

function notesPage(): InteriorPageContent {
  return {
    showPageNumber: false,
    html: `<div style="height:100%">
      <h2 style="border-bottom:2px solid #333;padding-bottom:0.06in;margin-bottom:0.2in">Notes</h2>
      <div style="height:8.5in;background-image:repeating-linear-gradient(to bottom, transparent 0, transparent calc(0.36in - 1px), #cfcfcf calc(0.36in - 1px), #cfcfcf 0.36in)"></div>
    </div>`,
  };
}

/** Push Notes pages until the interior meets the KDP minimum page count, and
 *  until the total is even. Duplex printing binds pages in pairs — KDP would
 *  insert its own blank for an odd count, leaving the wraparound cover (spine
 *  sized from the declared count) one page-thickness off. */
export function padToKdpMinimum(pages: InteriorPageContent[]): void {
  while (pages.length < MIN_PAGE_COUNT || pages.length % 2 === 1) pages.push(notesPage());
}

/** Trim-agnostic blank page for even-count padding on any trim size. */
function blankPage(): InteriorPageContent {
  return { showPageNumber: false, html: `<div style="height:100%"></div>` };
}

/** Push a blank page if the total is odd, so duplex printing pairs cleanly. */
export function padToEven(pages: InteriorPageContent[]): void {
  if (pages.length % 2 === 1) pages.push(blankPage());
}
