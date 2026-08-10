/**
 * Cover V2 visual styles.
 *
 * Eight named presets instead of letting the art director invent a look from
 * scratch. Free-form briefs are more creative but far less repeatable, and for book
 * covers consistency beats novelty — a buyer wants to pick a look and get that look.
 *
 * Each preset constrains the brief and adds a typography direction to the image
 * prompt. The art director still fills in the subject from the title and niche, so
 * two different books in the same style are related but not identical.
 */

export const COVER_V2_STYLES = [
  "clean_modern",
  "dramatic_dark",
  "warm_illustrated",
  "bold_graphic",
  "elegant_serif",
  "nature_organic",
  "playful_colorful",
  "photo_realistic",
] as const;

export type CoverV2Style = (typeof COVER_V2_STYLES)[number];

export interface StylePreset {
  key: CoverV2Style;
  label: string;
  /** One line shown under the label in the picker. */
  blurb: string;
  /** Art direction appended to the brief request and the image prompt. */
  art: string;
  /** Type direction — described in words only, never a font name. */
  type: string;
  /** Palette hint the art director can adapt to the subject. */
  palette: string;
  /**
   * What this look must NOT be. Optional: image models follow negative guidance
   * strongly, and it is what stops one style bleeding into another. Presets without
   * it behave exactly as before, so styles can be enriched one at a time.
   */
  avoid?: string;
  /** Optional rendering/quality keywords, appended near the end of the image prompt. */
  quality?: string;
}

export const STYLE_PRESETS: Record<CoverV2Style, StylePreset> = {
  clean_modern: {
    key: "clean_modern",
    label: "Clean & Modern",
    blurb: "Minimal design with bold typography",
    art:
      "minimal, premium composition with generous negative space and a single simple, " +
      "well-lit focal subject or crisp geometric form, soft studio lighting and gentle shadow, " +
      "a calm uncluttered field for the title",
    type:
      "large bold grotesque sans-serif in tight tracking with plenty of breathing space, " +
      "quietly confident and expensive-looking",
    palette: "restrained — two dominant tones plus one clean accent",
    avoid:
      "no clutter, no busy background, no cartoon or childish style, no gradients that muddy the " +
      "type, no cheap clip-art, no more than one focal object",
    quality:
      "professional minimalist book cover design, sharp clean edges, balanced whitespace, " +
      "high-end editorial feel that reads clearly at thumbnail size",
  },
  dramatic_dark: {
    key: "dramatic_dark",
    label: "Dramatic Dark",
    blurb: "Dark background with vivid accent colours",
    art:
      "cinematic dark scene with one strong directional key light carving the focal subject out " +
      "of deep shadow, moody atmosphere, volumetric haze and rich contrast, a clear darker area " +
      "for the title",
    type:
      "high-contrast display lettering, bright or glowing type standing out sharply against the " +
      "darkness, strong dramatic presence",
    palette: "near-black and deep shadow base lifted by one vivid accent glow",
    avoid:
      "no flat lighting, no bright cheerful daytime look, no cartoon style, no muddy grey wash, " +
      "no empty featureless black frame, no low-contrast text",
    quality:
      "professional cinematic book cover, dramatic lighting, crisp focal detail, atmospheric " +
      "depth that still reads clearly at thumbnail size",
  },
  warm_illustrated: {
    key: "warm_illustrated",
    label: "Warm & Illustrated",
    blurb: "Hand-drawn feel with warm earthy tones",
    art:
      "a hand-illustrated scene with visible brush, gouache or ink texture and gentle organic " +
      "imperfection, soft warm directional light, cosy inviting atmosphere, a clear calm area " +
      "for the title",
    type: "friendly hand-lettered feel, slightly irregular and characterful, warm and approachable",
    palette: "warm earth tones — terracotta, ochre, cream, sage, soft rust",
    avoid:
      "no glossy 3D render, no hard digital vector look, no neon colours, no photographic " +
      "realism, no cold blue tones, no cluttered composition",
    quality:
      "professional illustrated book cover, painterly hand-crafted texture, warm cohesive " +
      "palette, clear focal read at thumbnail size",
  },
  bold_graphic: {
    key: "bold_graphic",
    label: "Bold Graphic",
    blurb: "Strong geometric shapes and vivid colours",
    art:
      "a flat vector poster composition built from large simple geometric shapes and blocks of " +
      "saturated colour, strong silhouette, high contrast, confident modern layout with a clear " +
      "band for the title",
    type: "heavy geometric capitals, tight and blocky, filling its space with impact",
    palette: "two or three highly saturated flat colours in strong contrast",
    avoid:
      "no photographic realism, no soft gradients or blur, no 3D render, no fine detail or " +
      "texture, no muted pastel tones, no clutter",
    quality:
      "professional flat graphic-design book cover, crisp clean vector edges, bold high-contrast " +
      "shapes that pop at thumbnail size",
  },
  elegant_serif: {
    key: "elegant_serif",
    label: "Elegant Serif",
    blurb: "Classic typography with subtle texture",
    art:
      "a restrained, refined composition with subtle paper, linen or fabric texture, soft even " +
      "light and a single understated focal detail, generous quiet space for the title, a " +
      "timeless literary feel",
    type: "classic high-contrast serif with wide letter spacing and a small-caps feel, unhurried and elegant",
    palette: "muted and tonal — ivory, ink, one deep jewel accent",
    avoid:
      "no cartoon or playful style, no bright saturated colours, no busy background, no neon, " +
      "no cheap decorative clip-art, no heavy sans-serif look",
    quality:
      "professional literary book cover, refined typographic balance, subtle premium texture, " +
      "clear title read at thumbnail size",
  },
  nature_organic: {
    key: "nature_organic",
    label: "Nature & Organic",
    blurb: "Botanical and landscape-inspired imagery",
    art:
      "botanical or landscape imagery with soft natural daylight, layered foliage, delicate " +
      "line-and-wash botanical detail or an open sunlit horizon, organic irregular forms, a calm " +
      "airy area for the title",
    type: "clean humanist letterforms with airy spacing, calm and unforced",
    palette: "fresh greens, sky blues, warm sunlit neutrals and soft botanical tones",
    avoid:
      "no harsh artificial neon, no hard geometric tech look, no dark gloomy mood, no 3D " +
      "plastic render, no cluttered busy scene",
    quality:
      "professional botanical/nature book cover, fresh natural light, delicate organic detail, " +
      "clear calm read at thumbnail size",
  },
  playful_colorful: {
    key: "playful_colorful",
    label: "Playful & Colourful",
    blurb: "Fun patterns and bright colours",
    art:
      "a cheerful GROUP of two to four adorable cartoon characters together, big expressive " +
      "eyes and warm smiles, engaged in a fun activity that suits the topic (for a colouring " +
      "book they hold crayons and colour a page), thick clean black outlines and flat " +
      "cel-shaded colour with soft shadows; frame the whole cover with a light playful border " +
      "of stars, flowers, butterflies and confetti; keep the top area clear for a big title, " +
      "and place the subtitle and the author each inside their own rounded ribbon banner",
    type:
      "chunky rounded display capitals with a thick contrasting outline and a subtle upward " +
      "arc, bright multi-colour fill, bouncy and fun, extremely legible",
    palette: "rainbow brights — sunshine yellow, sky blue, grass green, warm orange, candy pink",
    avoid:
      "no photorealism, no 3D render, no dark, muted or desaturated tones, no gritty or grainy " +
      "texture, no horror or scary elements, no realistic anatomy, no cluttered unreadable " +
      "background, no single lonely character on an empty plain background",
    quality:
      "professional children's book cover illustration, crisp vector-clean line work, vibrant " +
      "saturated colour, bold shapes and clear text banners that read at thumbnail size",
  },
  photo_realistic: {
    key: "photo_realistic",
    label: "Photo-Realistic",
    blurb: "Photographic cover image with overlay text",
    art:
      "a photorealistic image with natural depth of field, believable directional lighting and " +
      "fine material detail, sharp focus on the subject with a softly blurred background, " +
      "editorial photography quality, a calm low-detail area for the title",
    type: "clean modern sans-serif set over a calm area of the photograph, high legibility with a subtle shadow or scrim",
    palette: "naturalistic colour drawn from the scene itself",
    avoid:
      "no cartoon, no illustration or painted look, no flat vector shapes, no obvious 3D-render " +
      "plastic feel, no over-saturated unreal colours, no distorted anatomy",
    quality:
      "professional photographic book cover, realistic lighting and texture, crisp focal detail, " +
      "clear title read at thumbnail size",
  },
};

export const DEFAULT_STYLE: CoverV2Style = "clean_modern";

export function isCoverV2Style(value: unknown): value is CoverV2Style {
  return typeof value === "string" && (COVER_V2_STYLES as readonly string[]).includes(value);
}

export function resolveStyle(value: unknown): CoverV2Style {
  return isCoverV2Style(value) ? value : DEFAULT_STYLE;
}

/** Preset list for the picker UI — no internals leaked. */
export function stylePickerOptions(): Array<{ key: CoverV2Style; label: string; blurb: string }> {
  return COVER_V2_STYLES.map((key) => {
    const p = STYLE_PRESETS[key];
    return { key, label: p.label, blurb: p.blurb };
  });
}
