/*
 * Pontra's mark: a black "p" stem with a mint full stop (public/brand/mark.webp, made by referensi/tools/make-assets.mjs;
 * referensi/tools/apply-owner-assets.mjs swaps in the owner's files later).
 */
export function MarkGlyph({ size = 22 }: { size?: number }) {
  return <img src="/brand/mark.webp" alt="" width={size} height={size} className="block shrink-0" />;
}

/** Wordmark like the reference's logotype: a mint slash, then the name set tight and bold. */
export function Wordmark({ size = 30, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-baseline leading-none font-semibold tracking-[-0.06em]" style={{ fontSize: size }}>
      <span className="text-accent" aria-hidden="true" style={{ marginRight: "0.04em" }}>
        /
      </span>
      <span className={dark ? "text-white" : "text-black"}>pontra</span>
    </span>
  );
}
