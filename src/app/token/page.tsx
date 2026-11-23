import Link from "next/link";
import { CaBox } from "@/components/site/CaCopy";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.symbol} token | ${BRAND.name}`,
  description: `${BRAND.symbol} on ${BRAND.chainName}: contract address${TOKEN.isLive ? "" : " (published at launch)"}, the planned service use, and what it is not: not proof of ownership of any company's shares.`,
});

export default function TokenPage() {
  return (
    <>
      <PageHead eyebrow="Token" title={`${BRAND.symbol}, not a share.`}>
        <p>
          {BRAND.tokenName} ({BRAND.symbol}) is planned for {CHAIN.name} as a service token. The workspace, vesting and transfer check run without it today, and they will keep running without it.
        </p>
      </PageHead>
      <div className="wrap grid grid-cols-1 gap-6 pb-24 lg:grid-cols-2">
        <section className="card" data-testid="token-ca">
          <h2 className="h3">Contract address</h2>
          <p className="mt-3 text-[15px] text-[var(--muted)]">
            {TOKEN.isLive
              ? `The only ${BRAND.symbol} contract on ${CHAIN.name}. Check it here before you trade; tokens with the same name can exist anywhere.`
              : `Not launched yet. The address is published here and on X ${BRAND.xHandle} at launch; any address shared before that is not ours.`}
          </p>
          <CaBox testid="ca-token" className="mt-6 w-full" />
          <p className="mt-4 text-[13px] text-[var(--muted)]">
            Network: {CHAIN.name} (chain {CHAIN.id}), gas paid in {CHAIN.nativeSymbol}. {TOKEN.isLive ? "" : "Launchpad: TBA. "}We never send direct messages first.
          </p>
        </section>
        <section className="card" id="status">
          <h2 className="h3 flex flex-wrap items-center gap-3">
            Planned use <StatusBadge status="Concept" />
          </h2>
          <ul className="mt-4 grid list-disc gap-3 pl-5 text-[15px]">
            <li>Paying for reporting (scheduled cap-table reports) and for the transfer-check API, once those services exist. Neither is built yet.</li>
            <li>It is not designed as proof of ownership of any company&apos;s shares, and holding it gives no claim on any company, record, fee or payment.</li>
            <li>The first version runs without the token. Launching it does not create the services.</li>
          </ul>
          <p className="mt-6 text-[13px] text-[var(--muted)]">No yield, no revenue share, no price promise.</p>
          <Link href="/transfer" className="cta cta-sm mt-6">
            <span className="u">Check a transfer without it</span> →
          </Link>
        </section>
      </div>
    </>
  );
}
