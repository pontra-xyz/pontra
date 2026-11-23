/* Title band for app pages: the reference's giant medium title with the mint full stop, a centred lead and a caption. */
export function PageHead({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  const words = title.replace(/\.$/, "");
  return (
    <section className="hero-in">
      <div className="wrap pt-32 pb-12 text-center md:pt-44 md:pb-16">
        <p className="body-sm slash fade" style={{ "--i": 0 } as React.CSSProperties}>
          {eyebrow}
        </p>
        <h1 className="d-lg mx-auto mt-6 max-w-[1100px]">
          <span className="ln">
            <span>
              {words}
              <span className="dot pop">.</span>
            </span>
          </span>
        </h1>
        {children ? (
          <div className="body-md fade prose mx-auto mt-8 max-w-[700px]" style={{ "--i": 1 } as React.CSSProperties}>
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="fade mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3" style={{ "--i": 2 } as React.CSSProperties}>
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: "Prototype" | "Concept" }) {
  return <span className={`badge ${status === "Prototype" ? "badge-proto" : "badge-concept"}`}>{status}</span>;
}
export function SampleBadge({ label = "Sample data" }: { label?: string }) {
  return <span className="badge badge-sample">{label}</span>;
}
export function LiveBadge({ label = "Live from chain" }: { label?: string }) {
  return <span className="badge badge-live">{label}</span>;
}
