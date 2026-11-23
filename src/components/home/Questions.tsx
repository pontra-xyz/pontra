"use client";

import { useState } from "react";

/* The reference's quote carousel: one large centred text that swaps (fade + rise), picked by a row of tabs. Here: questions. */
export function Questions({ items }: { items: { q: string; a: string }[] }) {
  const [i, setI] = useState(0);
  const cur = items[i];
  return (
    <div className="mx-auto mt-14 max-w-[820px] text-center md:mt-20">
      <div role="tablist" aria-label="Questions" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        {items.map((it, k) => (
          <button
            key={it.q}
            type="button"
            role="tab"
            aria-selected={k === i}
            onClick={() => setI(k)}
            className={`text-[13px] font-bold uppercase transition-colors ${k === i ? "text-black" : "text-black/35 hover:text-black/70"}`}
            data-testid={`faq-tab-${k}`}
          >
            {String(k + 1).padStart(2, "0")}
          </button>
        ))}
      </div>
      <div key={i} className="swap-in mt-10" role="tabpanel" aria-live="polite">
        <p className="text-[clamp(22px,2.3vw,32px)] leading-[1.2] font-medium tracking-[-0.03em]">{cur.q}</p>
        <p className="body-md mx-auto mt-6 max-w-[640px] text-[var(--muted)]">{cur.a}</p>
      </div>
      <div className="mt-10 flex justify-center gap-3">
        <button type="button" className="rq-iconbtn" aria-label="Previous question" onClick={() => setI((i - 1 + items.length) % items.length)}>
          ←
        </button>
        <button type="button" className="rq-iconbtn" aria-label="Next question" onClick={() => setI((i + 1) % items.length)} data-testid="faq-next">
          →
        </button>
      </div>
    </div>
  );
}
