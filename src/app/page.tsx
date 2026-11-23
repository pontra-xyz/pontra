import { JsonLd } from "@/components/JsonLd";
import { Closing, EveryRule, Hero, KnowWho, Method, Notes, Product, QuestionsBand, WideCard } from "@/components/home/Home";
import { appLd, HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

/* Home in the UI reference's order: hero + running row, wide card, "know who owns what" + live figures, "every rule named",
   the black product grid, the method band, notes, the questions carousel, the closing title. */
export default function Home() {
  return (
    <>
      <JsonLd data={appLd} />
      <Hero />
      <WideCard />
      <KnowWho />
      <EveryRule />
      <Product />
      <Method />
      <Notes />
      <QuestionsBand />
      <Closing />
    </>
  );
}
