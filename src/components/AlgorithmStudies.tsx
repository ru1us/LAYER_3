import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSettings } from "./SettingsContext";
import { SliderRow } from "./sim";

type Point = { x: number; y: number };

const INK = "#111111";
const MUTED = "#777777";
const BORDER = "#cccccc";
const ACCENT = "#e8ff00";

function fitCanvas(canvas: HTMLCanvasElement, performanceMode: boolean) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, performanceMode ? 1 : 1.5);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f5f5f5";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = BORDER;
  context.lineWidth = 0.5;
  context.globalAlpha = 0.55;
  for (let x = 24; x < width; x += 24) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 24; y < height; y += 24) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawChain(context: CanvasRenderingContext2D, points: Point[], target: Point, active: boolean) {
  context.strokeStyle = INK;
  context.lineWidth = 8;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
  context.stroke();

  for (let index = 0; index < points.length; index += 1) {
    context.beginPath();
    context.arc(points[index].x, points[index].y, index === points.length - 1 ? 7 : 5, 0, Math.PI * 2);
    context.fillStyle = index === points.length - 1 ? ACCENT : "#f5f5f5";
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 2;
    context.stroke();
  }

  context.strokeStyle = active ? INK : MUTED;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(target.x, target.y, 12, 0, Math.PI * 2);
  context.moveTo(target.x - 17, target.y);
  context.lineTo(target.x + 17, target.y);
  context.moveTo(target.x, target.y - 17);
  context.lineTo(target.x, target.y + 17);
  context.stroke();
}

function solveFabrik(points: Point[], lengths: number[], target: Point, bendLimit: number) {
  // A backward-only reach leaves the base free.
  for (let pass = 0; pass < 3; pass += 1) {
    points[points.length - 1] = { ...target };
    for (let index = points.length - 2; index >= 0; index -= 1) {
      const next = points[index + 1];
      const current = points[index];
      const distance = Math.hypot(current.x - next.x, current.y - next.y) || 1;
      const ratio = lengths[index] / distance;
      points[index] = {
        x: next.x + (current.x - next.x) * ratio,
        y: next.y + (current.y - next.y) * ratio,
      };
    }
    if (bendLimit < Math.PI) {
      for (let i = 1; i < points.length - 1; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        const inAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);
        let bend = outAngle - inAngle;
        while (bend > Math.PI) bend -= Math.PI * 2;
        while (bend < -Math.PI) bend += Math.PI * 2;
        if (Math.abs(bend) > bendLimit) {
          const clamped = inAngle + Math.sign(bend) * bendLimit;
          const rot = clamped - outAngle;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          for (let j = i + 1; j < points.length; j += 1) {
            const px = points[j].x - curr.x;
            const py = points[j].y - curr.y;
            points[j] = { x: curr.x + px * cos - py * sin, y: curr.y + px * sin + py * cos };
          }
          for (let j = i + 1; j < points.length; j += 1) {
            const dist = Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y) || 1;
            const ratio = lengths[j - 1] / dist;
            points[j] = {
              x: points[j - 1].x + (points[j].x - points[j - 1].x) * ratio,
              y: points[j - 1].y + (points[j].y - points[j - 1].y) * ratio,
            };
          }
        }
      }
    }
  }
}

function FabrikCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<Point | null>(null);
  const [bendLimit, setBendLimit] = useState(180);
  const controlsRef = useRef({ bendLimit });
  const { quality } = useSettings();

  useEffect(() => {
    controlsRef.current = { bendLimit };
  }, [bendLimit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let visible = true;
    let previousTime = 0;
    let points: Point[] = [];
    let lengths: number[] = [];
    let lastWidth = 0;
    let lastHeight = 0;
    const performanceMode = quality === "performance";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = 1000 / (reducedMotion ? 8 : performanceMode ? 20 : 30);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden || time - previousTime < frameInterval) return;
      previousTime = time;
      const { context, width, height } = fitCanvas(canvas, performanceMode);
      if (!context) return;
      if (width !== lastWidth || height !== lastHeight || points.length === 0) {
        const segmentLength = Math.min(width * 0.08, 48);
        points = Array.from({ length: 5 }, (_, index) => ({
          x: width * 0.5 + index * segmentLength,
          y: height * 0.52,
        }));
        lengths = Array.from({ length: 4 }, () => segmentLength);
        lastWidth = width;
        lastHeight = height;
      }
      const margin = 24;
      const idleTarget = {
        x: margin + (width - margin * 2) * (0.5 + 0.5 * Math.sin(time * 0.00031)),
        y: margin + (height - margin * 2) * (0.5 + 0.5 * Math.sin(time * 0.00047 + 1.3)),
      };
      const target = pointerRef.current ?? idleTarget;
      solveFabrik(points, lengths, target, controlsRef.current.bendLimit * Math.PI / 180);
      drawGrid(context, width, height);
      drawChain(context, points, target, pointerRef.current !== null);
      context.fillStyle = MUTED;
      context.font = "700 10px monospace";
      context.fillText(pointerRef.current ? "TARGET: POINTER" : "IDLE TARGET: AUTO", 16, 24);
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [quality]);

  const setPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="block h-[clamp(320px,43vw,500px)] w-full touch-none cursor-crosshair"
        aria-label="Interactive FABRIK chain. Move or drag the pointer to pull the end effector."
        onPointerEnter={(event) => setPointer(event.clientX, event.clientY)}
        onPointerMove={(event) => setPointer(event.clientX, event.clientY)}
        onPointerLeave={() => { pointerRef.current = null; }}
      />
      <div className="border-t border-text bg-surface p-5">
        <SliderRow label="Bend limit / joint" value={bendLimit} display={bendLimit >= 180 ? "OFF" : `±${bendLimit}°`} min={90} max={180} step={5} onChange={setBendLimit} />
      </div>
    </div>
  );
}

const ONE_PASS_STEPS = 10; // 1 tip→target + 4 backward + 1 base reset + 4 forward
const ONE_PASS_BACKWARD_END = 5;

function OnePassFabrikCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { quality } = useSettings();
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const animatedRef = useRef(0);

  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let visible = true;
    let previousTime = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let needsDraw = true;
    let states: Point[][] = [];
    let target = { x: 0, y: 0 };
    let anchor = { x: 0, y: 0 };
    const performanceMode = quality === "performance";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = 1000 / (reducedMotion ? 8 : performanceMode ? 20 : 30);
    const ease = reducedMotion ? 1 : 0.18;

    const resetGeometry = (width: number, height: number) => {
      const initial = [
        { x: width * 0.12, y: height * 0.72 },
        { x: width * 0.29, y: height * 0.61 },
        { x: width * 0.44, y: height * 0.39 },
        { x: width * 0.62, y: height * 0.5 },
        { x: width * 0.77, y: height * 0.69 },
      ];
      const lengths = initial.slice(0, -1).map((point, index) => Math.hypot(initial[index + 1].x - point.x, initial[index + 1].y - point.y));
      target = { x: width * 0.82, y: height * 0.23 };
      anchor = { ...initial[0] };
      states = [initial.map((point) => ({ ...point }))];

      let points = initial.map((point) => ({ ...point }));
      points[points.length - 1] = { ...target };
      states.push(points.map((point) => ({ ...point })));
      for (let index = points.length - 2; index >= 0; index -= 1) {
        const next = points[index + 1];
        const current = points[index];
        const distance = Math.hypot(current.x - next.x, current.y - next.y) || 1;
        points[index] = {
          x: next.x + (current.x - next.x) * lengths[index] / distance,
          y: next.y + (current.y - next.y) * lengths[index] / distance,
        };
        states.push(points.map((point) => ({ ...point })));
      }

      points[0] = { ...anchor };
      states.push(points.map((point) => ({ ...point })));
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const distance = Math.hypot(current.x - previous.x, current.y - previous.y) || 1;
        points[index] = {
          x: previous.x + (current.x - previous.x) * lengths[index - 1] / distance,
          y: previous.y + (current.y - previous.y) * lengths[index - 1] / distance,
        };
        states.push(points.map((point) => ({ ...point })));
      }
      lastWidth = width;
      lastHeight = height;
      animatedRef.current = stepRef.current;
      needsDraw = true;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) needsDraw = true;
    });
    const resizeObserver = new ResizeObserver(() => { needsDraw = true; });
    observer.observe(canvas);
    resizeObserver.observe(canvas);

    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden) { previousTime = time; return; }
      if (time - previousTime < frameInterval) return;
      previousTime = time;
      const { context, width, height } = fitCanvas(canvas, performanceMode);
      if (!context) return;
      if (width !== lastWidth || height !== lastHeight || states.length === 0) resetGeometry(width, height);

      const targetStep = stepRef.current;
      const animated = animatedRef.current;
      const difference = targetStep - animated;
      if (Math.abs(difference) > 0.001) {
        animatedRef.current = animated + difference * ease;
        needsDraw = true;
      } else if (animated !== targetStep) {
        animatedRef.current = targetStep;
        needsDraw = true;
      }
      if (!needsDraw) return;
      needsDraw = false;

      const position = animatedRef.current;
      const fromIndex = Math.max(0, Math.min(states.length - 2, Math.floor(position)));
      const toIndex = Math.min(states.length - 1, fromIndex + 1);
      const rawProgress = Math.max(0, Math.min(1, position - fromIndex));
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      const from = states[fromIndex];
      const to = states[toIndex];
      const points = from.map((point, index) => ({
        x: point.x + (to[index].x - point.x) * progress,
        y: point.y + (to[index].y - point.y) * progress,
      }));
      const displayedStep = Math.round(position);
      const phase = displayedStep === 0 ? "STARTING POSE" : displayedStep <= ONE_PASS_BACKWARD_END ? "BACKWARD REACH" : "FORWARD REACH";
      const phaseStep = displayedStep === 0 ? "READY" : displayedStep <= ONE_PASS_BACKWARD_END ? `${displayedStep} / 5` : `${displayedStep - ONE_PASS_BACKWARD_END} / 5`;

      drawGrid(context, width, height);
      context.save();
      context.setLineDash([5, 5]);
      context.strokeStyle = MUTED;
      context.globalAlpha = 0.35;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(states[0][0].x, states[0][0].y);
      for (let index = 1; index < states[0].length; index += 1) context.lineTo(states[0][index].x, states[0][index].y);
      context.stroke();
      context.restore();

      drawChain(context, points, target, displayedStep > 0 && displayedStep <= ONE_PASS_BACKWARD_END);
      context.beginPath();
      context.arc(anchor.x, anchor.y, 10, 0, Math.PI * 2);
      context.strokeStyle = INK;
      context.lineWidth = 1.5;
      context.stroke();
      context.beginPath();
      context.arc(anchor.x, anchor.y, 3, 0, Math.PI * 2);
      context.fillStyle = INK;
      context.fill();

      context.fillStyle = MUTED;
      context.font = "700 10px monospace";
      context.fillText(phase, 16, 24);
      context.textAlign = "right";
      context.fillText(phaseStep, width - 16, 24);
      context.textAlign = "left";
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [quality]);

  const stepBack = () => setStep((value) => Math.max(0, value - 1));
  const stepForward = () => setStep((value) => Math.min(ONE_PASS_STEPS, value + 1));

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="block h-[clamp(320px,43vw,500px)] w-full"
        aria-label="FABRIK single iteration. Use the backward and forward buttons to step through one backward reach followed by one forward reach."
      />
      <div className="flex items-center justify-between gap-4 border-t border-text bg-surface p-5">
        <button
          type="button"
          onClick={stepBack}
          disabled={step <= 0}
          className="flex items-center gap-2 border border-text px-4 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text transition-colors enabled:hover:bg-text enabled:hover:text-accent disabled:opacity-30"
        >
          <span aria-hidden>←</span> Backward
        </button>
        <div className="text-center font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">
          <div className="text-text">Step {step} / {ONE_PASS_STEPS}</div>
        </div>
        <button
          type="button"
          onClick={step >= ONE_PASS_STEPS ? () => setStep(0) : stepForward}
          className="flex items-center gap-2 border border-text px-4 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text transition-colors enabled:hover:bg-text enabled:hover:text-accent"
        >
          {step >= ONE_PASS_STEPS ? <><span aria-hidden>↻</span> Repeat</> : <>Forward <span aria-hidden>→</span></>}
        </button>
      </div>
    </div>
  );
}

function forwardKinematics(origin: Point, lengths: number[], angles: number[]) {
  const points = [{ ...origin }];
  let x = origin.x;
  let y = origin.y;
  let angle = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    angle += angles[index];
    x += Math.cos(angle) * lengths[index];
    y += Math.sin(angle) * lengths[index];
    points.push({ x, y });
  }
  return points;
}

function ccdSweep(origin: Point, lengths: number[], angles: number[], target: Point) {
  // Apply full correction without joint limits.
  for (let joint = angles.length - 1; joint >= 0; joint -= 1) {
    const points = forwardKinematics(origin, lengths, angles);
    const pivot = points[joint];
    const end = points[points.length - 1];
    const endAngle = Math.atan2(end.y - pivot.y, end.x - pivot.x);
    const targetAngle = Math.atan2(target.y - pivot.y, target.x - pivot.x);
    let delta = targetAngle - endAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    angles[joint] += delta;
  }
}

type CcdStatus = "idle" | "iterating" | "solved" | "timeout";

const CCD_MAX_ITERATIONS = 500;
const CCD_TIMEOUT_MS = 4000;

function CcdCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [iterationsPerSecond, setIterationsPerSecond] = useState(8);
  const [acceptance, setAcceptance] = useState(8);
  const controlsRef = useRef({ iterationsPerSecond, acceptance });
  const { quality } = useSettings();

  useEffect(() => {
    controlsRef.current = { iterationsPerSecond, acceptance };
  }, [iterationsPerSecond, acceptance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const performanceMode = quality === "performance";
    let frame = 0;
    let visible = true;
    let active = false;
    let needsDraw = true;
    let previousTime = 0;
    let accumulator = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let origin = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };
    let lengths: number[] = [];
    const angles = [-0.55, 0.35, 0.4, -0.2, 0.15];
    let status: CcdStatus = "idle";
    let solveStartMs = 0;
    let solveElapsedMs = 0;
    let iterationCount = 0;

    const resetGeometry = (width: number, height: number) => {
      origin = { x: width * 0.1, y: height * 0.72 };
      const segment = Math.min(width * 0.175, 110);
      lengths = [segment, segment * 0.96, segment * 0.9, segment * 0.82, segment * 0.7];
      if (status === "idle") target = { x: width * 0.78, y: height * 0.28 };
      lastWidth = width;
      lastHeight = height;
      needsDraw = true;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) needsDraw = true;
    });
    const resizeObserver = new ResizeObserver(() => {
      needsDraw = true;
    });
    observer.observe(canvas);
    resizeObserver.observe(canvas);

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      active = true;
      status = "iterating";
      solveStartMs = performance.now();
      solveElapsedMs = 0;
      iterationCount = 0;
      accumulator = 0;
      needsDraw = true;
    };
    canvas.addEventListener("click", handleClick);

    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden) {
        previousTime = time;
        return;
      }
      const delta = Math.min(time - previousTime, 100);
      previousTime = time;
      if (!active && !needsDraw) return;
      const fitted = fitCanvas(canvas, performanceMode);
      const { context, width, height } = fitted;
      if (!context) return;
      if (width !== lastWidth || height !== lastHeight || lengths.length === 0) resetGeometry(width, height);

      if (active) {
        const controls = controlsRef.current;
        accumulator += delta * controls.iterationsPerSecond / 1000;
        // Limit work per frame at low iteration rates.
        let steps = 0;
        while (accumulator >= 1 && steps < 8) {
          ccdSweep(origin, lengths, angles, target);
          accumulator -= 1;
          iterationCount += 1;
          steps += 1;
          needsDraw = true;
        }
        const points = forwardKinematics(origin, lengths, angles);
        const end = points[points.length - 1];
        const error = Math.hypot(target.x - end.x, target.y - end.y);
        const elapsed = performance.now() - solveStartMs;
        if (error <= controls.acceptance) {
          active = false;
          status = "solved";
          solveElapsedMs = elapsed;
        } else if (iterationCount >= CCD_MAX_ITERATIONS || elapsed >= CCD_TIMEOUT_MS) {
          active = false;
          status = "timeout";
          solveElapsedMs = elapsed;
        }
        needsDraw = true; // keep painting while active so the live ms readout updates
      }

      if (!needsDraw) return;
      needsDraw = false;
      const points = forwardKinematics(origin, lengths, angles);
      const end = points[points.length - 1];
      const error = Math.hypot(target.x - end.x, target.y - end.y);
      drawGrid(context, width, height);
      drawChain(context, points, target, active);
      context.fillStyle = MUTED;
      context.font = "700 10px monospace";
      const statusLabel =
        status === "iterating"
          ? `SOLVER: ${(performance.now() - solveStartMs).toFixed(0)} MS`
          : status === "solved"
            ? `SOLVER: ${solveElapsedMs.toFixed(0)} MS`
            : status === "timeout"
              ? `SOLVER: TIMED OUT · ${solveElapsedMs.toFixed(0)} MS`
              : "SOLVER: CLICK A TARGET";
      context.fillText(statusLabel, 16, 24);
      context.textAlign = "right";
      context.fillText(`ERROR ${error.toFixed(1)} PX`, width - 16, 24);
      context.textAlign = "left";
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("click", handleClick);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [quality]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="block h-[clamp(340px,46vw,520px)] w-full cursor-crosshair"
        aria-label="Interactive CCD robot arm. Click a target to watch the arm solve toward it one iteration at a time."
      />
      <div className="grid gap-5 border-t border-text bg-surface p-5 md:grid-cols-2">
        <SliderRow label="Iterations / second" value={iterationsPerSecond} display={`${iterationsPerSecond}`} min={1} max={30} step={1} onChange={setIterationsPerSecond} />
        <SliderRow label="Accepted error" value={acceptance} display={`${acceptance} px`} min={1} max={30} step={1} onChange={setAcceptance} />
      </div>
    </div>
  );
}

function wrapAngle(angle: number) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function solveLinear3(matrix: number[][], vector: number[]) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-8) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let entry = column; entry < 4; entry += 1) rows[column][entry] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry < 4; entry += 1) rows[row][entry] -= factor * rows[column][entry];
    }
  }
  return rows.map((row) => row[3]);
}

function jacobianPoseStep(origin: Point, lengths: number[], angles: number[], target: Point, targetAngle: number, bendLimit: number) {
  const points = forwardKinematics(origin, lengths, angles);
  const end = points[points.length - 1];
  const positionDistance = Math.hypot(target.x - end.x, target.y - end.y);
  const positionScale = positionDistance > 36 ? 36 / positionDistance : 1;
  const orientationScale = lengths.reduce((sum, length) => sum + length, 0) * 0.16;
  const error = [
    (target.x - end.x) * positionScale,
    (target.y - end.y) * positionScale,
    wrapAngle(targetAngle - angles.reduce((sum, angle) => sum + angle, 0)) * orientationScale,
  ];
  const jacobian = [new Array(angles.length), new Array(angles.length), new Array(angles.length)];
  for (let joint = 0; joint < angles.length; joint += 1) {
    jacobian[0][joint] = -(end.y - points[joint].y);
    jacobian[1][joint] = end.x - points[joint].x;
    jacobian[2][joint] = orientationScale;
  }
  const normal = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) =>
      jacobian[row].reduce((sum, value, joint) => sum + value * jacobian[column][joint], row === column ? 225 : 0),
    ),
  );
  const correction = solveLinear3(normal, error);
  if (!correction) return;
  for (let joint = 0; joint < angles.length; joint += 1) {
    const delta = jacobian.reduce((sum, row, axis) => sum + row[joint] * correction[axis], 0);
    const clampedDelta = Math.max(-0.045, Math.min(0.045, delta));
    if (joint === 0) {
      angles[joint] = wrapAngle(angles[joint] + clampedDelta);
    } else {
      angles[joint] = Math.max(-bendLimit, Math.min(bendLimit, angles[joint] + clampedDelta));
    }
  }
}

function drawArrow(context: CanvasRenderingContext2D, origin: Point, angle: number, length: number, color: string, width: number, outline = false) {
  const tip = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  const head = Math.max(7, width * 1.6);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(tip.x, tip.y);
  context.lineTo(tip.x - Math.cos(angle - 0.55) * head, tip.y - Math.sin(angle - 0.55) * head);
  context.moveTo(tip.x, tip.y);
  context.lineTo(tip.x - Math.cos(angle + 0.55) * head, tip.y - Math.sin(angle + 0.55) * head);
  if (outline) {
    context.strokeStyle = INK;
    context.lineWidth = width + 2;
    context.stroke();
  }
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function JacobianCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bendLimit, setBendLimit] = useState(125);
  const [iterations, setIterations] = useState(4);
  const controlsRef = useRef({ bendLimit, iterations });
  const poseRef = useRef({
    target: { x: 0, y: 0 },
    angle: -0.35,
    arrowLength: 58,
    dragging: false,
    initialized: false,
  });
  const { quality } = useSettings();

  useEffect(() => {
    controlsRef.current = { bendLimit, iterations };
  }, [bendLimit, iterations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let visible = true;
    let previousTime = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    let origin = { x: 0, y: 0 };
    let lengths: number[] = [];
    const angles = [-0.45, 0.5, -0.35, 0.25, -0.15];
    const performanceMode = quality === "performance";
    const frameInterval = 1000 / (performanceMode ? 30 : 60);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden || time - previousTime < frameInterval) return;
      previousTime = time;
      const { context, width, height } = fitCanvas(canvas, performanceMode);
      if (!context) return;
      if (width !== lastWidth || height !== lastHeight || lengths.length === 0) {
        origin = { x: width * 0.5, y: height * 0.5 };
        const segment = Math.min(width * 0.155, 92);
        lengths = [segment, segment * 0.96, segment * 0.88, segment * 0.76, segment * 0.62];
        if (!poseRef.current.initialized) {
          poseRef.current.target = { x: width * 0.76, y: height * 0.34 };
          poseRef.current.initialized = true;
        } else if (lastWidth > 0 && lastHeight > 0) {
          poseRef.current.target.x *= width / lastWidth;
          poseRef.current.target.y *= height / lastHeight;
        }
        lastWidth = width;
        lastHeight = height;
      }
      const limit = controlsRef.current.bendLimit * Math.PI / 180;
      const passes = controlsRef.current.iterations;
      for (let pass = 0; pass < passes; pass += 1) {
        jacobianPoseStep(origin, lengths, angles, poseRef.current.target, poseRef.current.angle, limit);
      }
      const points = forwardKinematics(origin, lengths, angles);
      const end = points[points.length - 1];
      const endAngle = angles.reduce((sum, angle) => sum + angle, 0);
      const positionError = Math.hypot(poseRef.current.target.x - end.x, poseRef.current.target.y - end.y);
      const angleError = Math.abs(wrapAngle(poseRef.current.angle - endAngle)) * 180 / Math.PI;
      drawGrid(context, width, height);
      drawChain(context, points, poseRef.current.target, poseRef.current.dragging);
      drawArrow(context, poseRef.current.target, poseRef.current.angle, poseRef.current.arrowLength, INK, 2);
      drawArrow(context, end, endAngle, 42, ACCENT, 5, true);
      context.fillStyle = MUTED;
      context.font = "700 10px monospace";
      context.fillText(poseRef.current.dragging ? "POSE TARGET: PULL TO AIM" : "POSE TARGET: PRESS AND DRAG", 16, 24);
      context.textAlign = "right";
      context.fillText(`ERROR ${positionError.toFixed(1)} PX · ${angleError.toFixed(1)}°`, width - 16, 24);
      context.textAlign = "left";
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [quality]);

  const pointerPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(20, Math.min(rect.width - 20, clientX - rect.left)),
      y: Math.max(20, Math.min(rect.height - 20, clientY - rect.top)),
    };
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="block h-[clamp(340px,46vw,520px)] w-full touch-none cursor-crosshair"
        aria-label="Interactive Jacobian chain. Drag from a target position toward the desired end-effector direction."
        onPointerDown={(event) => {
          const point = pointerPoint(event.clientX, event.clientY);
          if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          poseRef.current.target = point;
          poseRef.current.dragging = true;
        }}
        onPointerMove={(event) => {
          if (!poseRef.current.dragging) return;
          const point = pointerPoint(event.clientX, event.clientY);
          if (!point) return;
          const delta = { x: point.x - poseRef.current.target.x, y: point.y - poseRef.current.target.y };
          const distance = Math.hypot(delta.x, delta.y);
          if (distance > 6) {
            poseRef.current.angle = Math.atan2(delta.y, delta.x);
            poseRef.current.arrowLength = Math.min(distance, 80);
          }
        }}
        onPointerUp={(event) => {
          poseRef.current.dragging = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { poseRef.current.dragging = false; }}
      />
      <div className="grid gap-5 border-t border-text bg-surface p-5 md:grid-cols-2">
        <SliderRow label="Iterations / frame" value={iterations} display={`${iterations}`} min={1} max={12} step={1} onChange={setIterations} />
        <SliderRow label="Bend limit / joint" value={bendLimit} display={`±${bendLimit}°`} min={35} max={170} step={5} onChange={setBendLimit} />
      </div>
    </div>
  );
}

function StudyPanel({ index, eyebrow, title, copy, children }: { index: string; eyebrow: string; title: string; copy: ReactNode; children: ReactNode }) {
  return (
    <article className="grid overflow-hidden border border-text bg-bg lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)]">
      <div className="min-w-0 border-b border-text lg:border-b-0 lg:border-r">{children}</div>
      <div className="flex flex-col p-[clamp(1.5rem,3vw,2.5rem)]">
        <div className="mb-10 flex items-center justify-between border-b border-border pb-3 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-text-muted">
          <span>{eyebrow}</span>
          <span className="font-doto text-[0.8rem] text-text">{index}</span>
        </div>
        <h3 className="m-0 font-doto text-[clamp(1.4rem,2.5vw,2.25rem)] font-black uppercase leading-[0.95] tracking-[-0.035em] text-text">{title}</h3>
        <div className="mt-6 space-y-4 text-[0.74rem] leading-[1.8] text-text-muted">{copy}</div>
      </div>
    </article>
  );
}

export function FabrikStudy() {
  return (
    <div className="mt-10 space-y-6">
      <StudyPanel
        index="06"
        eyebrow="Interactive 2D model"
        title="Pull the chain"
        copy={<><p>Move the pointer across the field to become the end-effector target. FABRIK alternates a backward reach from the target with a forward reach from the fixed base. Every correction preserves the length of each link.</p></>}
      >
        <FabrikCanvas />
      </StudyPanel>
      <StudyPanel
        index="07"
        eyebrow="Iteration breakdown"
        title="One pass, two directions"
        copy={<><p>The animation should begin with the end effector away from its goal. During the backward phase, place the tip on the target and reposition every parent at its stored link length. The base is allowed to move temporarily.</p><p>During the forward phase, restore the base to its anchor and rebuild the chain toward the tip. Repeating these two phases reduces the remaining error until it falls below the accepted distance.</p></>}
      >
        <OnePassFabrikCanvas />
      </StudyPanel>
    </div>
  );
}

export function CcdStudy() {
  return (
    <div className="mt-10">
      <StudyPanel
        index="06"
        eyebrow="Click-driven 2D model"
        title="Solve joint by joint"
        copy={(
          <>
            <p>
              CCD starts at the wrist, aligns the tip-to-target direction, then repeats toward the base.
              Joint limits are off so the arm cannot lock into an unreachable pose.
            </p>
            <p>
              Each sweep nudges the tip along a small arc; parents drag the moved tip further. Farther
              targets need more angular travel, and later sweeps correct earlier overshoot, so more
              iterations accumulate before the error drops below tolerance.
            </p>
          </>
        )}
      >
        <CcdCanvas />
      </StudyPanel>
    </div>
  );
}

export function JacobianStudy() {
  return (
    <div className="mt-10">
      <StudyPanel
        index="06"
        eyebrow="Interactive 2D pose model"
        title="Place and aim the tip"
        copy={<><p>The Jacobian reduces position and orientation error together, so every joint contributes to the same correction instead of taking a separate turn as in CCD. Iterations per frame controls how many solver steps run each tick — lower values let you watch each coordinated update. Bend limit constrains each joint symmetrically; tight limits can make a pose unreachable, leaving a visible residual error rather than breaking the chain.</p></>}
      >
        <JacobianCanvas />
      </StudyPanel>
    </div>
  );
}
