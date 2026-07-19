import CanvasText, { rev } from "../components/CanvasText";

const H2 = "m-0 mb-4 font-doto text-[clamp(1.4rem,2.5vw,2rem)] font-black uppercase tracking-[-0.03em]";
const H3 = "m-0 mb-3 mt-6 font-doto text-[1.05rem] font-black uppercase tracking-[-0.02em]";
const P = "m-0 mb-4 max-w-3xl text-[0.84rem] leading-[1.85] text-text-muted";
const UL = "mb-4 list-disc space-y-1 pl-6 text-[0.84rem] leading-[1.85] text-text-muted";
const LINK = "font-bold text-text underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-text-muted";

// Reversed mailto deters HTML-scraping bots.
const EMAIL_HREF = rev("mailto:plagarufus@gmail.com");
const EMAIL_LINES = [{ text: "plagarufus@gmail.com", reversedHref: EMAIL_HREF }];
const EMAIL_PREFIXED_LINES = [{ text: "Email: plagarufus@gmail.com", reversedHref: EMAIL_HREF }];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="pt-[clamp(5rem,10vw,8rem)] pb-16">
        <div className="mx-auto w-[min(100%-80px,900px)]">
          <div className="mb-6 flex items-center gap-3 text-[0.67rem] font-bold uppercase tracking-[0.2em] text-text-muted">
            <span className="h-2.5 w-2.5 border border-text bg-accent" style={{ boxShadow: "4px 4px 0 var(--color-text)" }} />
            <span>Legal · GDPR</span>
          </div>
          <h1 className="m-0 font-doto text-[clamp(3rem,8vw,6rem)] font-black uppercase leading-[0.82] tracking-[-0.045em]">
            Privacy Policy
          </h1>
          <p className="mt-6 max-w-2xl text-[0.84rem] leading-[1.85] text-text-muted">
            Last updated: July 20, 2026
          </p>

          <div className="mt-12 space-y-10">
            <section className="border-t border-border pt-8">
              <h2 className={H2}>1. Data Controller</h2>
              <p className={P}>
                The data controller for this website is:<br />
                Rufus Plaga<br />
                <CanvasText inline lines={EMAIL_PREFIXED_LINES} className="font-mono" />
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>2. General Information</h2>
              <p className={P}>
                This website does not use cookies, analytics, advertising trackers, or cookie consent banners. It also does not actively collect personal data on its own servers.
              </p>
              <p className={P}>
                Technical data may still be processed by third-party infrastructure needed to deliver the website (hosting and DNS).
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>3. Third-Party Services</h2>

              <h3 className={H3}>3.1 GitHub Pages (Hosting Provider)</h3>
              <p className={P}>
                This website is hosted on GitHub Pages, a service provided by GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA.
              </p>
              <p className={P}>
                GitHub Pages does not set cookies for visitors of this website.
              </p>
              <p className={P}>
                <span className="font-bold text-text">Data that may be processed automatically by GitHub:</span>
              </p>
              <ul className={UL}>
                <li>IP address</li>
                <li>Date and time of access</li>
                <li>Pages visited</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Referrer URL (previously visited page)</li>
              </ul>
              <p className={P}>
                <span className="font-bold text-text">Purpose:</span> Technical provision, security, and operation of the website.
              </p>
              <p className={P}>
                <span className="font-bold text-text">Legal basis:</span> Art. 6 para. 1 lit. f GDPR (legitimate interest in technical provision and security of the website).
              </p>
              <p className={P}>
                More information:{" "}
                <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noopener noreferrer" className={LINK}>
                  GitHub Privacy Statement
                </a>
              </p>

              <h3 className={H3}>3.2 Vercel (Hosting / DNS Provider)</h3>
              <p className={P}>
                Parts of this website’s delivery and domain/DNS setup may use Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
              </p>
              <p className={P}>
                Vercel does not set cookies for visitors of this website in the configuration used here.
              </p>
              <p className={P}>
                <span className="font-bold text-text">Data that may be processed automatically by Vercel:</span>
              </p>
              <ul className={UL}>
                <li>IP address</li>
                <li>Date and time of access</li>
                <li>Pages visited</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Referrer URL (previously visited page)</li>
              </ul>
              <p className={P}>
                <span className="font-bold text-text">Purpose:</span> Technical provision, DNS resolution, security, and operation of the website.
              </p>
              <p className={P}>
                <span className="font-bold text-text">Legal basis:</span> Art. 6 para. 1 lit. f GDPR (legitimate interest in technical provision and security of the website).
              </p>
              <p className={P}>
                More information:{" "}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className={LINK}>
                  Vercel Privacy Policy
                </a>
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>4. Contact via Email</h2>
              <p className={P}>
                If you contact us via email at{" "}
                <CanvasText inline lines={EMAIL_LINES} className="font-mono" />
                , your email content (email address, name, message) will only be used to respond to your inquiry.
              </p>
              <p className={P}>
                <span className="font-bold text-text">Legal basis:</span> Art. 6 para. 1 lit. b GDPR (pre-contractual measures) or Art. 6 para. 1 lit. f GDPR (legitimate interest in responding).
              </p>
              <p className={P}>
                <span className="font-bold text-text">Retention:</span> Your email will be deleted after your inquiry has been fully processed, unless legal retention obligations apply.
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>5. External Links</h2>
              <p className={P}>
                This website may contain links to external third-party websites. We have no control over the content or privacy practices of those websites and assume no responsibility for them.
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>6. Your Rights Under GDPR</h2>
              <p className={P}>
                You have the following rights regarding your personal data:
              </p>
              <ul className={UL}>
                <li><span className="font-bold text-text">Right of access (Art. 15 GDPR)</span></li>
                <li><span className="font-bold text-text">Right to rectification (Art. 16 GDPR)</span></li>
                <li><span className="font-bold text-text">Right to erasure (Art. 17 GDPR)</span></li>
                <li><span className="font-bold text-text">Right to restriction (Art. 18 GDPR)</span></li>
                <li><span className="font-bold text-text">Right to data portability (Art. 20 GDPR)</span></li>
                <li><span className="font-bold text-text">Right to object (Art. 21 GDPR)</span></li>
              </ul>
              <p className={P}>
                Because access logs are primarily processed by third-party providers (GitHub, Vercel), you may need to contact those providers directly for provider-side log data.
              </p>
              <p className={P}>
                For questions or to exercise your rights, contact:{" "}
                <CanvasText inline lines={EMAIL_LINES} className="font-mono" />
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>7. Right to Lodge a Complaint</h2>
              <p className={P}>
                You have the right to lodge a complaint with a data protection supervisory authority if you believe your data is being processed unlawfully.
              </p>
            </section>

            <section className="border-t border-border pt-8">
              <h2 className={H2}>8. Changes to This Privacy Policy</h2>
              <p className={P}>
                This privacy policy may be updated to reflect technical or legal changes. The current version and date are always shown on this page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
