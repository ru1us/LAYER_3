import { useEffect } from "react";
import Layout from "./components/Layout.tsx";
import HomePage from "./pages/HomePage.tsx";
import AboutPage from "./pages/AboutPage.tsx";
import StyleguidePage from "./pages/StyleguidePage.tsx";
import ImprintPage from "./pages/ImprintPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import { getPage, useLocationPath } from "./nav.ts";
import PresentationPage from "./presentation/PresentationPage.tsx";
import { enterPresentation, leavePresentation } from "./presentation/presentationState.ts";

export default function App() {
  const { pathname, hash } = useLocationPath();
  const page = getPage(pathname);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "p") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (page === "presentation") leavePresentation();
      else enterPresentation(`${pathname}${hash}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hash, page, pathname]);

  useEffect(() => {
    if (page !== "presentation") document.title = "LAYER_3";
  }, [page]);

  if (page === "presentation") return <PresentationPage />;

  return (
    <Layout page={page} pathname={pathname} hash={hash}>
      {page === "home" && <HomePage />}
      {page === "about" && <AboutPage />}
      {page === "styleguide" && <StyleguidePage />}
      {page === "imprint" && <ImprintPage />}
      {page === "privacy" && <PrivacyPage />}
    </Layout>
  );
}
