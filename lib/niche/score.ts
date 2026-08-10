/**
 * Back-compat shim — niche scoring now lives in the shared Book Opportunity
 * Engine. Import from `@/lib/opportunity` in new code.
 */

export {
  computeOpportunity,
  opportunityBand,
  factorLabel,
  BAND_COLORS,
} from "../opportunity/score";
