import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import HomePage from "./pages/HomePage.tsx";
import ExampleRotatingCube from "./pages/examples/ExampleRotatingCube.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/examples/rotating-cube" element={<ExampleRotatingCube />} />
      </Route>
    </Routes>
  );
}
