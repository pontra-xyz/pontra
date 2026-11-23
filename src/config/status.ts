import { ledgerLive } from "@/config/contracts";

/*
 * Status of every feature, shown on the site next to the feature. "Prototype" = runs now and can be checked; "Concept" =
 * proposed, not built. The owner's Product Knowledge calls every Pontra feature a proposal ("usulan"); the prototype is what
 * the proposal would look like, running on sample data. Numbers that do not come from a live source carry a "Sample data" badge.
 */
export type Status = "Prototype" | "Concept";

export const FEATURES: { key: string; href: string; name: string; status: Status; what: string; limit: string }[] = [
  {
    key: "workspace",
    href: "/workspace",
    name: "Company workspace",
    status: "Prototype",
    what: "Holders, share classes and grants in one table: who holds how many shares of which class, how much has vested today, and each holder's share of the total.",
    limit: "Kept in your browser only (export and import as a file). It starts with an invented sample company. Nothing is uploaded.",
  },
  {
    key: "vesting",
    href: "/vesting",
    name: "Vesting schedules",
    status: "Prototype",
    what: "Cliff, linear and monthly schedules with the exact vested amount on any date and the curve over time, using the same integer math as the contract.",
    limit: "A month is a fixed step of 1/12 of an average year (30.44 days), not a calendar month. Real agreements may count differently.",
  },
  {
    key: "transfer",
    href: "/transfer",
    name: "Transfer check",
    status: "Prototype",
    what: "Pick seller, recipient, class, amount and date: allowed or not, and every rule that fails with its reason (lockup, first refusal, accreditation, allowlist, holder cap, vesting, minimum, frozen).",
    limit: "It checks the rules recorded in the workspace. It is not legal advice and it does not know rules that were never written down.",
  },
  {
    key: "ledger",
    href: "/ledger",
    name: "PontraCapLedger on chain",
    status: "Prototype",
    what: "A record-only contract: a company owner records classes, grants, rules and first-refusal notices; anyone reads vesting and checks a transfer on chain; every change is logged with a document hash.",
    limit: ledgerLive()
      ? "Live on Robinhood Chain. A record written by a company owner, not proof of ownership of any shares."
      : "Written and tested, not deployed yet: the ledger page explains what it will do and runs nothing on chain until the owner deploys it.",
  },
  { key: "reports", href: "/token", name: "Reporting and transfer-check API", status: "Concept", what: "Scheduled cap-table reports and a transfer-check API for other apps.", limit: "Not built. This is what $PONTRA is planned to pay for." },
  { key: "token", href: "/token", name: "$PONTRA", status: "Concept", what: "A planned service token for reporting and transfer-check API access.", limit: "Not needed for anything on this site, and not proof of ownership of any company's shares." },
];

export const contractStatus = () => ({ ledger: ledgerLive() });
