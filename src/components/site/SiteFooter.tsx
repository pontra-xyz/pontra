import Link from "next/link";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { CaBox } from "@/components/site/CaCopy";
import { Wordmark } from "@/components/site/Mark";
import { GithubIcon, XIcon } from "@/components/site/Icons";
import { Lines } from "@/components/site/Reveal";

/* As the UI reference: a black footer with a 50 px statement on the left, link columns, round icons and one small legal line. */
export function SiteFooter() {
  return (
    <footer className="ftr is-dark" data-testid="footer">
      <div className="wrap grid gap-12 pt-14 pb-6 md:grid-cols-[1.25fr_1fr] md:pt-32">
        <div>
          <Link href="/" aria-label="Pontra home">
            <Wordmark size={34} dark />
          </Link>
          <Lines as="p" className="mt-10 max-w-[620px] text-[clamp(28px,3.5vw,50px)] leading-[1] font-semibold tracking-[-0.035em]" lines={["Clearly managed", "before anything moves"]} />
          <p className="body-sm mt-7 max-w-[420px] text-white/70">{BRAND.tagline} Every Pontra feature is a proposal; the prototype on this site runs on sample data and on the chain&apos;s live clock.</p>
          <div className="mt-8 max-w-[460px]">
            <CaBox testid="footer-ca" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[16px] leading-[40px] font-medium">
          <nav aria-label="Product" className="grid content-start">
            <Link href="/workspace">Workspace</Link>
            <Link href="/vesting">Vesting</Link>
            <Link href="/transfer">Transfer check</Link>
            <Link href="/ledger">Ledger</Link>
          </nav>
          <nav aria-label="About" className="grid content-start">
            <Link href="/network">Network</Link>
            <Link href="/method">Method</Link>
            <Link href="/method#faq">Questions</Link>
            <Link href="/token">{BRAND.symbol}</Link>
          </nav>
        </div>
      </div>
      <div className="wrap flex flex-wrap items-center gap-4 pb-6">
        <a className="rq-iconbtn border-white/20" href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`X ${BRAND.xHandle}`}>
          <XIcon size={14} />
        </a>
        {hasGithub ? (
          <a className="rq-iconbtn border-white/20" href={BRAND.github} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} source code on GitHub`}>
            <GithubIcon size={15} />
          </a>
        ) : null}
        <a className="text-[12px] text-white/60 underline-offset-2 hover:underline" href={CHAIN.explorer} target="_blank" rel="noreferrer">
          {CHAIN.name} explorer
        </a>
      </div>
      <p className="wrap pb-8 text-[12px] leading-[18px] text-[#8a8a8a]">
        © 2026 {BRAND.name} · a proposal for {CHAIN.name} (chain {CHAIN.id}), gas in {CHAIN.nativeSymbol} · not affiliated with Robinhood or any company named in examples · records here are
        not proof of ownership of any company&apos;s shares · {BRAND.symbol} is not a share of anything · not legal or financial advice
      </p>
    </footer>
  );
}
