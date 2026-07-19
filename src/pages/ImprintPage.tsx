import CanvasText, { rev } from "../components/CanvasText";

const H2 = "m-0 mb-4 font-doto text-[clamp(1.4rem,2.5vw,2rem)] font-black uppercase tracking-[-0.03em]";
const P = "m-0 mb-4 max-w-3xl text-[0.84rem] leading-[1.85] text-text-muted";

// Reversed hrefs deter HTML-scraping bots.
const EMAIL_HREF = rev("mailto:plagarufus@gmail.com");
const PHONE_HREF = rev("tel:+4915204770398");

const CONTACT_LINES = [
  { text: "Rufus Plaga", bold: true },
  { text: "Im Fischergarten 1" },
  { text: "88250 Weingarten" },
  { text: "Germany" },
  { text: "" },
  { text: "Email: plagarufus@gmail.com", reversedHref: EMAIL_HREF },
  { text: "Phone: +49 1520 4770398", reversedHref: PHONE_HREF },
];

export default function ImprintPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="pt-[clamp(5rem,10vw,8rem)] pb-16">
        <div className="mx-auto w-[min(100%-80px,900px)]">
          <div className="mb-6 flex items-center gap-3 text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">
            <span className="h-2.5 w-2.5 border border-text bg-accent" style={{ boxShadow: "4px 4px 0 var(--color-text)" }} />
            <span>Legal · § 5 TMG</span>
          </div>
          <h1 className="m-0 font-doto text-[clamp(3rem,8vw,6rem)] font-black uppercase leading-[0.82] tracking-[-0.045em]">
            Imprint
          </h1>
          <p className="mt-6 max-w-2xl text-[0.84rem] leading-[1.85] text-text-muted">
            Information according to § 5 TMG (German Telemedia Act)
          </p>

          <div className="mt-12 space-y-10">
            <section className="border-t border-border pt-8">
              <h2 className={H2}>Contact Information</h2>
              <div className="border border-text bg-text p-px">
                <div className="bg-bg p-6">
                  <CanvasText lines={CONTACT_LINES} className="font-mono text-text-muted" />
                </div>
              </div>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>Responsibility for Content</h2>
              <p className={P}>
                The contents of our pages have been created with the utmost care. However, we cannot guarantee
                the contents' accuracy, completeness, or topicality. According to statutory provisions, we are
                furthermore responsible for our own content on these web pages.
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>Responsibility for Links</h2>
              <p className={P}>
                Our website contains links to external websites over which we have no control. Therefore,
                we cannot assume any liability for these external contents. The respective provider or operator
                of the pages is always responsible for the contents of any linked page.
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>Copyright</h2>
              <p className={P}>
                The content and works on these pages created by the site operator are subject to German copyright law.
                The duplication, processing, distribution, and any form of commercialization of such material beyond
                the scope of copyright law shall require the prior written consent of the author or creator.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
