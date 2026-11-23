/* Questions for the home carousel and /method#faq (also emitted as FAQPage JSON-LD on /method). */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "What does Pontra do today?",
    a: "It runs a cap table workspace in your browser: holders, share classes, grants with vesting, and transfer rules. The transfer check answers allowed or not and lists every rule that fails. Everything starts from an invented sample company.",
  },
  {
    q: "Is a record in Pontra proof that someone owns shares?",
    a: "No. Ownership of a private company's shares comes from the company's own legal documents and registers. Pontra and PontraCapLedger hold records a company owner wrote, so people can check them; they are not a share register in law and not a token.",
  },
  {
    q: "Is the cap table on chain?",
    a: "Not today. Real cap tables are private and nobody has put them on Robinhood Chain. PontraCapLedger is written and tested so a company can record one if it chooses; until the owner deploys it, the ledger page shows what it will do and the workspace stays in your browser.",
  },
  {
    q: "Why does a transfer fail more than once?",
    a: "Because several rules can fail together: a lockup can still be running while the recipient is also not accredited. Pontra checks every rule and returns each failing one with its reason, the same way the contract returns a bitmask with one bit per rule.",
  },
  {
    q: "Do I need a wallet or $PONTRA?",
    a: "No. The workspace, vesting and transfer check work without either. A wallet is only needed to write to the contract once it is deployed. $PONTRA is a planned service token for reporting and the transfer-check API, and it is not proof of ownership of any shares.",
  },
  {
    q: "How is a month counted in vesting?",
    a: "As a fixed step of 1/12 of an average year (2,629,746 seconds, about 30.44 days), in the site and in the contract alike. Agreements that count calendar months can differ by a few days; the method page shows the exact formula.",
  },
  {
    q: "Is this legal or investment advice?",
    a: "No. Pontra checks the rules you record against the numbers you record. It does not know rules that were never written down, it does not verify identities, and it does not say whether a transfer is lawful.",
  },
  {
    q: "What does it cost on chain?",
    a: "Reading and checking are free calls. Writing a change to PontraCapLedger costs gas in ETH on Robinhood Chain; the method page lists measured gas for each action. The contract holds no funds and charges no fee.",
  },
];
