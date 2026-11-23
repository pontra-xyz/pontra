import { isAddress } from "@/config/brand";

/*
 * Pontra's own contract on Robinhood Chain (chain 4663), deployed 23 Nov 2026 and source-verified on Blockscout.
 * Check it yourself: `npm run verify-deployment -- --ledger 0x20d145e1b10642b6ea72137347e0e5c717bbeb3b
 *   --ledger-tx 0x9fc5a068925eaec0d4ddebb4b2df0e902d0e3723069026f197893d94a3f856b5` prints MATCH.
 *   ledger  PontraCapLedger (+ internal library PontraTransferRules): per-company records of share classes, holder positions
 *           with vesting, transfer rules and first-refusal notices; checkTransfer() returns a reason bitmask; append-only
 *           change log with document hashes. Not a token, nothing transferable, no funds, no fee, no upgrade.
 */
const DEPLOYED = {
  ledger: "0x20d145e1b10642b6ea72137347e0e5c717bbeb3b",
  /** Block of the deployment transaction. */
  block: 121274081,
  /** Deployment transaction. */
  tx: "0x9fc5a068925eaec0d4ddebb4b2df0e902d0e3723069026f197893d94a3f856b5",
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
