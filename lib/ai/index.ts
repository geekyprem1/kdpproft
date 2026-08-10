export { isAiConfigured, primaryModel, fallbackModel, modelChain } from "./models";
export { generateText, generateJson } from "./provider";
export { generateWordList, type WordListResult } from "./word-list";
export { generateMetadata, type BookMetadata } from "./metadata";
export { generateNicheResearch, type NicheResearchResult } from "./niche";
export {
  generateTitleVariations,
  computeTitleScore,
  titleBand,
  type TitleOptimizerInput,
  type TitleOptimizerResult,
  type TitleVariation,
  type TitleFactors,
  type TitleBand,
} from "./title-optimizer";
export { analyzeTopic, type TopicAnalysis, type AnalyzeInput } from "./opportunity-analyze";
export { generateBookAngles, type BookAngle, type AngleInput } from "./autopilot-angles";
export { generateOutline, type EbookOutline, type OutlineChapter } from "./outline";
export {
  writeChapter,
  rewriteChapter,
  wordCount,
  type RewriteAction,
} from "./chapter";
