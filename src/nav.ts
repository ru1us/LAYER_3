import { useEffect, useState } from "react";

export type Page = "home" | "about" | "styleguide" | "imprint" | "privacy";

function locationKey() {
  return window.location.pathname + window.location.hash;
}

/** Normalize browser pathname to a known page key. */
export function getPage(pathname: string): Page {
  const path = pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/about":
      return "about";
    case "/styleguide":
      return "styleguide";
    case "/imprint":
      return "imprint";
    case "/privacy":
      return "privacy";
    default:
      return "home";
  }
}

/** Push a new path without a full reload and notify listeners. */
export function navigate(to: string) {
  if (locationKey() === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Track path+hash so the app re-renders on nav, back/forward, and in-page anchors. */
export function useLocationPath() {
  const [key, setKey] = useState(locationKey);

  useEffect(() => {
    const onPop = () => setKey(locationKey());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

  const hashIndex = key.indexOf("#");
  const pathname = hashIndex === -1 ? key : key.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : key.slice(hashIndex);

  return { pathname, hash };
}
