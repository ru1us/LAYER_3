import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import HomePage from "./pages/HomePage.tsx";
import ExampleRotatingCube from "./pages/examples/ExampleRotatingCube.tsx";
import StyleguidePage from "./pages/StyleguidePage.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/glass-cube" element={<ExampleRotatingCube />} />
        <Route path="/styleguide" element={<StyleguidePage />} />
      </Route>
    </Routes>
  );
}
