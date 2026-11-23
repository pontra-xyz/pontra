"use client";

import { CHAIN, explorerAddress } from "@/config/brand";
import { CONTRACTS, ledgerLive } from "@/config/contracts";
import { ETH_USD_FEED } from "@/lib/abi";
import { ago } from "@/lib/format";
import { useChain } from "@/components/home/useChain";
import { Stat } from "@/components/app/shared";

const gwei = (wei: string | null) => (wei ? `${(Number(wei) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 5 })} gwei` : "—");

/* Live Robinhood Chain facts with their sources, and a plain list of what is not on chain. */
export function NetworkView() {
  const { data, error, loading } = useChain(10_000);
  const read = data ? new Date(data.readAt).toISOString().slice(11, 19) + " UTC" : "…";
  return (
    <div className="wrap grid grid-cols-1 gap-10 pb-24" data-testid="network">
      {error && !data ? <p className="errbox">The chain could not be read right now ({error}). The figures appear when it answers; nothing here is filled in by hand.</p> : null}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat k="Latest block" v={data?.block ? `#${data.block.toLocaleString("en-US")}` : loading ? "…" : "—"} sub={`read ${read}`} testid="net-block" />
        <Stat k="Chain clock" v={data?.time ? new Date(data.time * 1000).toISOString().slice(11, 19) : "—"} sub={data?.time ? `UTC · block time, ${ago(data.time)}` : "UTC"} testid="net-time" />
        <Stat k="Block time" v={data?.blockSeconds ? `${data.blockSeconds.toFixed(3)} s` : "—"} sub="average over the last 100,000 blocks" />
        <Stat k="Gas price" v={gwei(data?.gasPriceWei ?? null)} sub={`base fee ${gwei(data?.baseFeeWei ?? null)}, paid in ${CHAIN.nativeSymbol}`} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h3">Latest blocks</h2>
          <div className="tbl-wrap mt-4">
            <table className="tbl stack" data-testid="net-blocks">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Time (UTC)</th>
                  <th className="num">Transactions</th>
                  <th className="num">Gas used</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).map((b) => (
                  <tr key={b.number}>
                    <td data-l="Block" className="mono text-[13px]">
                      <a className="link" href={`${CHAIN.explorer}/block/${b.number}`} target="_blank" rel="noreferrer">
                        {b.number.toLocaleString("en-US")}
                      </a>
                    </td>
                    <td data-l="Time (UTC)" className="mono text-[13px]">{new Date(b.time * 1000).toISOString().slice(11, 19)}</td>
                    <td data-l="Transactions" className="num">{b.txs}</td>
                    <td data-l="Gas used" className="num">{b.gasUsed.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card grid grid-cols-1 content-start gap-4">
          <h2 className="h3">Sources</h2>
          <dl className="kv">
            <dt>Network</dt>
            <dd>
              {CHAIN.name} · chain {CHAIN.id}
            </dd>
            <dt>RPC</dt>
            <dd>{CHAIN.publicRpc.replace("https://", "")} (through this site&apos;s relay)</dd>
            <dt>ETH / USD (Chainlink)</dt>
            <dd>
              {data?.ethUsd ? `$${data.ethUsd.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}, updated ${ago(data.ethUsd.updatedAt)}` : "—"}{" "}
              <a className="link" href={explorerAddress(ETH_USD_FEED.address)} target="_blank" rel="noreferrer">
                feed
              </a>
            </dd>
            <dt>PontraCapLedger</dt>
            <dd data-testid="net-ledger">
              {ledgerLive() ? (
                <a className="link" href={explorerAddress(CONTRACTS.ledger)} target="_blank" rel="noreferrer">
                  {data?.ledgerCode ? "code found on chain" : "address set, code not found"}
                </a>
              ) : (
                "not deployed yet"
              )}
            </dd>
          </dl>
          <div className="border-t border-[var(--line)] pt-4">
            <p className="field-label">Not on chain</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-[14px]">
              <li>Cap tables, holder names and agreements of real companies: private, and not published on Robinhood Chain by anyone we know of.</li>
              <li>The sample company and its numbers: invented, kept in your browser.</li>
              <li>Accreditation and allowlists: a company&apos;s own records. Pontra verifies no one.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
