import Layout from "./components/Layout.tsx";
import HomePage from "./pages/HomePage.tsx";
import AboutPage from "./pages/AboutPage.tsx";
import StyleguidePage from "./pages/StyleguidePage.tsx";
import ImprintPage from "./pages/ImprintPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import { getPage, useLocationPath } from "./nav.ts";

export default function App() {
  const { pathname, hash } = useLocationPath();
  const page = getPage(pathname);

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
