/*
 * Pontra's mark: the owner's two-colour "P" (black leaves + mint triangle and leaf), built by referensi/tools/apply-owner-assets.mjs.
 * mark.webp is for light backgrounds; mark-light.webp turns the black leaves white for black sections. Plain <img> (small icons).
 */
export function MarkGlyph({ size = 22, dark = false }: { size?: number; dark?: boolean }) {
  return <img src={dark ? "/brand/mark-light.webp" : "/brand/mark.webp"} alt="" width={size} height={size} className="block shrink-0" />;
}

/** Wordmark: the mark, then the name set tight and bold. Both mark variants are stacked so the header can cross-fade on dark sections. */
export function Wordmark({ size = 30, dark = false }: { size?: number; dark?: boolean }) {
  const m = Math.round(size * 0.86);
  return (
    <span className="inline-flex items-center leading-none font-semibold tracking-[-0.06em]" style={{ fontSize: size, gap: "0.24em" }}>
      <span className="relative block shrink-0" aria-hidden="true" style={{ width: m, height: m }}>
        <img src="/brand/mark.webp" alt="" width={m} height={m} className="absolute inset-0 block transition-opacity duration-300" style={{ opacity: dark ? 0 : 1 }} />
        <img src="/brand/mark-light.webp" alt="" width={m} height={m} className="absolute inset-0 block transition-opacity duration-300" style={{ opacity: dark ? 1 : 0 }} />
      </span>
      <span className={`transition-colors duration-300 ${dark ? "text-white" : "text-black"}`} style={{ transform: "translateY(-0.04em)" }}>
        pontra
      </span>
    </span>
  );
}
