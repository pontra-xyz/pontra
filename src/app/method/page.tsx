import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { CHAIN } from "@/config/brand";
import { FEATURES } from "@/config/status";
import { REASON, REASON_TEXT, MONTH, ROFR_VALIDITY, type ReasonKey } from "@/lib/cap/rules";
import { FAQ } from "@/lib/faq";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/method",
  title: "Method: rules, vesting math and limits | Pontra",
  description: "Every transfer rule Pontra checks and its bit, the vesting formula shared by the site and the contract, what is on chain and what is not, measured gas, and the limits stated plainly.",
});

/** forge gas report, 23 Nov 2026 (contracts/test, median per call; first writes to a slot cost more). */
const GAS: [string, string, string][] = [
  ["Deploy PontraCapLedger", "3,213,664", "once, by the owner of the deployment"],
  ["createCompany", "189,136", "opens a company entry"],
  ["addClass", "134,732", "per share class"],
  ["setRules", "110,686", "lockup, first refusal, holder cap, accreditation, allowlist, minimum"],
  ["setHolder", "154,610", "first time an address is flagged"],
  ["grant", "251,036", "per holder and class"],
  ["fileNotice", "172,237", "first-refusal notice"],
  ["recordTransfer", "257,545", "runs the full check first; reverts with every failing bit"],
  ["cancelUnvested", "77,642", "keeps what vested"],
  ["checkTransfer / vested", "free", "read-only calls"],
];

export default function MethodPage() {
  const keys = Object.keys(REASON) as ReasonKey[];
  return (
    <>
      <JsonLd data={faqLd(FAQ)} />
      <PageHead eyebrow="Method" title="Rules, written down.">
        <p>How Pontra decides allowed or not, how it counts vesting, what lives on {CHAIN.name} and what does not, and where the limits are.</p>
      </PageHead>
      <div className="wrap grid grid-cols-1 gap-16 pb-24">
        <section id="status">
          <h2 className="d-md">What runs, what is planned</h2>
          <div className="tbl-wrap mt-6">
            <table className="tbl stack min-w-[720px]">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Status</th>
                  <th>What it does</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.key}>
                    <td className="font-medium">
                      <Link className="link" href={f.href}>
                        {f.name}
                      </Link>
                    </td>
                    <td data-l="Status">
                      <StatusBadge status={f.status} />
                    </td>
                    <td data-l="What it does" className="text-[14px]">{f.what}</td>
                    <td data-l="Limit" className="text-[14px] text-[var(--muted)]">{f.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[14px] text-[var(--muted)]">Every Pontra feature is a proposal. &quot;Prototype&quot; means it runs here on sample data; it does not mean a company uses it.</p>
        </section>

        <section id="rules">
          <h2 className="d-md">Sixteen rules, one bit each</h2>
          <p className="body-md mt-4 max-w-[760px]">
            A transfer is checked against every rule. The answer is a number whose bits name each failing rule; 0 means every recorded rule passes. The site (src/lib/cap/rules.ts) and the contract (PontraTransferRules.sol) use the same bits, and 1,400 generated cases are checked to give identical answers in both.
          </p>
          <div className="tbl-wrap mt-6">
            <table className="tbl stack" data-testid="rules-table">
              <thead>
                <tr>
                  <th>Bit</th>
                  <th>Rule</th>
                  <th>Fails when</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <tr key={k}>
                    <td data-l="Bit" className="mono">{i}</td>
                    <td className="font-medium whitespace-nowrap">{REASON_TEXT[k].title}</td>
                    <td data-l="Fails when" className="text-[14px]">{REASON_TEXT[k].why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[14px] text-[var(--muted)]">
            Details: unvested is only reported when the amount is within the balance (a larger amount reports &quot;more than the seller holds&quot; instead). The holder cap counts holders with a balance above zero; a seller who sells everything frees their seat. A first-refusal notice must name the same buyer and at least the same amount, and it can be used from the end of the window for {ROFR_VALIDITY / 86400} days; recording the transfer uses it up.
          </p>
        </section>

        <section id="vesting" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="d-md">Vesting math</h2>
            <p className="body-md mt-4">Integer math with floor rounding, identical in the site and the contract. Before start + cliff nothing has vested; after start + length everything has.</p>
          </div>
          <pre className="card mono text-[13px] leading-[20px] break-words whitespace-pre-wrap">{`kind 0  fully vested: vested = total
kind 1  linear:       vested = total * (t - start) / length
kind 2  monthly:      steps  = floor(length / MONTH)
                      vested = total * floor((t - start) / MONTH) / steps
kind 3  cliff only:   vested = total from start + cliff
MONTH = ${MONTH.toLocaleString("en-US")} s (365.2425 days / 12)
available to move = vested + received - moved`}</pre>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div id="onchain" className="card">
            <h2 className="h3">On chain and off chain</h2>
            <ul className="mt-3 grid list-disc gap-2 pl-5 text-[15px]">
              <li>Live from {CHAIN.name}: the block clock that vesting and checks use, fees, recent blocks, Chainlink ETH/USD (see Network).</li>
              <li>Not on chain: real cap tables. No company has published one on {CHAIN.name}; the sample company is invented.</li>
              <li>PontraCapLedger stores addresses, numbers, schedules, rules and hashes. Names, agreements and personal data never go on chain; only the hash of a document reference does.</li>
            </ul>
          </div>
          <div id="ownership" className="card">
            <h2 className="h3">A record is not ownership</h2>
            <p className="mt-3 text-[15px]">
              Shares of a private company belong to whoever the company&apos;s legal documents and register say. A position in PontraCapLedger is a record written by the wallet that keeps the company&apos;s entry. Anyone can open an entry for any name, so check who keeps it. Records are not transferable and are not a token.
            </p>
          </div>
          <div id="sample" className="card">
            <h2 className="h3">Sample data</h2>
            <p className="mt-3 text-[15px]">Every holder number on this site comes from the sample company or from what you type, and carries a &quot;Sample data&quot; label while it is the sample. Its addresses are placeholders that belong to nobody.</p>
          </div>
          <div id="advice" className="card">
            <h2 className="h3">A check is not legal advice</h2>
            <p className="mt-3 text-[15px]">Pontra tests the rules recorded against the numbers recorded. It does not know rules that were never written down, verifies no identities, and does not say whether a transfer is lawful.</p>
          </div>
        </section>

        <section id="gas">
          <h2 className="d-md">Contract and gas</h2>
          <p className="body-md mt-4 max-w-[760px]">
            PontraCapLedger with the internal library PontraTransferRules: per-company owner (two-step hand-over), up to 16 classes, one grant per holder and class, first-refusal notices, a freeze, and an append-only change log. No funds, no payable function, no fee, no upgrade, no admin over other companies. Tests: unit, fuzz, invariant (shares conserved, holder count exact, nothing moves beyond vested + received), parity with the site, and a Robinhood Chain fork test. It has had no outside security review yet.
          </p>
          <div className="tbl-wrap mt-6">
            <table className="tbl stack">
              <thead>
                <tr>
                  <th>Action</th>
                  <th className="num">Gas</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {GAS.map(([a, g, n]) => (
                  <tr key={a}>
                    <td className="mono text-[13px]">{a}</td>
                    <td data-l="Gas" className="num">{g}</td>
                    <td data-l="Note" className="text-[14px] text-[var(--muted)]">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-[var(--muted)]">Gas is paid in {CHAIN.nativeSymbol} on {CHAIN.name}; at its usual low gas price these are small amounts, shown live on the Network page.</p>
        </section>

        <section id="faq">
          <h2 className="d-md">Questions</h2>
          <div className="mt-6 grid gap-x-10 md:grid-cols-2">
            {FAQ.map((f) => (
              <details key={f.q} className="border-t border-[var(--line)] py-4">
                <summary className="cursor-pointer text-[18px] font-medium tracking-[-0.02em]">{f.q}</summary>
                <p className="mt-3 text-[15px] text-[var(--muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
