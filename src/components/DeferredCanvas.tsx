import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface DeferredCanvasProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  rootMargin?: string;
  unload?: boolean;
}

export default function DeferredCanvas({
  children,
  fallback,
  className = "relative min-h-screen",
  rootMargin = "100% 0px",
  unload = true,
}: DeferredCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
        } else if (unload) {
          setShouldRender(false);
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, unload]);

  return (
    <div ref={ref} className={className}>
      {shouldRender ? children : fallback ?? null}
    </div>
  );
}
