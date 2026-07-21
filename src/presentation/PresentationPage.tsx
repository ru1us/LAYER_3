import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useSettings } from "../components/SettingsContext.tsx";
import { getSavedSlide, leavePresentation, saveSlide } from "./presentationState.ts";
import "./presentation.css";

const HeroRobot = lazy(() => import("../components/HeroRobot.tsx"));
const FishSim = lazy(() => import("../components/FishSim.tsx"));
const SpiderSim = lazy(() => import("../components/SpiderSim.tsx"));

const SLIDE_COUNT = 7;
const KICKER = "block text-[clamp(.56rem,.75vw,.68rem)] font-bold uppercase tracking-[.18em] text-text-muted";
const DISPLAY = "m-0 font-doto text-[clamp(2.4rem,5.7vw,6.4rem)] font-black uppercase leading-[.78] tracking-[-.06em]";
const CONTENT = "presentation-slide-in w-[min(1420px,calc(100vw-clamp(2rem,6vw,6rem)))] max-h-[calc(100dvh-clamp(9rem,18vh,12rem))] cursor-none overflow-auto p-[clamp(.5rem,1.5vw,1.5rem)]";
const BODY = "m-0 text-[clamp(.8rem,1vw,1rem)] leading-[1.7] text-text";
const BULLET_ITEM = "flex gap-3 text-[clamp(.78rem,1vw,.98rem)] leading-[1.65] text-text before:mt-[.5em] before:size-2 before:shrink-0 before:rounded-full before:border before:border-text before:bg-accent before:content-['']";
const OUTRO_LINK = "pointer-events-auto inline-flex items-center gap-2 border-b-2 border-black pb-0.5 text-[clamp(1rem,1.5vw,1.35rem)] font-semibold tracking-[-.02em] text-text no-underline transition-colors ";

const SLIDES = [
  { label: "Intro", section: "00 / Auftakt" },
  { label: "Robot", section: "01 / Interaktion" },
  { label: "Grundlagen", section: "02 / Algorithmen" },
  { label: "Technik", section: "03 / Umsetzung" },
  { label: "Performance", section: "04 / Rendering" },
  { label: "Learnings", section: "05 / Fazit" },
  { label: "Outro", section: "06 / Links" },
] as const;

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="size-[18px] fill-none stroke-current stroke-[1.7]" viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === "left" ? "M15 5l-7 7 7 7M8 12h11" : "M9 5l7 7-7 7M5 12h11"} />
    </svg>
  );
}

function LoadingScene() {
  return <div className="grid size-full place-items-center text-[.62rem] font-bold uppercase tracking-[.16em] text-text-muted">3D-Szene wird geladen …</div>;
}

function Heading({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-[clamp(1.2rem,3vh,2.2rem)] grid items-end gap-[clamp(1rem,4vw,4rem)] md:grid-cols-[minmax(0,1.5fr)_minmax(240px,.7fr)]">
      <div><span className={KICKER}>{kicker}</span><h1 className={`${DISPLAY} mt-3`}>{title}</h1></div>
      {children}
    </div>
  );
}

export default function PresentationPage() {
  const [slide, setSlide] = useState(() => getSavedSlide(SLIDE_COUNT - 1));
  const { quality, setQuality } = useSettings();

  const selectSlide = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 0), SLIDE_COUNT - 1);
    saveSlide(clamped);
    setSlide(clamped);
  }, []);

  const showWebsite = useCallback(() => {
    saveSlide(3);
    leavePresentation();
  }, []);

  const next = useCallback(() => {
    if (slide === 2) {
      showWebsite();
      return;
    }
    selectSlide(slide + 1);
  }, [selectSlide, showWebsite, slide]);

  const previous = useCallback(() => selectSlide(slide - 1), [selectSlide, slide]);

  useEffect(() => {
    document.title = `${SLIDES[slide].label} · LAYER_3 Präsentation`;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || (event.key === " " && target?.matches("button, a"))) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        previous();
      } else if (event.key === "Escape") {
        leavePresentation();
      } else if (event.key === "Home") {
        event.preventDefault();
        selectSlide(0);
      } else if (event.key === "End") {
        event.preventDefault();
        selectSlide(SLIDE_COUNT - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, selectSlide, slide]);

  const robotVisible = slide <= 1;
  const fishVisible = slide === 5;
  const spiderVisible = slide === 6;

  return (
    <main className="fixed inset-0 isolate min-h-dvh overflow-hidden bg-[#e9e9e6] text-text">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "linear-gradient(rgba(17,17,17,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(17,17,17,.055) 1px,transparent 1px)",
          backgroundSize: "clamp(56px,7vw,96px) clamp(56px,7vw,96px)",
        }}
      />
      <div className="presentation-scene absolute inset-0 z-0" aria-hidden={!robotVisible && !fishVisible && !spiderVisible}>
        {robotVisible && <Suspense fallback={<LoadingScene />}><HeroRobot showRig={slide === 1} presentationMode showGame={false} /></Suspense>}
        {fishVisible && <Suspense fallback={<LoadingScene />}><FishSim presentationMode /></Suspense>}
        {spiderVisible && (
          <div className="presentation-scene-fade presentation-scene-fade--in absolute inset-0">
            <Suspense fallback={<LoadingScene />}><SpiderSim presentationMode /></Suspense>
          </div>
        )}
      </div>
      <div className={`presentation-glass pointer-events-none absolute inset-0 z-[5] ${slide === 1 ? "presentation-glass--clear" : ""} ${slide === 6 ? "presentation-glass--milky" : ""}`} />

      <header className="pointer-events-none absolute inset-x-[clamp(1rem,3vw,3rem)] top-[clamp(1rem,3vw,3rem)] z-[70] flex items-start justify-between">
        <button type="button" className="pointer-events-auto flex items-baseline gap-3 bg-transparent px-3 py-2 text-text" onClick={() => selectSlide(0)}>
          <span className="text-[.72rem] font-black tracking-[.12em]">LAYER_3</span>
          <small className="text-[.56rem] font-bold uppercase tracking-[.14em] text-text-muted">Präsentation</small>
        </button>
        <div className="pointer-events-auto flex items-center gap-4 pl-3">
          <span className="hidden text-[.56rem] font-bold uppercase tracking-[.14em] text-text-muted sm:block">{SLIDES[slide].section}</span>
          <button type="button" className="cursor-pointer rounded-md bg-text px-3 py-2 text-[.58rem] font-bold uppercase tracking-[.1em] text-bg" onClick={leavePresentation}>Website</button>
        </div>
      </header>

      <section className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-[clamp(1rem,3vw,3rem)] py-[clamp(5.5rem,11vh,8rem)]" aria-live="polite">
        {slide === 0 && (
          <article className="presentation-slide-in pointer-events-auto w-[min(1180px,92vw)] cursor-none px-[clamp(1rem,3vw,3rem)]">
            <span className={KICKER}>Interaktive 3D-Webanwendung</span>
            <h1 className="my-[clamp(.8rem,2vh,1.5rem)] whitespace-nowrap font-doto text-[clamp(3.2rem,13vw,13rem)] font-black uppercase leading-[.76] tracking-[-.065em]">LAYER_3</h1>
            <h2 className="mb-4 font-mono text-[clamp(1.1rem,2.6vw,2.6rem)] leading-[1.1] tracking-[-.035em]">Inverse Kinematics im Browser</h2>
            <p className="m-0 max-w-[620px] text-[clamp(.72rem,1.1vw,.95rem)] leading-[1.75] tracking-[.06em] text-[#484848]">Drei Algorithmen, drei Charaktere und eine gemeinsame Frage: Wie erreicht eine Gelenkkette ihr Ziel?</p>
            <div className="mt-[clamp(1.2rem,3vh,2.2rem)] flex flex-col items-start gap-1 border-t border-text/40 pt-4 sm:flex-row sm:items-baseline sm:gap-6">
              <strong className="text-[.72rem] uppercase tracking-[.1em]">Rufus Plaga</strong><span className="text-[.64rem] text-text-muted">Betreuung: Prof. Markus Lauterbach</span>
            </div>
          </article>
        )}

        {slide === 2 && (
          <article className={`pointer-events-auto ${CONTENT}`}>
            <Heading kicker="Grundlagen" title="Algorithmen"></Heading>
            <div className="w-full border-2 border-text bg-bg/80" role="table" aria-label="Analytische und iterative inverse Kinematik im Vergleich">
              <div className="grid grid-cols-[minmax(120px,.65fr)_repeat(2,minmax(0,1fr))] bg-text text-bg" role="row">
                <span className="p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.7rem,.9vw,.85rem)] font-bold uppercase tracking-[.12em]" role="columnheader">Kriterium</span><strong className="p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.7rem,.9vw,.85rem)] uppercase tracking-[.12em]" role="columnheader">Analytisch</strong><strong className="border-l border-border p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.7rem,.9vw,.85rem)] uppercase tracking-[.12em]" role="columnheader">Iterativ</strong>
              </div>
              {[
                ["Prinzip", "Direkte, geschlossene Formel", "Schrittweise Annäherung"],
                ["Stärken", "Sehr schnell und exakt", "Flexibel bei komplexen Ketten"],
                ["Grenzen", "Modellspezifisch, schwer skalierbar", "Näherung, Abbruchkriterium nötig"],
                ["Im Projekt", "Referenz und theoretische Basis", "FABRIK, CCD und Jacobian DLS"],
              ].map(([criterion, analytic, iterative], index) => (
                <div className={`grid grid-cols-[minmax(120px,.65fr)_repeat(2,minmax(0,1fr))] border-t border-border ${index % 2 ? "bg-surface/55" : ""}`} role="row" key={criterion}>
                  <span className="p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.72rem,.9vw,.88rem)] font-extrabold uppercase leading-[1.45] tracking-[.08em]" role="cell">{criterion}</span><p className="m-0 border-l border-border p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.78rem,1vw,.98rem)] leading-[1.65] text-text" role="cell">{analytic}</p><p className="m-0 border-l border-border p-[clamp(.9rem,1.8vw,1.5rem)] text-[clamp(.78rem,1vw,.98rem)] leading-[1.65] text-text" role="cell">{iterative}</p>
                </div>
              ))}
            </div>
          </article>
        )}

        {slide === 3 && (
          <article className={`pointer-events-auto ${CONTENT}`}>
            <Heading kicker="Technische Umsetzung" title="TECH STACK"><p className={BODY}>3D-Workflow mit komponentenbasierten Web-Architektur.</p></Heading>
            <div className="grid gap-0.5 border-2 border-text bg-text md:grid-cols-3">
              {[
                ["01", "Blender", "Modelle und Materialien", "Armatures und Rigging", "Export als GLB"],
                ["02", "Three.js", "3D-Szenen und Kameras", "Licht, Shading und Rendering", "Animation im Render-Loop"],
                ["03", "React Three Fiber", "React-kompatible 3D-Komponenten", "Zustand und UI gemeinsam denken", "Wiederverwendbare Simulationen"],
              ].map(([number, title, ...items]) => <section key={number} className="bg-bg/95 p-[clamp(1.25rem,2.6vw,2.5rem)]"><span className="text-[clamp(.72rem,.85vw,.82rem)] font-extrabold text-text-muted">{number}</span><h2 className="my-[clamp(.8rem,1.5vw,1.25rem)] font-mono text-[clamp(1.35rem,2.2vw,2.1rem)] font-black uppercase leading-[1.05] tracking-[-.03em]">{title}</h2><ul className="m-0 grid list-none gap-[clamp(.7rem,1.2vw,1rem)] p-0">{items.map((item) => <li className={BULLET_ITEM} key={item}>{item}</li>)}</ul></section>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2.5"><span className="mr-auto text-[clamp(.68rem,.8vw,.78rem)] font-bold uppercase tracking-[.12em] text-text">Zusätzlich</span>{['Drei', 'Rapier', 'TypeScript', 'Vite', 'Tailwind CSS'].map((tool) => <strong className="rounded-[5px] border border-text/60 bg-bg/75 px-3 py-2.5 text-[clamp(.68rem,.8vw,.78rem)] uppercase tracking-[.07em]" key={tool}>{tool}</strong>)}</div>
          </article>
        )}

        {slide === 4 && (
          <article className={`pointer-events-auto ${CONTENT}`}>
            <Heading kicker="Performance" title="Computing">
              <div className="grid justify-items-end gap-2.5"><span className="text-[clamp(.68rem,.8vw,.78rem)] font-bold uppercase tracking-[.12em] text-text">Render-Modus</span><div className="flex overflow-hidden rounded-md border-2 border-text">{(['high', 'performance'] as const).map((mode) => <button key={mode} className={`cursor-pointer border-0 px-5 py-3 text-[clamp(.7rem,.85vw,.82rem)] font-extrabold uppercase tracking-[.1em] ${quality === mode ? "bg-text text-accent" : "bg-bg/90 text-text"}`} onClick={() => setQuality(mode)}>{mode === 'high' ? 'High' : 'Perf'}</button>)}</div></div>
            </Heading>
            <div className="grid gap-0.5 border-2 border-text bg-text md:grid-cols-2">
              {[
                ["CPU / Logik", "Berechnen", "IK-Solver und Gelenkgrenzen", "Physik und Kollisionsabfragen", "React-Zustand und Eingaben", "Szenengraph aktualisieren"],
                ["GPU / Darstellung", "Rendern", "Geometrie und Materialien", "Licht- und Schattenberechnung", "Pixel, Transparenz und Effekte", "Viele parallele Operationen pro Frame"],
              ].map(([kicker, title, ...items]) => <section className="bg-bg/95 p-[clamp(1.4rem,3vw,2.8rem)]" key={kicker}><span className="block text-[clamp(.7rem,.85vw,.82rem)] font-bold uppercase tracking-[.15em] text-text">{kicker}</span><h2 className="my-[clamp(.9rem,1.6vw,1.4rem)] font-mono text-[clamp(1.45rem,2.4vw,2.3rem)] font-black uppercase leading-none tracking-[-.03em]">{title}</h2><ul className="m-0 grid list-none gap-[clamp(.7rem,1.2vw,1rem)] p-0">{items.map((item) => <li className={BULLET_ITEM} key={item}>{item}</li>)}</ul></section>)}
            </div>
            <p className="mt-5 py-3 text-[clamp(.78rem,1vw,.98rem)] font-medium leading-[1.65] text-text">Performance-Modus reduziert Pixel-Dichte, Antialiasing, Schatten und teure Effekte. Die Algorithmen bleiben unverändert.</p>
          </article>
        )}

        {slide === 5 && (
          <article className={`pointer-events-auto ${CONTENT}`}>
            <span className="block text-[clamp(.7rem,.9vw,.85rem)] font-bold uppercase tracking-[.16em] text-text">Learnings / Fazit</span>
            <h1 className={`${DISPLAY} my-[clamp(1rem,2.5vh,1.8rem)] text-[clamp(3rem,6.8vw,7rem)]`}>Was bleibt?</h1>
            <ul className="m-0 grid list-none gap-[clamp(1rem,2.2vh,1.6rem)] p-0">
              {[
                ["01", "KI als Werkzeug, nicht als Autopilot."],
                ["02", "Technisch korrekte Bewegung ist nicht automatisch gute Interaktion."],
                ["03", "3D im Web ist ein System aus Kompromissen."],
                ["04", "Visualisierung macht abstrakte Mathematik greifbar."],
              ].map(([number, title]) => (
                <li className="flex items-baseline gap-[clamp(.9rem,1.6vw,1.4rem)] text-[clamp(1rem,1.5vw,1.35rem)] leading-[1.45] text-text before:mt-[.55em] before:size-2 before:shrink-0 before:rounded-full before:border before:border-text before:bg-accent before:content-['']" key={number}>
                  <span className="min-w-[2.2ch] font-extrabold tracking-[.04em]">{number}</span>
                  <span className="font-medium">{title}</span>
                </li>
              ))}
            </ul>
          </article>
        )}

        {slide === 6 && (
          <article className="presentation-slide-in presentation-outro pointer-events-auto w-[min(1180px,92vw)] cursor-auto px-[clamp(1rem,3vw,3rem)]">
            <span className={KICKER}>Interaktive 3D-Webanwendung</span>
            <h1 className="my-[clamp(.8rem,2vh,1.5rem)] whitespace-nowrap font-doto text-[clamp(3.2rem,13vw,13rem)] font-black uppercase leading-[.76] tracking-[-.065em]">LAYER_3</h1>
            <div className="mt-[clamp(1.2rem,3vh,2.2rem)] flex flex-col items-start gap-[clamp(.9rem,1.8vh,1.2rem)] border-t border-text/40 pt-4">
              <a className={OUTRO_LINK} href="https://layer3.space" target="_blank" rel="noopener noreferrer">
                <span className="text-[.72rem] font-bold uppercase tracking-[.14em] text-black">Web</span>
                layer3.space
              </a>
              <a className={OUTRO_LINK} href="https://github.com/ru1us/layer_3" target="_blank" rel="noopener noreferrer">
                <span className="text-[.72rem] font-bold uppercase tracking-[.14em] text-black">GitHub</span>
                github.com/ru1us/layer_3
              </a>
            </div>
            <div className="mt-[clamp(1.2rem,3vh,2.2rem)] flex flex-col items-start gap-1 border-t border-text/40 pt-4 sm:flex-row sm:items-baseline sm:gap-6">
              <strong className="text-[.72rem] uppercase tracking-[.1em]">Rufus Plaga</strong>
              <span className="text-[.64rem] text-text-muted">Betreuung: Prof. Markus Lauterbach</span>
            </div>
          </article>
        )}
      </section>

      <footer className="absolute right-[clamp(1rem,3vw,3rem)] bottom-[clamp(1rem,3vw,3rem)] z-[80] flex items-center gap-2 rounded-[10px] border border-text bg-bg/80 p-1.5 shadow-[0_12px_40px_rgba(17,17,17,.1)] backdrop-blur-[18px] max-sm:right-1/2 max-sm:translate-x-1/2">
        <button type="button" className="grid size-[34px] cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:not-disabled:bg-accent disabled:cursor-default disabled:opacity-25" onClick={previous} disabled={slide === 0} aria-label="Vorherige Folie"><ArrowIcon direction="left" /></button>
        <nav className="flex items-center gap-1" aria-label="Folien">{SLIDES.map((item, index) => <button type="button" key={item.label} className="grid h-7 w-[18px] cursor-pointer place-items-center border-0 bg-transparent" onClick={() => selectSlide(index)} aria-label={`Folie ${index + 1}: ${item.label}`} aria-current={index === slide ? "step" : undefined}><span className={`h-[5px] rounded-full transition-all ${index === slide ? "w-4 bg-text" : "w-[5px] bg-border"}`} /></button>)}</nav>
        <span className="min-w-[3.6rem] text-center text-[.62rem] font-bold text-text-muted">{String(slide + 1).padStart(2, "0")} / {String(SLIDE_COUNT).padStart(2, "0")}</span>
        <button type="button" className="grid size-[34px] cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:not-disabled:bg-accent disabled:cursor-default disabled:opacity-25" onClick={next} disabled={slide === SLIDE_COUNT - 1} aria-label={slide === 2 ? "Website öffnen" : "Nächste Folie"}><ArrowIcon direction="right" /></button>
      </footer>
    </main>
  );
}
