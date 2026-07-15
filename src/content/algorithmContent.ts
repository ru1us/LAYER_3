export type AlgorithmKey = "fabrik" | "ccd" | "jacobian";

export interface AlgorithmCopy {
  number: string;
  title: string;
  shortLabel: string;
  overview: string;
  homeIntroTitle: string;
  homeIntro: string;
  homeMethodTitle: string;
  homeMethod: string;
  homeSteps: string[];
  homeStats: { label: string; value: string }[];
  detailSections: { label: string; text: string }[];
}

export const algorithmContent: Record<AlgorithmKey, AlgorithmCopy> = {
  fabrik: {
    number: "02",
    title: "FABRIK",
    shortLabel: "position-based fish spine",
    overview:
      "FABRIK controls the fish by moving the positions of its spine joints instead of solving for every rotation directly. It is a good fit for a soft, organic chain because the body can follow a curve rather than snapping into a rigid robotic pose.",
    homeIntroTitle: "Forward and inverse kinematics",
    homeIntro:
      "Forward kinematics starts with the joints: choose their rotations and calculate where the tip ends up. Inverse kinematics starts with the goal: choose where the tip should be and let the computer find a believable pose. This fish uses the inverse approach, while forward kinematics is still used to carry the solved spine transforms through the 3D rig.",
    homeMethodTitle: "How FABRIK reaches the target",
    homeMethod:
      "The solver places the head on the moving target, then rebuilds the rest of the spine one segment at a time. Every segment keeps its original length, so the chain cannot stretch. A bend limit stops neighboring bones from folding through each other. The result is a quick, stable curve that feels more like a body following a path than a collection of disconnected joints.",
    homeSteps: [
      "The pointer becomes a target on the water surface.",
      "The head follows that target while each spine segment keeps its length.",
      "A maximum bend keeps the fish from making impossible sharp turns.",
      "The solved 2D curve is converted back into smooth 3D bone rotations.",
    ],
    homeStats: [
      { label: "Spine joints", value: "6" },
      { label: "Solver", value: "Forward reaching" },
      { label: "Bend limit", value: "30° default" },
    ],
    detailSections: [
      {
        label: "Implementation",
        text:
          "The fish is a weighted Blender mesh around a six-bone spine. At startup, the implementation reads the bones' world positions and stores the resting distance between each pair. The solver works on those positions in the XZ plane, then maps the result back to the original Three.js bones.",
      },
      {
        label: "Movement",
        text:
          "The fish does not teleport to the cursor. A seek force pulls it toward the pointer, while an orbit force makes it circle naturally when it gets close. This gives the target a little momentum and makes the motion read as swimming rather than cursor tracking.",
      },
      {
        label: "Realism and performance",
        text:
          "The bend limit protects the silhouette, and interpolation keeps the bone motion soft. The solver reuses the persistent chain each frame instead of creating a new chain, while controls such as bend, orbit radius, reaction time, and follow speed make the trade-offs visible.",
      },
    ],
  },
  ccd: {
    number: "01",
    title: "CCD_IK",
    shortLabel: "cursor-following robot arm",
    overview:
      "Cyclic Coordinate Descent (CCD) reaches for a target one joint at a time. Starting at the hand, it turns each joint just enough to bring the hand closer, then repeats the sweep until the arm is close enough.",
    homeIntroTitle: "A robot arm that follows you",
    homeIntro:
      "The robot demonstrates inverse kinematics in its most direct form: move the cursor and the end of the arm tries to follow. Instead of asking you to set six angles by hand, the solver continuously works backward from the desired hand position.",
    homeMethodTitle: "How CCD moves the arm",
    homeMethod:
      "CCD checks the hand, the target, and one joint at a time. It measures the smallest turn that points the hand more toward the target, applies the joint's limits, updates the chain, and moves toward the base. Several short passes are more reliable than one large guess.",
    homeSteps: [
      "The cursor is projected onto a 3D surface in front of the robot.",
      "The solver starts with the joint closest to the hand.",
      "Each joint turns toward the target without exceeding its safe range.",
      "Eight quick passes refine the pose before the next frame.",
    ],
    homeStats: [
      { label: "Arm joints", value: "6" },
      { label: "Passes / frame", value: "8" },
      { label: "Motion", value: "Per-joint smoothing" },
    ],
    detailSections: [
      {
        label: "Implementation",
        text:
          "The GLB model is loaded with useGLTF and its named bones are collected once. Each bone has a permitted rotation axis and angle range, so the solver can work with the actual rig instead of treating the arm as an abstract chain.",
      },
      {
        label: "Pointer to target",
        text:
          "A ray from the camera intersects a ground plane and a vertical plane. The closer valid hit becomes the 3D goal, then it is gently interpolated so small pointer movements do not produce nervous arm motion.",
      },
      {
        label: "Realism and performance",
        text:
          "The solved pose is kept separate from the visible pose and each joint eases toward it at its own speed. The base moves slowly while the hand follows faster, creating a small follow-through. The idle lean adds a restrained breathing-like motion when the robot is not being controlled. Temporary vectors are reused in the frame loop to avoid unnecessary allocations.",
      },
    ],
  },
  jacobian: {
    number: "03",
    title: "JACOBIAN_IK",
    shortLabel: "whole-body spider movement",
    overview:
      "The Jacobian solver looks at how every joint could move the foot right now. It combines those small suggestions and moves the whole leg together, which is useful for a spider that needs to keep several feet planted.",
    homeIntroTitle: "A shared plan for every joint",
    homeIntro:
      "A Jacobian is a compact map of cause and effect: it describes how a small turn at each joint would move the foot. You do not need to read the matrix to see the idea — the spider uses it to choose a coordinated response instead of bending only one joint at a time.",
    homeMethodTitle: "How the spider stays grounded",
    homeMethod:
      "For each leg, the solver compares the current foot position with its ground target. It estimates the useful direction for every joint, combines those directions, and applies a small update to all joints. Damping makes the response stable when a leg is stretched into a difficult pose.",
    homeSteps: [
      "Each leg keeps a target point on the ground.",
      "The solver measures how each joint can help the foot move toward it.",
      "Damping prevents wild movements when the leg has few good options.",
      "Joint limits and smooth stepping keep the result believable.",
    ],
    homeStats: [
      { label: "Leg chains", value: "8" },
      { label: "Method", value: "Damped least squares" },
      { label: "Joint cap", value: "45°" },
    ],
    detailSections: [
      {
        label: "Implementation",
        text:
          "Every leg is read from the spider rig as a small chain. Each frame, the code builds a Jacobian from the current world-space joint axes and the foot position. This turns the rig's local rotations into a practical estimate of how each joint affects the foot.",
      },
      {
        label: "Stable solving",
        text:
          "The implementation uses damped least squares rather than a plain inverse. In everyday terms, the damping acts like a brake: when the leg is in an awkward or stretched pose, it prefers a smaller safe correction over an unstable one.",
      },
      {
        label: "Realism and performance",
        text:
          "Joint rotations are clamped to the measured rig limits. Feet are given fixed ground targets and step toward new targets with a lifted arc, while the head follows the cursor with a soft limit. The solver uses fixed-size typed buffers and preallocated vectors so eight legs can be updated every frame without constant garbage collection.",
      },
    ],
  },
};
