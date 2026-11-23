/* Fades a block up once it scrolls into view (driven by components/site/Motion.tsx). Without JavaScript or with reduced motion it is simply visible. */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div", testid }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" | "article"; testid?: string }) {
  const Any = Tag as React.ElementType;
  return (
    <Any data-reveal="" data-testid={testid} className={className} style={delay ? ({ "--rd": `${delay}ms` } as React.CSSProperties) : undefined}>
      {children}
    </Any>
  );
}

/** A big title split into masked lines (scroll-scrubbed like the reference). The last line may end in the mint full stop. */
export function Lines({ lines, className = "", as: Tag = "h2", dot = true, grey = [] }: { lines: string[]; className?: string; as?: "h1" | "h2" | "h3" | "p"; dot?: boolean; grey?: number[] }) {
  const Any = Tag as React.ElementType;
  return (
    <Any className={className} data-lines="">
      {lines.map((l, i) => (
        <span className="ln" key={i}>
          <span className={grey.includes(i) ? "grey" : undefined}>
            {l}
            {dot && i === lines.length - 1 ? <span className="dot">.</span> : null}
          </span>
        </span>
      ))}
    </Any>
  );
}
