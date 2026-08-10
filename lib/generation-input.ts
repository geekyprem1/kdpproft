import type { PipelineBookType } from "@/lib/books/pipeline";

interface IntegerOptions {
  field: string;
  min: number;
  max: number;
  defaultValue?: number;
}

export class GenerationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationInputError";
  }
}

// Puzzle/coloring types only — these have a puzzle/page COUNT with bounds. Other
// pipeline types (e.g. lowcontent) validate their own page count elsewhere.
const COUNT_CONFIG: Partial<Record<PipelineBookType, { min: number; max: number; defaultValue: number }>> = {
  word_search: { min: 11, max: 50, defaultValue: 25 },
  sudoku: { min: 10, max: 100, defaultValue: 30 },
  maze: { min: 10, max: 100, defaultValue: 30 },
  coloring: { min: 22, max: 40, defaultValue: 24 },
};

export const PUZZLE_BOOK_TYPES = Object.freeze(Object.keys(COUNT_CONFIG) as PipelineBookType[]);

export function normalizeFiniteInteger(value: unknown, options: IntegerOptions): number {
  if (value === undefined && options.defaultValue !== undefined) return options.defaultValue;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new GenerationInputError(`${options.field} must be a finite integer`);
  }
  if (value < options.min || value > options.max) {
    throw new GenerationInputError(`${options.field} must be between ${options.min} and ${options.max}`);
  }
  return value;
}

export function normalizePuzzleCount(bookType: PipelineBookType, value: unknown): number {
  const cfg = COUNT_CONFIG[bookType];
  if (!cfg) throw new GenerationInputError(`${bookType} does not use a puzzle count`);
  return normalizeFiniteInteger(value, { field: "puzzleCount", ...cfg });
}

export function normalizeBundleTypes(value: unknown): PipelineBookType[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw new GenerationInputError("types must be an array");
  const types: PipelineBookType[] = [];
  for (const valueType of value) {
    if (typeof valueType !== "string" || !PUZZLE_BOOK_TYPES.includes(valueType as PipelineBookType)) {
      throw new GenerationInputError("types contains an unsupported book type");
    }
    if (!types.includes(valueType as PipelineBookType)) types.push(valueType as PipelineBookType);
  }
  if (types.length < 2 || types.length > 4) {
    throw new GenerationInputError("types must contain 2 to 4 unique book types");
  }
  return types;
}