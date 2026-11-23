import { NetworkView } from "@/components/app/NetworkView";
import { PageHead, LiveBadge } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/network",
  title: "Robinhood Chain, live | Pontra",
  description: "The live Robinhood Chain facts Pontra uses: latest block and its clock (vesting and transfer checks run on it), block time, gas price, base fee, ETH/USD from Chainlink and the ledger's status.",
});

export default function NetworkPage() {
  return (
    <>
      <PageHead eyebrow="Network" title="What is live, and what is not.">
        <p>
          The chain clock, fees and blocks below are read from Robinhood Chain as you look. Cap tables are not: no company has put one on chain, so every holder number on this site is sample data until a company publishes to the ledger. <LiveBadge />
        </p>
      </PageHead>
      <NetworkView />
    </>
  );
}
