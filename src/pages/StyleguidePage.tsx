import { useState } from "react";

const colors = [
  { name: "Signal", value: "#E8FF00", role: "Action, focus, live state", text: "#111310" },
  { name: "Canvas", value: "#F4F5EF", role: "Primary background", text: "#111310" },
  { name: "Paper", value: "#FFFFFF", role: "Raised surface", text: "#111310" },
  { name: "Rule", value: "#B9BDB4", role: "Borders and dividers", text: "#111310" },
  { name: "Muted", value: "#50544E", role: "Secondary copy", text: "#FFFFFF" },
  { name: "Ink", value: "#111310", role: "Text and controls", text: "#FFFFFF" },
];

const typeRows = [
  { name: "Display", spec: "Doto 900 / 88–160", sample: "KINETIC SYSTEMS" },
  { name: "Heading", spec: "Doto 900 / 36–64", sample: "Inverse motion" },
  { name: "Body", spec: "Mono 400 / 14–16", sample: "A chain resolves toward a target while preserving its segment constraints." },
  { name: "Label", spec: "Mono 600 / 10–12", sample: "03 / CONVERGENCE" },
];

function SectionHeader({ number, label, title }: { number: string; label: string; title: string }) {
  return (
    <div className="sgl-section-header">
      <div className="sgl-index"><span>{number}</span><span>{label}</span></div>
      <h2>{title}</h2>
    </div>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export default function StyleguidePage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [enabled, setEnabled] = useState(true);

  async function copyColor(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="sgl-page">
      <style>{`
        .sgl-page{--signal:#e8ff00;--signal-pressed:#d8e900;--canvas:#f4f5ef;--paper:#fff;--ink:#111310;--muted:#50544e;--rule:#b9bdb4;--soft-rule:#dfe2da;min-height:100vh;background:var(--canvas);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.035em}.sgl-page *{box-sizing:border-box}.sgl-page button,.sgl-page input{font:inherit}.sgl-wrap{width:min(100% - 40px,1400px);margin:auto}.sgl-hero{min-height:min(860px,100svh);padding:clamp(8rem,16vh,12rem) 0 3rem;display:grid;grid-template-rows:1fr auto;position:relative}.sgl-hero::before{content:"";position:absolute;inset:6rem 0 2rem;pointer-events:none;background:linear-gradient(90deg,var(--soft-rule) 1px,transparent 1px),linear-gradient(var(--soft-rule) 1px,transparent 1px);background-size:clamp(70px,10vw,140px) clamp(70px,10vw,140px);mask-image:linear-gradient(to bottom,black,transparent 85%);opacity:.6}.sgl-hero-main{position:relative;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:clamp(2rem,7vw,7rem);align-items:end}.sgl-kicker,.sgl-index{font-size:.67rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase}.sgl-kicker{display:flex;align-items:center;gap:.8rem;margin-bottom:1.5rem}.sgl-kicker::before{content:"";width:10px;height:10px;background:var(--signal);border:1px solid var(--ink);box-shadow:4px 4px 0 var(--ink)}.sgl-hero h1{margin:0;font-family:'Doto',monospace;font-size:clamp(5rem,13vw,12rem);font-weight:900;line-height:.72;letter-spacing:-.075em;text-transform:uppercase}.sgl-hero h1 span{display:block}.sgl-hero h1 span:last-child{width:max-content;margin-left:clamp(1rem,8vw,8rem);background:var(--signal);padding:.04em .1em .1em;box-shadow:8px 8px 0 var(--ink)}.sgl-hero-copy{max-width:31rem;padding-bottom:.8rem}.sgl-hero-copy strong{display:block;border-top:2px solid var(--ink);padding-top:1rem;font-family:'Doto',monospace;font-size:1.2rem}.sgl-hero-copy p{margin:1rem 0 0;color:var(--muted);font-size:.84rem;line-height:1.85}.sgl-hero-meta{position:relative;display:flex;justify-content:space-between;gap:1rem;padding-top:2rem;font-size:.64rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.sgl-hero-meta span:last-child{text-align:right}.sgl-section{padding:clamp(5rem,10vw,9rem) 0;border-top:1px solid var(--rule)}.sgl-section-header{display:grid;grid-template-columns:220px minmax(0,1fr);gap:clamp(2rem,5vw,5rem);align-items:start;margin-bottom:clamp(3rem,7vw,6rem)}.sgl-index{display:flex;justify-content:space-between;gap:1rem;padding-top:.8rem;border-top:2px solid var(--ink)}.sgl-index span:first-child{font-family:'Doto',monospace;font-size:1.15rem}.sgl-section h2{max-width:900px;margin:0;font-family:'Doto',monospace;font-size:clamp(3.2rem,7vw,7.5rem);font-weight:900;line-height:.82;letter-spacing:-.045em;text-transform:uppercase}.sgl-palette{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--ink);background:var(--ink);gap:1px}.sgl-swatch{min-height:250px;padding:1rem;border:0;display:flex;flex-direction:column;align-items:stretch;justify-content:space-between;text-align:left;cursor:pointer;transition:transform .18s ease,filter .18s ease}.sgl-swatch:hover{transform:translateY(-6px);filter:saturate(1.08)}.sgl-swatch:focus-visible{outline:4px solid var(--ink);outline-offset:4px;z-index:1}.sgl-swatch strong{font-family:'Doto',monospace;font-size:1.1rem}.sgl-swatch small{display:block;margin-top:.35rem;font-size:.58rem;line-height:1.45;text-transform:uppercase}.sgl-swatch code{font-size:.72rem;font-weight:700}.sgl-contrast{display:grid;grid-template-columns:repeat(3,1fr);margin-top:1.25rem;border:1px solid var(--rule)}.sgl-contrast div{padding:1.5rem}.sgl-contrast div+div{border-left:1px solid var(--rule)}.sgl-contrast strong{display:block;font-family:'Doto',monospace;font-size:1.4rem}.sgl-contrast span{display:block;margin-top:.45rem;color:var(--muted);font-size:.66rem;line-height:1.55;text-transform:uppercase}.sgl-type-list{border-top:2px solid var(--ink)}.sgl-type-row{display:grid;grid-template-columns:220px minmax(0,1fr);gap:clamp(2rem,5vw,5rem);padding:2rem 0;border-bottom:1px solid var(--rule);align-items:baseline}.sgl-type-meta strong,.sgl-type-meta span{display:block}.sgl-type-meta strong{font-family:'Doto',monospace;font-size:1rem}.sgl-type-meta span{margin-top:.4rem;color:var(--muted);font-size:.62rem;text-transform:uppercase}.sgl-type-sample{margin:0;letter-spacing:0}.sgl-type-row:nth-child(1) .sgl-type-sample{font-family:'Doto',monospace;font-size:clamp(2.8rem,6vw,6rem);font-weight:900;line-height:.85}.sgl-type-row:nth-child(2) .sgl-type-sample{font-family:'Doto',monospace;font-size:clamp(2rem,4vw,4rem);font-weight:900}.sgl-type-row:nth-child(3) .sgl-type-sample{max-width:720px;font-size:.94rem;line-height:1.8}.sgl-type-row:nth-child(4) .sgl-type-sample{font-size:.68rem;font-weight:700;letter-spacing:.2em}.sgl-layout-demo{display:grid;grid-template-columns:1.3fr .7fr;min-height:520px;border:1px solid var(--ink);background:var(--paper);box-shadow:10px 10px 0 var(--signal)}.sgl-layout-visual{position:relative;overflow:hidden;border-right:1px solid var(--ink);background:var(--ink)}.sgl-layout-grid{position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.11) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.11) 1px,transparent 1px);background-size:64px 64px}.sgl-layout-orbit{position:absolute;width:min(42vw,440px);aspect-ratio:1;border:1px solid rgba(232,255,0,.75);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.sgl-layout-orbit::before,.sgl-layout-orbit::after{content:"";position:absolute;border:1px solid rgba(255,255,255,.35);border-radius:50%;inset:13%}.sgl-layout-orbit::after{inset:31%;background:var(--signal);border-color:var(--signal);box-shadow:0 0 0 10px rgba(232,255,0,.1)}.sgl-layout-coords{position:absolute;inset:1.25rem;display:flex;justify-content:space-between;align-items:flex-end;color:#fff;font-size:.62rem;letter-spacing:.15em}.sgl-layout-copy{padding:clamp(2rem,5vw,5rem);display:flex;flex-direction:column;justify-content:space-between}.sgl-layout-copy span{font-size:.64rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.sgl-layout-copy h3{margin:1rem 0;font-family:'Doto',monospace;font-size:clamp(2.4rem,4vw,4.5rem);line-height:.88}.sgl-layout-copy p{color:var(--muted);font-size:.78rem;line-height:1.8}.sgl-layout-copy a{align-self:flex-start;color:var(--ink);border-bottom:3px solid var(--signal);font-size:.7rem;font-weight:700;text-transform:uppercase}.sgl-components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid var(--rule);background:var(--rule);gap:1px}.sgl-component{min-height:280px;padding:2rem;background:var(--paper)}.sgl-component>span{display:block;margin-bottom:3rem;color:var(--muted);font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.sgl-button-row,.sgl-tag-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}.sgl-btn{border:1px solid var(--ink);border-radius:6px;padding:.8rem 1.1rem;background:transparent;color:var(--ink);font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.sgl-btn-primary{background:var(--ink);color:#fff}.sgl-btn-signal{background:var(--signal);color:var(--ink);box-shadow:4px 4px 0 var(--ink)}.sgl-btn:hover{background:var(--signal);color:var(--ink)}.sgl-tag{border:1px solid var(--rule);border-radius:999px;padding:.45rem .7rem;font-size:.61rem;font-weight:700;text-transform:uppercase}.sgl-tag-active{border-color:var(--ink);background:var(--signal)}.sgl-tabs{display:flex;border-bottom:1px solid var(--rule)}.sgl-tab{border:0;border-bottom:3px solid transparent;padding:.8rem 1rem;background:transparent;color:var(--muted);font-size:.66rem;font-weight:700;text-transform:uppercase;cursor:pointer}.sgl-tab.is-active{border-color:var(--signal);color:var(--ink)}.sgl-field{display:flex;align-items:center;border:1px solid var(--ink);border-radius:6px;background:var(--canvas);padding:0 .9rem}.sgl-field svg{width:18px;fill:none;stroke:currentColor;stroke-width:1.7}.sgl-field input{min-width:0;width:100%;border:0;outline:0;background:transparent;padding:.85rem;color:var(--ink);font-size:.72rem}.sgl-toggle-row{display:flex;align-items:center;justify-content:space-between}.sgl-switch{width:48px;height:26px;border:1px solid var(--ink);border-radius:999px;padding:3px;background:transparent;cursor:pointer}.sgl-switch i{display:block;width:18px;height:18px;border-radius:50%;background:var(--muted);transition:transform .2s}.sgl-switch.is-on{background:var(--signal)}.sgl-switch.is-on i{background:var(--ink);transform:translateX(20px)}.sgl-nav-spec{border:1px solid var(--ink);border-radius:14px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(17,19,16,.08);padding:.8rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem}.sgl-nav-logo{font-family:'Doto',monospace;font-size:1.1rem;font-weight:900}.sgl-nav-right{display:flex;align-items:center;gap:.25rem}.sgl-nav-link{padding:.65rem;color:var(--muted);font-size:.63rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.sgl-nav-link.is-active{color:var(--ink);background:var(--signal);border-radius:5px}.sgl-nav-icon{width:36px;height:36px;border:1px solid var(--rule);border-radius:6px;background:var(--paper);display:grid;place-items:center}.sgl-nav-icon svg{width:17px;fill:none;stroke:currentColor;stroke-width:1.7}.sgl-rule-list{display:grid;grid-template-columns:repeat(3,1fr);margin-top:2rem}.sgl-rule{padding:1.5rem 0;border-top:1px solid var(--ink)}.sgl-rule+.sgl-rule{margin-left:2rem}.sgl-rule strong{display:block;font-family:'Doto',monospace;font-size:1.05rem}.sgl-rule p{margin:.65rem 0 0;color:var(--muted);font-size:.7rem;line-height:1.7}.sgl-footer{display:flex;justify-content:space-between;gap:2rem;padding:2rem 0 4rem;border-top:1px solid var(--ink);font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase}.sgl-footer span:last-child{text-align:right}@media(max-width:900px){.sgl-hero-main,.sgl-section-header,.sgl-type-row{grid-template-columns:1fr}.sgl-hero-main{align-content:center}.sgl-hero-copy{padding-top:3rem}.sgl-palette{grid-template-columns:repeat(3,1fr)}.sgl-contrast{grid-template-columns:1fr}.sgl-contrast div+div{border-left:0;border-top:1px solid var(--rule)}.sgl-layout-demo{grid-template-columns:1fr}.sgl-layout-visual{min-height:420px;border-right:0;border-bottom:1px solid var(--ink)}.sgl-components{grid-template-columns:1fr}.sgl-nav-spec{align-items:flex-start;flex-direction:column}.sgl-nav-right{width:100%;flex-wrap:wrap}.sgl-rule-list{grid-template-columns:1fr}.sgl-rule+.sgl-rule{margin-left:0}}@media(max-width:580px){.sgl-wrap{width:min(100% - 24px,1400px)}.sgl-hero{min-height:760px}.sgl-hero h1{font-size:clamp(4rem,22vw,7rem)}.sgl-hero h1 span:last-child{margin-left:.4rem;box-shadow:5px 5px 0 var(--ink)}.sgl-hero-meta{flex-direction:column}.sgl-hero-meta span:last-child{text-align:left}.sgl-palette{grid-template-columns:repeat(2,1fr)}.sgl-swatch{min-height:210px}.sgl-layout-visual{min-height:330px}.sgl-component{padding:1.4rem}.sgl-nav-link{padding:.5rem}.sgl-footer{flex-direction:column}.sgl-footer span:last-child{text-align:left}}
      `}</style>

      <div className="sgl-wrap">
        <section className="sgl-hero">
          <div className="sgl-hero-main">
            <div>
              <div className="sgl-kicker">LAYER_3 / Visual language 2.0</div>
              <h1><span>Clear</span><span>Signal</span></h1>
            </div>
            <div className="sgl-hero-copy">
              <strong>LIGHT MODE, ENGINEERED.</strong>
              <p>A high-contrast interface system for inverse-kinematics studies. Neutral surfaces hold technical content; neon yellow marks the one thing that needs attention.</p>
            </div>
          </div>
          <div className="sgl-hero-meta">
            <span>Canvas / #F4F5EF</span>
            <span>Accessible contrast / restrained signal</span>
          </div>
        </section>

        <section className="sgl-section">
          <SectionHeader number="01" label="Color system" title="Neon is a signal, not a text color." />
          <div className="sgl-palette">
            {colors.map((color) => (
              <button key={color.name} className="sgl-swatch" style={{ background: color.value, color: color.text }} onClick={() => copyColor(color.value)} aria-label={`Copy ${color.name} color ${color.value}`}>
                <span><strong>{color.name}</strong><small>{color.role}</small></span>
                <code>{copied === color.value ? "COPIED" : color.value}</code>
              </button>
            ))}
          </div>
          <div className="sgl-contrast">
            <div><strong>17.03:1</strong><span>Ink on canvas<br />AAA body text</span></div>
            <div><strong>7.04:1</strong><span>Muted on canvas<br />AAA body text</span></div>
            <div><strong>16.66:1</strong><span>Ink on signal<br />AAA body text</span></div>
          </div>
        </section>

        <section className="sgl-section">
          <SectionHeader number="02" label="Typography" title="Technical, direct, readable." />
          <div className="sgl-type-list">
            {typeRows.map((row) => (
              <div className="sgl-type-row" key={row.name}>
                <div className="sgl-type-meta"><strong>{row.name}</strong><span>{row.spec}</span></div>
                <p className="sgl-type-sample">{row.sample}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sgl-section">
          <SectionHeader number="03" label="Composition" title="Paper for reading. Ink for motion." />
          <div className="sgl-layout-demo">
            <div className="sgl-layout-visual">
              <div className="sgl-layout-grid" />
              <div className="sgl-layout-orbit" />
              <div className="sgl-layout-coords"><span>Y / 024</span><span>LIVE SOLVER</span></div>
            </div>
            <div className="sgl-layout-copy">
              <span>FIG. 03 / Constraint field</span>
              <div>
                <h3>Make the system visible.</h3>
                <p>Dense motion can remain cinematic. Explanations return to white paper, strong rules, and a measured reading width.</p>
              </div>
              <a href="#interface">Read interface rules</a>
            </div>
          </div>
        </section>

        <section className="sgl-section" id="interface">
          <SectionHeader number="04" label="Interface" title="Quiet controls. Obvious states." />
          <div className="sgl-components">
            <div className="sgl-component">
              <span>Actions / radius 6px</span>
              <div className="sgl-button-row">
                <button className="sgl-btn sgl-btn-primary">Open study</button>
                <button className="sgl-btn sgl-btn-signal">Run solver</button>
                <button className="sgl-btn">Reset</button>
              </div>
            </div>
            <div className="sgl-component">
              <span>Status / compact</span>
              <div className="sgl-tag-row">
                <span className="sgl-tag sgl-tag-active">Live</span>
                <span className="sgl-tag">Converged</span>
                <span className="sgl-tag">24 joints</span>
              </div>
            </div>
            <div className="sgl-component">
              <span>Navigation / active underline</span>
              <div className="sgl-tabs" role="tablist">
                {["Overview", "Method", "Data"].map((tab) => <button key={tab} className={`sgl-tab ${activeTab === tab ? "is-active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
              </div>
            </div>
            <div className="sgl-component">
              <span>Input / visible boundary</span>
              <label className="sgl-field"><IconSearch /><input aria-label="Example search" placeholder="SEARCH THE SYSTEM" /></label>
            </div>
            <div className="sgl-component">
              <span>Boolean / signal fill</span>
              <div className="sgl-toggle-row"><strong>System display</strong><button className={`sgl-switch ${enabled ? "is-on" : ""}`} onClick={() => setEnabled((value) => !value)} aria-pressed={enabled} aria-label="Toggle system display"><i /></button></div>
            </div>
            <div className="sgl-component">
              <span>Usage rule</span>
              <p style={{ color: "var(--muted)", lineHeight: 1.8, maxWidth: "32rem" }}>One accent state per cluster. Never place yellow type on white. Pair color with a border, label, or shape so state does not depend on color alone.</p>
            </div>
          </div>
        </section>

        <section className="sgl-section">
          <SectionHeader number="05" label="Global navigation" title="Home at left. Destinations at right." />
          <div className="sgl-nav-spec">
            <span className="sgl-nav-logo">LAYER_3</span>
            <div className="sgl-nav-right">
              <span className="sgl-nav-link is-active">Fabrik</span>
              <span className="sgl-nav-link">CCD</span>
              <span className="sgl-nav-link">Jacobian</span>
              <span className="sgl-nav-link">About</span>
              <span className="sgl-nav-icon"><IconSearch /></span>
              <span className="sgl-nav-icon"><IconSettings /></span>
            </div>
          </div>
          <div className="sgl-rule-list">
            <div className="sgl-rule"><strong>No hidden menu</strong><p>Primary destinations remain visible as separate links at every viewport.</p></div>
            <div className="sgl-rule"><strong>Search discovers the guide</strong><p>The style guide is indexed in search, not promoted as a primary destination.</p></div>
            <div className="sgl-rule"><strong>One settings entry</strong><p>Render quality and system display live behind a single sliders icon.</p></div>
          </div>
        </section>

        <footer className="sgl-footer"><span>LAYER_3 / Style guide 2.0</span><span>Light interface system / 2026</span></footer>
      </div>
    </div>
  );
}
