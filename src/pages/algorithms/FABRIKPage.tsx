import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import FishSim, { type SimParams, DEFAULT_SIM_PARAMS } from "../../components/FishSim.tsx";

const GH = "https://github.com/ru1us/LAYER_3";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[0.68rem] leading-relaxed bg-[#111] text-[#e8ff00] p-5 overflow-x-auto border border-[#333]">
      {children.trim()}
    </pre>
  );
}

function FolderBox({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="flex items-end">
        <div className="border border-b-0 border-border bg-surface flex items-center gap-3 px-5 py-2 shrink-0">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted">{tag}</span>
          <span className="font-doto text-sm text-text">{title}</span>
        </div>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="p-10">{children}</div>
    </div>
  );
}

// ── Simulation parameter slider ───────────────────────────────────────────
function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-3">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[#444]">{label}</span>
        <span className="font-doto text-[0.8rem] text-[#e8ff00]">{display(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer h-px border-0 outline-none appearance-none"
        style={{
          accentColor: "#e8ff00",
          background: `linear-gradient(to right, #e8ff00 ${pct}%, #2a2a2a ${pct}%)`,
          height: "1px",
        }}
      />
    </div>
  );
}


export default function FABRIKPage() {
  const paramsRef = useRef<SimParams>({ ...DEFAULT_SIM_PARAMS });

  const [maxBendDeg, setMaxBendDeg] = useState(45);
  const [orbitRadius, setOrbitRadius] = useState(1.44);
  const [forceStrength, setForceStrength] = useState(1.0);
  const [followSpeed, setFollowSpeed] = useState(0.4);

  function setParam<K extends keyof SimParams>(key: K, raw: number, converted: SimParams[K]) {
    if (key === "maxBend") setMaxBendDeg(raw as number);
    if (key === "orbitRadius") setOrbitRadius(raw as number);
    if (key === "forceStrength") setForceStrength(raw as number);
    if (key === "followSpeed") setFollowSpeed(raw as number);
    paramsRef.current = { ...paramsRef.current, [key]: converted };
  }

  return (
    <div className="bg-surface min-h-screen">
      {/* Header */}
      <div className="mx-auto max-w-5xl px-12 pt-16 pb-10">
        <Link
          to="/"
          className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
        >
          ← Back
        </Link>
        <div className="mt-8">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-3">
            Algorithm 02 · Three.js Implementation
          </p>
          <h1 className="font-doto text-5xl mb-4">FABRIK</h1>
          <p className="font-mono text-[0.78rem] leading-relaxed text-text-muted max-w-2xl">
            A walkthrough of how the fish simulation is built in Three.js — scene and camera
            setup, bone extraction from the GLB, steering forces, and writing solved positions
            back into 3D bone transforms.
          </p>
          <a
            href={GH}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 mt-5 border border-border px-4 py-2 hover:bg-[#f0f0f0] transition-colors"
          >
            <img src="/GitHub_Logo.svg" alt="GitHub" className="h-4 w-auto" />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em]">ru1us/LAYER_3</span>
          </a>
        </div>
      </div>

      {/* Blender section */}
      <div className="mx-auto max-w-5xl px-12 pb-12">
        <FolderBox tag="Blender" title="MESH_RIG">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">In Blender</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted mb-5">
                Before any code runs, the fish is built and rigged in Blender.
                The mesh is a low-poly body sculpted around a central spine.
                An <span className="text-text">Armature</span> with 6 spine bones
                (Bone → Bone005) is placed inside it, aligned to the fish’s
                natural curvature from head to tail.
              </p>
              <div className="h-px bg-border mb-5" />
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Weight Painting</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                Each bone is assigned a vertex weight group via{" "}
                <span className="text-text">weight painting</span>. Head vertices
                are bound primarily to Bone, tail vertices to Bone005, with
                smooth blending in between. The result: deforming any bone
                pulls its region of the mesh with it. The GLB export packages
                the mesh, skeleton, and weights into a single binary file.
              </p>
            </div>
          </div>
        </FolderBox>
      </div>

      {/* Sim + Sliders overlay */}
      <div className="relative">
        <FishSim paramsRef={paramsRef} />
        <div className="absolute bottom-0 left-0 right-0 z-20 px-12 py-10 pointer-events-none">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#444] mb-8">Simulation Parameters</p>
          <div className="grid grid-cols-2 gap-x-16 gap-y-8 max-w-2xl pointer-events-auto">
          <Slider
            label="Max Bend"
            value={maxBendDeg}
            min={5}
            max={90}
            step={1}
            display={(v) => `${v}°`}
            onChange={(v) => setParam("maxBend", v, (v * Math.PI) / 180)}
          />
          <Slider
            label="Orbit Radius"
            value={orbitRadius}
            min={0.3}
            max={4.0}
            step={0.05}
            display={(v) => v.toFixed(2)}
            onChange={(v) => setParam("orbitRadius", v, v)}
          />
          <Slider
            label="Reaction Time"
            value={forceStrength}
            min={0.2}
            max={3.0}
            step={0.1}
            display={(v) => `${v.toFixed(1)}×`}
            onChange={(v) => setParam("forceStrength", v, v)}
          />
          <Slider
            label="Follow"
            value={followSpeed}
            min={0.05}
            max={0.95}
            step={0.05}
            display={(v) => v.toFixed(2)}
            onChange={(v) => setParam("followSpeed", v, v)}
          />
        </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-12 py-12 space-y-10">
        <FolderBox tag="Step 01" title="CANVAS_SETUP">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The fish scene uses a React Three Fiber <span className="text-text">{"<Canvas>"}</span> with
                a top-down perspective camera positioned high on the Y axis and looking straight
                down at the XZ plane. An <span className="text-text">{"<Environment>"}</span> preset
                from Drei provides image-based PBR lighting without manually placing lights.
                A dark ground plane fills the frame and serves as the pointer event surface.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
<Canvas
  camera={{ position: [0, 12, 0], fov: 40 }}
  onPointerMove={onMove}
>
  <Environment preset="city" />
  <Plane
    args={[30, 30]}
    rotation={[-Math.PI / 2, 0, 0]}
    receiveShadow
  >
    <meshStandardMaterial color="#0a0a0a" />
  </Plane>
  <Fish />
</Canvas>
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 2 */}
        <FolderBox tag="Step 02" title="GLB_LOADER">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The fish GLB contains a <span className="text-text">SkinnedMesh</span> driven by
                a 6-bone spine. <span className="text-text">useGLTF</span> loads and caches it;
                <span className="text-text"> scene.traverse()</span> collects the bone chain in
                order. Segment lengths are extracted once at init by sampling each bone's
                world position — these become the fixed distances the FABRIK solver must maintain.
                The 3D positions are flattened to <span className="text-text">Vector2</span> in XZ.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
// Extract segment lengths from bone world positions
for (let i = 0; i < chain.length - 1; i++) {
  chain[i].getWorldPosition(a);
  chain[i + 1].getWorldPosition(b);
  segLens[i] = a.distanceTo(b); // fixed rest length
}

// Joints are 2D: x and z of the XZ plane
joints[i].set(worldPos.x, worldPos.z);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 3 */}
        <FolderBox tag="Step 03" title="STEERING">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                The fish doesn't teleport to the cursor — it has a{" "}
                <span className="text-text">simulated velocity</span> updated inside
                R3F's <span className="text-text">useFrame</span> every tick.
                Two steering forces act each frame: a <span className="text-text">Seek</span> force
                pulls the fish toward the cursor, and an <span className="text-text">Orbit</span> force
                pushes it tangentially to circle at a fixed radius. The orbit side (CW vs CCW) is
                preserved using the 2D cross product of the velocity and the to-target vector.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
const ORBIT_R = 1.44;

// Seek
const desired = toTarget.normalize() * MAX_SPEED * seekStrength;

// Orbit tangent – preserve side via cross product
const cross2d = toTarget.x * vel.y - toTarget.y * vel.x;
const perpSign = cross2d >= 0 ? 1 : -1;
const perp = new Vec2(-toTarget.y, toTarget.x)
             .multiplyScalar(perpSign).normalize();
const orbitForce = perp * MAX_SPEED * 0.85;

// Blend seek ↔ orbit by distance
const orbitWeight = max(0,
  1 - abs(dist - ORBIT_R) / (ORBIT_R * 2)
);
const steer = lerp(desired, orbitForce, orbitWeight);
vel += clamp(steer - vel, -MAX_FORCE, MAX_FORCE);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Section 4 */}
        <FolderBox tag="Step 04" title="BONE_WRITE">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Three.js</p>
              <p className="font-mono text-[0.76rem] leading-relaxed text-text-muted">
                Once FABRIK gives the 2D joint positions, these need to be converted back into
                3D bone rotations. The challenge: the Blender rig has a{" "}
                <span className="text-text">−90° rest rotation</span> on the root bone.
                Applying angles naively causes roll artifacts. The solution: store each bone's{" "}
                <span className="text-text">world quaternion at rest</span>, compute only
                the yaw delta, and apply it as a pure Y-axis rotation offset.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-text-muted mb-4">Code</p>
              <CodeBlock>{`
// Rest forward direction of this bone in world XZ
const localFwd = new Vec3(0, 1, 0)
  .applyQuaternion(restWorldQ[i]);
const restYaw    = atan2(localFwd.x, localFwd.z);

// Desired yaw from FABRIK joint positions
const desiredYaw = atan2(dx, dz);
const deltaYaw   = desiredYaw - restYaw;

// Apply as pure world-Y rotation (no roll)
const qDelta = new Quat()
  .setFromAxisAngle(Y_AXIS, deltaYaw);
const qWorld = qDelta.multiply(restWorldQ[i]);
bone.quaternion.copy(
  parentWorldQ.invert().multiply(qWorld)
);
              `}</CodeBlock>
            </div>
          </div>
        </FolderBox>

        {/* Footer */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <Link
            to="/pages/ccd"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
          >
            ← Algorithm 01 — CCD
          </Link>
          <Link
            to="/"
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text hover:text-text-muted transition-colors"
          >
            Back to overview →
          </Link>
        </div>
      </div>
    </div>
  );
}
