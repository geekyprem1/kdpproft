/**
 * Niche Research types. Built on the shared Book Opportunity Engine
 * (`lib/opportunity`) — re-exports its types for backward compatibility.
 */

import type {
  BookType,
  OpportunityFactors,
  OpportunityBand,
} from "../opportunity/types";

export {
  BOOK_TYPE_LABELS,
  ALL_BOOK_TYPES,
} from "../opportunity/types";
export type {
  BookType,
  OpportunityFactors,
  OpportunityBand,
  RecommendedType,
} from "../opportunity/types";

/** @deprecated alias kept for existing imports. */
export type NicheBookType = BookType;

export interface NicheIdea {
  niche: string;
  factors: OpportunityFactors; // demand, competition, evergreen, monetization
  opportunity: number; // computed composite
  band: OpportunityBand;
  seasonal: string;
  monetizationNote: string;
  recommendedBookType: BookType;
  bookTypes: BookType[];
}

export interface NicheReportInput {
  keyword: string;
  audience?: string;
  category?: string;
  country?: string;
}

export interface NicheReport extends NicheReportInput {
  id: string;
  model: string | null;
  ideas: NicheIdea[];
  created_at: string;
}
