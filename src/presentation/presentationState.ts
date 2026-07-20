import { navigate } from "../nav.ts";

const RETURN_PATH_KEY = "layer3:presentation:return-path";
const SLIDE_KEY = "layer3:presentation:slide";

function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function getSavedSlide(max: number) {
  const value = Number.parseInt(readSession(SLIDE_KEY) ?? "0", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
}

export function saveSlide(slide: number) {
  writeSession(SLIDE_KEY, String(slide));
}

export function enterPresentation(returnPath: string) {
  if (returnPath !== "/presentation") writeSession(RETURN_PATH_KEY, returnPath);
  navigate("/presentation");
}

export function leavePresentation() {
  navigate(readSession(RETURN_PATH_KEY) ?? "/");
}
