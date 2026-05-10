import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// Clip everything below y=0 so the ball appears to sink through the ground
const GROUND_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function BallModel() {
  const gltf = useGLTF("/ball.glb");

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = mats.map((m) => {
          const c = (m as THREE.Material).clone();
          (c as any).clippingPlanes = [GROUND_CLIP];
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      }
    });
    return clone;
  }, [gltf.scene]);

  return <primitive object={clonedScene} />;
}

useGLTF.preload("/ball.glb");
