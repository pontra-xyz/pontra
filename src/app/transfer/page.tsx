import { TransferApp } from "@/components/app/TransferApp";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/transfer",
  title: "Transfer check: allowed or not, and why | Pontra",
  description: "Simulate a share transfer against lockups, right of first refusal, accredited and allowlisted recipients, the holder cap, vesting, minimum size and freezes. Every failing rule is listed.",
});

export default function TransferPage() {
  return (
    <>
      <PageHead eyebrow="Transfer check" title="Before anything moves.">
        <p>
          Seller, recipient, class, amount and date: the answer is allowed or not, with every rule that fails and the facts it rested on. <StatusBadge status="Prototype" />
        </p>
      </PageHead>
      <TransferApp />
    </>
  );
}
