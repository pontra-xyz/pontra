import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, ledgerLive } from "@/config/contracts";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.slogan} ${BRAND.tagline} A proposal with a working prototype: a cap table workspace (holders, share classes, grants with cliff/linear/monthly vesting), a transfer check that lists every failing rule (lockup, right of first refusal, accredited and allowlisted recipients, holder cap, unvested shares, minimum, freeze), and PontraCapLedger, a record-only contract for ${CHAIN.name} (chain ${CHAIN.id}). Runs on an invented sample company; real cap tables are not on chain. No token needed. Records are not proof of share ownership. Not affiliated with Robinhood.`,
    "",
    `Workspace: ${BRAND.url}/workspace`,
    `Vesting: ${BRAND.url}/vesting`,
    `Transfer check: ${BRAND.url}/transfer`,
    `Live chain facts (JSON): ${BRAND.url}/api/chain`,
    `PontraCapLedger: ${ledgerLive() ? CONTRACTS.ledger : "not deployed yet"}`,
    `Method: ${BRAND.url}/method`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
