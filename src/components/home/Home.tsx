import Link from "next/link";
import { FEATURES } from "@/config/status";
import { REASON, REASON_TEXT, type ReasonKey } from "@/lib/cap/rules";
import { FAQ } from "@/lib/faq";
import { ArrowRight, ArrowUpRight } from "@/components/site/Icons";
import { Lines, Reveal } from "@/components/site/Reveal";
import { MarkGlyph } from "@/components/site/Mark";
import { SampleBadge, StatusBadge } from "@/components/site/PageHead";
import { LiveFigures, CapPreview } from "@/components/home/LiveBits";
import { Questions } from "@/components/home/Questions";

/*
 * Home in the UI reference's order (referensi/recon-ui/NOTES.txt): giant centred title + lead + underlined action, caption and
 * a running row; a wide picture card; a second giant title over a faint line grid with a floating preview and a running row of
 * figures; a third title with a running row of counted items; the black product grid; the black method band; the black notes;
 * the questions carousel on light grey; the closing title with two panels; the black footer.
 */

const cta = (href: string, label: string, testid?: string, small = false) => (
  <Link href={href} className={`cta ${small ? "cta-sm" : ""}`} data-testid={testid}>
    <span className="u">{label}</span>
    <ArrowRight size={small ? 14 : 16} />
  </Link>
);

const WORDS = ["Holders", "Share classes", "Vesting", "Cliffs", "Lockups", "First refusal", "Accredited", "Allowlist", "Holder cap", "Change log"];

export function Hero() {
  return (
    <section className="hero-in relative" data-testid="hero">
      <div className="wrap flex min-h-[100svh] flex-col pt-[120px] md:pt-[150px]">
        <div className="fade mx-auto mb-7 md:mb-9" style={{ "--i": 0 } as React.CSSProperties}>
          <MarkGlyph size={56} />
        </div>
        <h1 className="mx-auto text-center text-[clamp(50px,10.6vw,152px)] leading-[0.84] font-medium tracking-[-0.045em]">
          <span className="ln">
            <span style={{ "--i": 0 } as React.CSSProperties}>Private equity,</span>
          </span>
          <span className="ln">
            <span style={{ "--i": 1 } as React.CSSProperties}>
              clearly managed<span className="dot pop">.</span>
            </span>
          </span>
        </h1>
        <p className="body-md fade mx-auto mt-12 max-w-[670px] text-center md:mt-16" style={{ "--i": 0 } as React.CSSProperties}>
          Cap table &amp; transfer tools planned for Robinhood Chain. See who holds how many shares, when they vest, and whether a transfer may go ahead, with every rule that
          stops it named.
        </p>
        <div className="fade mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3" style={{ "--i": 1 } as React.CSSProperties}>
          {cta("/workspace", "Open the workspace", "hero-cta")}
        </div>
        <p className="fade mx-auto mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-[13px] text-[var(--muted)]" style={{ "--i": 2 } as React.CSSProperties}>
          <StatusBadge status="Prototype" /> runs on an invented sample company · no wallet, no token needed
        </p>
        <div className="mt-auto grid items-center gap-5 pt-14 pb-8 md:grid-cols-[260px_1fr] md:gap-10">
          <p className="body-sm slash fade max-w-[220px]" style={{ "--i": 3 } as React.CSSProperties}>
            What one workspace keeps in order.
          </p>
          <div className="marquee fade" style={{ "--i": 4, "--mq": "46s" } as React.CSSProperties} aria-label="What a workspace records">
            <div className="marquee-track">
              {[0, 1].map((k) => (
                <ul key={k} className="flex items-center gap-14 pr-14" aria-hidden={k === 1 ? true : undefined}>
                  {WORDS.map((w) => (
                    <li key={w} className="text-[22px] font-bold tracking-[-0.04em] whitespace-nowrap text-black/80">
                      {w}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WideCard() {
  return (
    <section className="wrap" aria-label="Sample cap table">
      <div className="media relative aspect-[1300/720] max-h-[720px] w-full" data-open="" data-qa-bleed="">
        <img src="/art/ledger-wide.webp" alt="A ring chart of a sample company's shares split between founders, investors and employees." width={1600} height={900} />
        <div className="absolute right-3 bottom-3 flex gap-2 md:right-5 md:bottom-5">
          <span className="chip">Sample company</span>
          <span className="chip">Prototype</span>
        </div>
      </div>
    </section>
  );
}

export function KnowWho() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-44 md:pb-24" data-testid="know-who" data-qa-bleed="">
      <div className="grid-lines pointer-events-none absolute inset-x-0 top-10 h-[640px]" aria-hidden="true" />
      <div className="wrap relative">
        <div className="relative mx-auto w-fit">
          <Lines className="d-xl text-center" lines={["Know who", "owns what"]} />
          <CapPreview />
        </div>
        <Reveal className="mx-auto mt-12 max-w-[640px] text-center">
          <p className="body-md">
            One table for holders, share classes and grants: how many shares each holder has, how much has vested today, and each holder&apos;s share of the total. It
            stays in your browser. Start from the sample company or your own numbers, and export the file whenever you like.
          </p>
          <div className="mt-8 flex justify-center">{cta("/workspace", "See the cap table")}</div>
        </Reveal>
        <div className="mt-20 grid items-center gap-5 md:mt-28 md:grid-cols-[260px_1fr] md:gap-10">
          <p className="body-sm slash max-w-[230px]">
            Live from Robinhood Chain while you read. <span className="muted">Each figure links to its source.</span>
          </p>
          <LiveFigures />
        </div>
      </div>
    </section>
  );
}

const RULES = (Object.keys(REASON) as ReasonKey[]).map((k, i) => ({ k, bit: i, title: REASON_TEXT[k].title }));

export function EveryRule() {
  return (
    <section className="pt-20 pb-24 md:pt-32 md:pb-36" data-testid="every-rule">
      <div className="wrap">
        <Lines className="d-xl text-center" lines={["Every rule", "named"]} />
        <Reveal className="mx-auto mt-12 max-w-[640px] text-center">
          <p className="body-md">
            A transfer check never stops at the first problem. Lockups, first refusal, accreditation, the allowlist, the holder cap, unvested shares, the minimum size and a
            freeze are all tested, and each failing rule comes back with its own reason.
          </p>
          <div className="mt-8 flex justify-center">{cta("/transfer", "Check a transfer")}</div>
        </Reveal>
        <div className="mt-20 grid items-center gap-5 md:mt-28 md:grid-cols-[260px_1fr] md:gap-10">
          <p className="body-sm slash max-w-[230px]">
            <span data-count={RULES.length}>{RULES.length}</span> rules, one bit each, the same in the site and the contract.
          </p>
          <div className="marquee" style={{ "--mq": "60s" } as React.CSSProperties}>
            <div className="marquee-track">
              {[0, 1].map((k) => (
                <ul key={k} className="flex items-center gap-12 pr-12" aria-hidden={k === 1 ? true : undefined}>
                  {RULES.map((r) => (
                    <li key={r.k} className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-[22px] font-medium tracking-[-0.03em]">{r.title}</span>
                      <span className="mono text-[13px] text-[var(--muted)]">({r.bit})</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const ART: Record<string, string> = { workspace: "workspace", vesting: "vesting", transfer: "transfer", ledger: "ledger", reports: "reports", token: "token" };

export function Product() {
  return (
    <section className="is-dark pt-24 pb-24 md:pt-40 md:pb-36" data-testid="product">
      <div className="wrap">
        <h2 className="d-lg mx-auto max-w-[1024px] text-center" data-lines="">
          <span className="ln">
            <span>
              Product<span className="dot">.</span> <span className="grey">what runs</span>
            </span>
          </span>
          <span className="ln">
            <span className="grey">today, and what is planned.</span>
          </span>
        </h2>
        <ul className="mt-16 grid grid-cols-1 gap-x-6 gap-y-14 md:mt-24 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.key} delay={(i % 2) * 90} className={i % 2 === 1 ? "md:mt-28" : ""}>
              <Link href={f.href} className="work-card block" data-testid={`product-${f.key}`}>
                <div className="media aspect-[1000/760]">
                  <img src={`/art/${ART[f.key]}.webp`} alt="" width={1000} height={760} loading="lazy" />
                  <span className="chip absolute right-3 bottom-3">{f.status === "Prototype" ? "Runs now" : "Planned"}</span>
                </div>
                <p className="mt-5 flex items-center gap-2 text-[16px] leading-[22px] uppercase">
                  <span className="font-bold">{f.name}</span>
                  <span className="text-white/50">({f.status})</span>
                  <ArrowUpRight size={14} />
                </p>
                <p className="mt-2 max-w-[560px] text-[16px] leading-[22px] text-white/75">{f.what}</p>
                <p className="mt-2 max-w-[560px] text-[13px] leading-[19px] text-white/45">{f.limit}</p>
              </Link>
            </Reveal>
          ))}
        </ul>
        <div className="mt-16 flex justify-center">{cta("/method", "See the method")}</div>
      </div>
    </section>
  );
}

export function Method() {
  return (
    <section className="is-dark relative overflow-hidden" data-testid="method-band">
      <img src="/art/slash.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" width={1600} height={900} loading="lazy" />
      <div className="wrap relative flex min-h-[86vh] flex-col items-center justify-center py-28 text-center">
        <Lines className="d-xl" lines={["Rules,", "written down"]} />
        <Reveal className="mt-10 max-w-[640px]">
          <p className="body-md text-white/85">
            Each rule is a line in the company&apos;s own documents first. Pontra writes them down once, checks every transfer against all of them, and keeps every change in
            a log with the document it came from. On chain, the same check runs in a contract anyone can call.
          </p>
          <div className="mt-8 flex justify-center">{cta("/method", "Discover the method")}</div>
        </Reveal>
      </div>
    </section>
  );
}

const NOTES = [
  { img: "note-1", tag: "Limits", title: "Cap tables are not on chain.", href: "/method#onchain" },
  { img: "note-2", tag: "Limits", title: "A record is not ownership.", href: "/method#ownership" },
  { img: "note-3", tag: "Data", title: "Sample data is labelled as sample.", href: "/method#sample" },
  { img: "note-4", tag: "Rules", title: "A check is not legal advice.", href: "/method#advice" },
];

export function Notes() {
  return (
    <section className="is-dark pt-20 pb-28 md:pt-24 md:pb-40" data-testid="notes">
      <div className="wrap">
        <h2 className="d-lg mx-auto max-w-[1024px] text-center" data-lines="">
          <span className="ln">
            <span>
              Notes<span className="dot">.</span> <span className="grey">Limits</span>
            </span>
          </span>
          <span className="ln">
            <span className="grey">stated plainly.</span>
          </span>
        </h2>
        <ul className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-20 lg:grid-cols-4 lg:gap-x-6">
          {NOTES.map((n, i) => (
            <Reveal as="li" key={n.img} delay={i * 80}>
              <Link href={n.href} className="note-card block">
                <div className="media aspect-[3/4]">
                  <img src={`/art/${n.img}.webp`} alt="" width={600} height={800} loading="lazy" />
                  <span className="chip absolute bottom-3 left-3">{n.tag}</span>
                </div>
                <p className="mt-4 text-[clamp(16px,1.4vw,20px)] leading-[1.25] tracking-[-0.02em]">{n.title}</p>
              </Link>
            </Reveal>
          ))}
        </ul>
        <div className="mt-16 flex justify-center">{cta("/method", "Read every limit")}</div>
      </div>
    </section>
  );
}

export function QuestionsBand() {
  return (
    <section className="bg-[var(--bg-2)] pt-24 pb-24 md:pt-36 md:pb-32" data-testid="questions">
      <div className="wrap">
        <h2 className="d-lg mx-auto max-w-[1024px] text-center" data-lines="">
          <span className="ln">
            <span>
              Questions<span className="dot">.</span> <span className="grey">From</span>
            </span>
          </span>
          <span className="ln">
            <span className="grey">careful holders.</span>
          </span>
        </h2>
        <Questions items={FAQ.slice(0, 6)} />
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="overflow-hidden pt-24 pb-24 md:pt-36 md:pb-36" data-testid="closing">
      <div className="wrap">
        <Lines className="d-xl text-center" lines={["Clearly", "managed"]} />
        <div className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-2 md:gap-6">
          <Reveal className="media aspect-[3/2]">
            <img src="/art/closing-1.webp" alt="" width={1200} height={800} loading="lazy" />
            <span className="chip absolute right-3 bottom-3">Change log</span>
          </Reveal>
          <Reveal className="media aspect-[3/2]" delay={90}>
            <img src="/art/closing-2.webp" alt="" width={1200} height={800} loading="lazy" />
            <span className="chip absolute right-3 bottom-3">Cap table</span>
          </Reveal>
        </div>
        <Reveal className="mx-auto mt-14 max-w-[520px] text-center">
          <p className="body-md">
            Everything here is a proposal for Robinhood Chain. The prototype runs today on sample data, and PontraCapLedger is live on Robinhood Chain with its source verified.
          </p>
          <p className="mt-4 flex justify-center">
            <SampleBadge label="Sample company, invented" />
          </p>
          <div className="mt-8 flex justify-center">{cta("/ledger", "Explore the ledger")}</div>
        </Reveal>
      </div>
    </section>
  );
}
