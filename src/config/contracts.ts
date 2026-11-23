import { isAddress } from "@/config/brand";

/*
 * Pontra's own contract on Robinhood Chain (chain 4663). NOT DEPLOYED YET: the owner deploys it from /deploy (localhost only),
 * then writes the address and block here, runs `npm run verify-deployment -- --ledger <a> --ledger-tx <tx>` and verifies the
 * source on Blockscout (referensi/explorer kit).
 *   ledger  PontraCapLedger (+ internal library PontraTransferRules): per-company records of share classes, holder positions
 *           with vesting, transfer rules and first-refusal notices; checkTransfer() returns a reason bitmask; append-only
 *           change log with document hashes. Not a token, nothing transferable, no funds, no fee, no upgrade.
 */
const DEPLOYED = {
  ledger: "TBA",
  /** Block of the deployment transaction (0 until deployed). */
  block: 0,
};

/**
 * Local tests only: NEXT_PUBLIC_PONTRA_TEST_CONTRACTS='{"ledger":"0x…","block":1}' at build time points a second build at a
 * contract on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_PONTRA_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.ledger) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;
export const ledgerLive = () => isAddress(CONTRACTS.ledger);
export const CONTRACT_NAME = "PontraCapLedger" as const;
