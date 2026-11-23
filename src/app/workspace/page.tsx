import { WorkspaceApp } from "@/components/app/WorkspaceApp";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/workspace",
  title: "Company workspace: cap table, classes and grants | Pontra",
  description: "Holders, share classes and grants in one table: balances, vested shares today and each holder's share of the total. Kept in your browser; starts from an invented sample company.",
});

export default function WorkspacePage() {
  return (
    <>
      <PageHead eyebrow="Company workspace" title="Who holds what.">
        <p>
          Share classes, holders and grants with their vesting, in one table that stays in this browser. It starts with an invented sample company; change it, export it, or start empty. <StatusBadge status="Prototype" />
        </p>
      </PageHead>
      <WorkspaceApp />
    </>
  );
}
