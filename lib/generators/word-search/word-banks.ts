/**
 * Theme-based word banks.
 *
 * Curated, deterministic word lists — no AI image generation, no external calls.
 * Themes are matched loosely (lowercased, with aliases). Unknown themes fall
 * back to the "general" bank so generation never fails.
 *
 * (OpenRouter can supply arbitrary-theme word lists in a later phase; this keeps
 * the Word Search slice fully self-contained and reproducible.)
 */

export const WORD_BANKS: Record<string, string[]> = {
  animals: [
    "TIGER", "ELEPHANT", "GIRAFFE", "ZEBRA", "MONKEY", "LION", "PANDA", "KOALA",
    "RABBIT", "HORSE", "DOLPHIN", "PENGUIN", "KANGAROO", "LEOPARD", "OTTER",
    "BADGER", "FALCON", "BISON", "CHEETAH", "WALRUS",
  ],
  dinosaurs: [
    "TYRANNOSAURUS", "TRICERATOPS", "STEGOSAURUS", "VELOCIRAPTOR", "BRACHIOSAURUS",
    "PTERODACTYL", "ANKYLOSAURUS", "DIPLODOCUS", "ALLOSAURUS", "SPINOSAURUS",
    "RAPTOR", "FOSSIL", "JURASSIC", "PALEONTOLOGY", "EXTINCT", "PREDATOR",
    "HERBIVORE", "CARNIVORE", "REPTILE", "PREHISTORIC",
  ],
  space: [
    "GALAXY", "PLANET", "COMET", "ASTEROID", "NEBULA", "ROCKET", "ORBIT",
    "SATURN", "JUPITER", "MERCURY", "NEPTUNE", "GRAVITY", "METEOR", "COSMOS",
    "ASTRONAUT", "TELESCOPE", "ECLIPSE", "STARLIGHT", "SUPERNOVA", "UNIVERSE",
  ],
  ocean: [
    "DOLPHIN", "SHARK", "WHALE", "CORAL", "OCTOPUS", "SEAWEED", "STARFISH",
    "JELLYFISH", "LOBSTER", "SEAHORSE", "TURTLE", "PLANKTON", "CURRENT", "REEF",
    "ANCHOR", "HARBOR", "TIDE", "WAVE", "LAGOON", "MARINE",
  ],
  food: [
    "PIZZA", "BURGER", "PASTA", "SALAD", "CHEESE", "TOMATO", "PEPPER", "ONION",
    "GARLIC", "POTATO", "CARROT", "BROCCOLI", "PANCAKE", "WAFFLE", "COOKIE",
    "MUFFIN", "PRETZEL", "NOODLE", "PUDDING", "OMELET",
  ],
  christmas: [
    "SANTA", "REINDEER", "SLEIGH", "PRESENT", "STOCKING", "MISTLETOE", "HOLLY",
    "SNOWMAN", "ORNAMENT", "GARLAND", "CANDLE", "WREATH", "TINSEL", "CHIMNEY",
    "CAROL", "FROSTY", "BLITZEN", "RUDOLPH", "WINTER", "JOYFUL",
  ],
  halloween: [
    "PUMPKIN", "GHOST", "WITCH", "SPIDER", "SKELETON", "VAMPIRE", "ZOMBIE",
    "GOBLIN", "CAULDRON", "COSTUME", "CANDY", "HAUNTED", "SPOOKY", "BROOMSTICK",
    "MONSTER", "MIDNIGHT", "SHADOW", "LANTERN", "CREEPY", "MUMMY",
  ],
  sports: [
    "SOCCER", "TENNIS", "HOCKEY", "BASEBALL", "CRICKET", "RUGBY", "BOXING",
    "CYCLING", "SWIMMING", "RUNNING", "ARCHERY", "SKATING", "SURFING", "GOLFING",
    "VOLLEYBALL", "MARATHON", "STADIUM", "REFEREE", "TROPHY", "CHAMPION",
  ],
  nature: [
    "FOREST", "RIVER", "MOUNTAIN", "VALLEY", "MEADOW", "CANYON", "GLACIER",
    "DESERT", "JUNGLE", "WATERFALL", "PRAIRIE", "ISLAND", "VOLCANO", "BOULDER",
    "BLOSSOM", "SUNSET", "RAINBOW", "THUNDER", "BREEZE", "HARVEST",
  ],
  general: [
    "PUZZLE", "LETTER", "SEARCH", "HIDDEN", "ANSWER", "CIRCLE", "PENCIL",
    "WINNER", "CLEVER", "FOCUS", "MEMORY", "RIDDLE", "SECRET", "WISDOM",
    "BRIGHT", "GARDEN", "TRAVEL", "FRIEND", "SIMPLE", "GOLDEN",
  ],
};

/** Aliases → canonical bank key. */
const ALIASES: Record<string, string> = {
  animal: "animals",
  wildlife: "animals",
  zoo: "animals",
  dinosaur: "dinosaurs",
  dino: "dinosaurs",
  outerspace: "space",
  astronomy: "space",
  galaxy: "space",
  sea: "ocean",
  marine: "ocean",
  underwater: "ocean",
  foods: "food",
  cooking: "food",
  xmas: "christmas",
  holiday: "christmas",
  spooky: "halloween",
  sport: "sports",
  outdoors: "nature",
};

export interface ResolvedBank {
  theme: string; // canonical, display-cased
  words: string[];
}

/** Resolve a free-text theme to a word bank, falling back to "general". */
export function resolveBank(theme: string): ResolvedBank {
  const norm = theme.trim().toLowerCase().replace(/[^a-z]/g, "");
  const key =
    (WORD_BANKS[norm] ? norm : undefined) ??
    ALIASES[norm] ??
    "general";
  const display = theme.trim() || key;
  return {
    theme: display.charAt(0).toUpperCase() + display.slice(1),
    words: WORD_BANKS[key],
  };
}

/** True when we have a dedicated bank (not the general fallback). */
export function hasDedicatedBank(theme: string): boolean {
  const norm = theme.trim().toLowerCase().replace(/[^a-z]/g, "");
  return Boolean(WORD_BANKS[norm] || ALIASES[norm]);
}
