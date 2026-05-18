import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import HomePage from "./pages/HomePage.tsx";
import ExampleRotatingCube from "./pages/examples/ExampleRotatingCube.tsx";
import StyleguidePage from "./pages/StyleguidePage.tsx";
import CCDPage from "./pages/algorithms/CCDPage.tsx";
import FABRIKPage from "./pages/algorithms/FABRIKPage.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pages/ccd" element={<CCDPage />} />
        <Route path="/pages/fabrik" element={<FABRIKPage />} />
        <Route path="/pages/particles" element={<ExampleRotatingCube />} />
        <Route path="/styleguide" element={<StyleguidePage />} />
      </Route>
    </Routes>
  );
}
