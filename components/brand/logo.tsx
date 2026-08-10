interface LogoProps {
  /** Height/util classes for the image (e.g. "h-9"). Width stays auto. */
  className?: string;
  /** Kept for API compatibility with existing call sites; not used by the PNG. */
  variant?: "dark" | "light";
  showWordmark?: boolean;
}

/**
 * KDP Profit Machine brand logo.
 *
 * Renders the uploaded PNG at /public/logo.png. Height is driven by the caller's
 * `className` (e.g. "h-9"); width stays auto to preserve the aspect ratio.
 */
export function Logo({ className = "" }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="KDP Profit Machine"
      className={`w-auto object-contain ${className}`}
    />
  );
}
