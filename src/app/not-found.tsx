import Link from "next/link";
import { PageHead } from "@/components/site/PageHead";

export default function NotFound() {
  return (
    <>
      <PageHead eyebrow="404" title="Not on the table.">
        <p>This page does not exist. The workspace does.</p>
      </PageHead>
      <div className="wrap flex flex-wrap justify-center gap-8 pb-28">
        <Link href="/workspace" className="cta">
          <span className="u">Open the workspace</span> →
        </Link>
        <Link href="/" className="cta">
          <span className="u">Home</span> →
        </Link>
      </div>
    </>
  );
}
