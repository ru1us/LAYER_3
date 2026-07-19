import type { ReactNode } from "react";

/** Shared About page section. */
export function AlgorithmSection({
  number,
  label,
  title,
  children,
}: {
  number: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border bg-bg py-[clamp(3rem,6vw,5rem)]">
      <div className="mx-auto w-[min(100%-80px,1100px)]">
        <div className="mb-10 grid grid-cols-[200px_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] items-start max-[720px]:grid-cols-1 max-[720px]:gap-4">
          <div className="flex justify-between gap-4 pt-3 border-t-2 border-text text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
            <span className="font-doto text-[1.1rem] text-text">{number}</span>
            <span>{label}</span>
          </div>
          <h2 className="m-0 font-doto text-[clamp(2rem,4vw,3.8rem)] font-black uppercase leading-[0.85] tracking-[-0.04em]">{title}</h2>
        </div>
        <div className="max-w-3xl">{children}</div>
      </div>
    </section>
  );
}
