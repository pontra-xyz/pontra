import { VestingApp } from "@/components/app/VestingApp";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/vesting",
  title: "Vesting calculator: cliff, linear and monthly | Pontra",
  description: "The exact number of vested shares on any date for cliff, linear and monthly schedules, with the curve, using the same integer math as the PontraCapLedger contract.",
});

export default function VestingPage() {
  return (
    <>
      <PageHead eyebrow="Vesting" title="When shares open up.">
        <p>
          Pick a grant from the workspace or type a schedule: the vested amount on any date, the curve and the day it completes. <StatusBadge status="Prototype" />
        </p>
      </PageHead>
      <VestingApp />
    </>
  );
}
