import { LedgerApp } from "@/components/app/LedgerApp";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/ledger",
  title: "PontraCapLedger on Robinhood Chain | Pontra",
  description: "A record-only contract for cap tables: classes, grants with vesting, transfer rules and first-refusal notices, an on-chain transfer check and an append-only change log. Not a token, no funds.",
});

export default function LedgerPage() {
  return (
    <>
      <PageHead eyebrow="Ledger" title="A record anyone can check.">
        <p>
          PontraCapLedger keeps a company&apos;s records on Robinhood Chain when the company chooses to: who holds what, the vesting, the rules, and a log of every change with the hash of its document. It is not a token and holds no funds. <StatusBadge status="Prototype" />
        </p>
      </PageHead>
      <LedgerApp />
    </>
  );
}
