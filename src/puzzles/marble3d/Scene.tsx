"use client";

import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { Level, Placed } from "./levels";
import { MARBLE_RADIUS, TUBE_RADIUS, cellCentre, placedPath, type CellRef, type PieceType, type Vec3 } from "./track";
import { boardTexture, buildCellTexture } from "./textures";

/**
 * The marble run in 3D. A wooden pegboard stands upright; clear candy
 * plastic tubes are mounted on it, clicked together with white collars at
 * every join. Everything is built in code (no downloaded models or
 * textures), and it's lit by a studio made of glowing panels, so the
 * plastic and the marble catch real highlights.
 */

export const PIECE_COLORS: Record<PieceType, string> = {
  straight: "#FF8A1F",
  curve: "#F0508F",
  loop: "#FFC21A",
};
const FIXED_COLOR = "#8FD3FF";
const BOARD_Z = -0.32;
const BOARD_MARGIN = 0.3;

const v = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);

/** A path through a list of points, walked at an even speed (so tubes and collars sit where you'd expect). */
class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  private lengths: number[] = [0];
  constructor(private points: THREE.Vector3[]) {
    super();
    for (let i = 1; i < points.length; i++) this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const total = this.lengths[this.lengths.length - 1];
    const d = Math.min(Math.max(t, 0), 1) * total;
    let i = 1;
    while (i < this.lengths.length - 1 && this.lengths[i] < d) i++;
    const span = this.lengths[i] - this.lengths[i - 1] || 1;
    return target.copy(this.points[i - 1]).lerp(this.points[i], (d - this.lengths[i - 1]) / span);
  }
}

function Collar({ at, towards }: { at: THREE.Vector3; towards: THREE.Vector3 }) {
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), towards.clone().sub(at).normalize()), [at, towards]);
  return (
    <mesh position={at} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[TUBE_RADIUS * 1.22, TUBE_RADIUS * 1.22, 0.07, 28]} />
      <meshPhysicalMaterial color="#FFF7E8" roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} />
    </mesh>
  );
}

export function Piece({ piece, rows, fixed = false, ghost = false }: { piece: Placed; rows: number; fixed?: boolean; ghost?: boolean }) {
  const { points } = useMemo(() => placedPath(piece.type, piece.turns, piece, rows), [piece, rows]);
  const vectors = useMemo(() => points.map(v), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(new PolylineCurve(vectors), vectors.length * 3, TUBE_RADIUS, 28, false), [vectors]);
  const color = fixed ? FIXED_COLOR : PIECE_COLORS[piece.type];
  return (
    <group>
      <mesh geometry={geometry} castShadow renderOrder={2}>
        <meshPhysicalMaterial
          color={color}
          roughness={0.08}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={ghost ? 0.3 : 0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {!ghost && (
        <>
          <Collar at={vectors[0]} towards={vectors[1]} />
          <Collar at={vectors[vectors.length - 1]} towards={vectors[vectors.length - 2]} />
        </>
      )}
    </group>
  );
}

function Board({ level }: { level: Level }) {
  const width = level.cols + BOARD_MARGIN * 2;
  const height = level.rows + BOARD_MARGIN * 2;
  const texture = useMemo(() => boardTexture(width, height), [width, height]);
  return (
    <group position={[level.cols / 2, level.rows / 2, BOARD_Z]}>
      <RoundedBox args={[width + 0.12, height + 0.12, 0.2]} radius={0.08} smoothness={4} position={[0, 0, -0.1]} castShadow>
        <meshStandardMaterial color="#B8773E" roughness={0.6} />
      </RoundedBox>
      {/* The painted face sits on its own plane, so the wood and peg holes map cleanly. */}
      <mesh position={[0, 0, 0.001]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.75} />
      </mesh>
    </group>
  );
}

function BuildCell({ cell, rows, glow }: { cell: CellRef; rows: number; glow: boolean }) {
  const texture = useMemo(() => buildCellTexture(), []);
  const c = cellCentre(cell, rows);
  return (
    <mesh position={[c.x, c.y, BOARD_Z + 0.005]}>
      <planeGeometry args={[0.94, 0.94]} />
      <meshBasicMaterial map={texture} color={glow ? "#FFD34D" : "#FFFFFF"} transparent opacity={glow ? 1 : 0.85} toneMapped={false} />
    </mesh>
  );
}

/** The clear tube above the board the marble waits in. */
function StartTube({ level }: { level: Level }) {
  const x = level.start + 0.5;
  const y = level.rows + 0.3;
  return (
    <group position={[x, y, 0]}>
      <mesh renderOrder={2}>
        <cylinderGeometry args={[TUBE_RADIUS, TUBE_RADIUS, 0.6, 28, 1, true]} />
        <meshPhysicalMaterial color="#DDEEFF" roughness={0.05} clearcoat={1} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[TUBE_RADIUS * 1.3, TUBE_RADIUS * 1.3, 0.08, 28]} />
        <meshPhysicalMaterial color="#2F6BEA" roughness={0.2} clearcoat={1} />
      </mesh>
      <Collar at={new THREE.Vector3(0, -0.3, 0)} towards={new THREE.Vector3(0, 0, 0)} />
    </group>
  );
}

/** The goal: a green plastic bucket with a waving flag. */
function Bucket({ level }: { level: Level }) {
  const c = cellCentre(level.cup, level.rows);
  const profile = useMemo(
    () => [new THREE.Vector2(0, 0), new THREE.Vector2(0.24, 0), new THREE.Vector2(0.3, 0.34), new THREE.Vector2(0.33, 0.36), new THREE.Vector2(0.3, 0.37)],
    [],
  );
  return (
    <group position={[c.x, c.y - 0.46, 0]}>
      <mesh castShadow>
        <latheGeometry args={[profile, 40]} />
        <meshPhysicalMaterial color="#22A94F" roughness={0.2} clearcoat={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.18, 0.55, -0.1]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.75, 8]} />
        <meshStandardMaterial color="#FFF7E8" />
      </mesh>
      <mesh position={[0.3, 0.82, -0.1]} castShadow>
        <shapeGeometry args={[flagShape()]} />
        <meshPhysicalMaterial color="#FFC21A" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function flagShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.12, 0.1);
  s.lineTo(0.16, 0);
  s.lineTo(-0.12, -0.1);
  s.closePath();
  return s;
}

export function Marble({ at }: { at: Vec3 }) {
  return (
    <mesh position={[at.x, at.y, at.z]} castShadow renderOrder={1}>
      <sphereGeometry args={[MARBLE_RADIUS, 48, 32]} />
      <meshPhysicalMaterial color="#E8322B" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0} />
    </mesh>
  );
}

/** Frame the board: a gentle three-quarter view, from a little above and to the right. */
function Rig({ level }: { level: Level }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const w = level.cols + BOARD_MARGIN * 2 + 0.25;
    const h = level.rows + BOARD_MARGIN + 0.75; // the bottom margin, plus room for the start tube poking out of the top
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const aspect = size.width / size.height;
    const distance = Math.max(h / 2 / Math.tan(half), w / 2 / (Math.tan(half) * aspect));
    const target = new THREE.Vector3(level.cols / 2, level.rows / 2 + 0.2, 0);
    cam.position.set(target.x + distance * 0.1, target.y + distance * 0.12, distance * 0.99);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size, level]);
  return null;
}

export type SceneProps = { level: Level; placed: Placed[]; marble: Vec3 | null; hoverCell?: CellRef | null };

export function MarbleScene({ level, placed, marble, hoverCell = null }: SceneProps) {
  const startAt: Vec3 = { x: level.start + 0.5, y: level.rows + 0.3, z: 0 };
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 28, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
      <Rig level={level} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[level.cols / 2 - 3, level.rows + 5, 7]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 1, 3]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 0, 3]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={2} position={[2, 3, 6]} scale={1.5} />
      </Environment>

      <Board level={level} />
      {level.open.map((cell) => (
        <BuildCell key={`${cell.col},${cell.row}`} cell={cell} rows={level.rows} glow={hoverCell?.col === cell.col && hoverCell?.row === cell.row} />
      ))}
      <StartTube level={level} />
      <Bucket level={level} />
      {level.fixed.map((p) => (
        <Piece key={`f${p.col},${p.row}`} piece={p} rows={level.rows} fixed />
      ))}
      {placed.map((p) => (
        <Piece key={`p${p.col},${p.row}`} piece={p} rows={level.rows} />
      ))}
      <Marble at={marble ?? startAt} />
    </Canvas>
  );
}
