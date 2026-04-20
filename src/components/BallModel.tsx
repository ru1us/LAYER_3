import { useGLTF } from "@react-three/drei";

export function BallModel() {
  const gltf = useGLTF("/ball.glb");
  return <primitive object={gltf.scene} />;
}

useGLTF.preload("/ball.glb");
