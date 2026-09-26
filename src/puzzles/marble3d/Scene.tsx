"use client";

import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIXED_COLOR, PIECE_COLORS } from "./colors";
import { TABLE_Y, TICK, type Run, type RunEvent } from "./engine";
import type { Level, Placed } from "./levels";
import { MARBLE_RADIUS, TUBE_RADIUS, cellCentre, placedPath, type CellRef, type Vec3 } from "./track";
import { boardTexture, buildCellTexture, tableTexture } from "./textures";

/**
 * The marble run in 3D. A wooden pegboard stands upright; clear candy
 * plastic tubes are mounted on it, clicked together with white collars at
 * every join. Everything is built in code (no downloaded models or
 * textures), and it's lit by a studio made of glowing panels, so the
 * plastic and the marble catch real highlights.
 */

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

export function Piece({ piece, rows, fixed = false, ghost = false, pulse = false }: { piece: Placed; rows: number; fixed?: boolean; ghost?: boolean; pulse?: boolean }) {
  const { points } = useMemo(() => placedPath(piece.type, piece.turns, piece, rows), [piece, rows]);
  const vectors = useMemo(() => points.map(v), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(new PolylineCurve(vectors), vectors.length * 3, TUBE_RADIUS, 28, false), [vectors]);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  // The hint breathes in and out, so it reads as "put one here", not as a real piece.
  useFrame(({ clock }) => {
    if (pulse && material.current) material.current.opacity = 0.2 + ((Math.sin(clock.elapsedTime * 4) + 1) / 2) * 0.35;
  });
  const color = fixed ? FIXED_COLOR : PIECE_COLORS[piece.type];
  return (
    <group>
      <mesh geometry={geometry} castShadow={!ghost} renderOrder={2}>
        <meshPhysicalMaterial
          ref={material}
          color={color}
          roughness={0.08}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={ghost ? 0.4 : 0.5}
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

/** The table the board stands on, where a marble that flies off lands and bounces. */
function Table({ level }: { level: Level }) {
  const width = level.cols + 8;
  const texture = useMemo(() => tableTexture(width, 5), [width]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[level.cols / 2, TABLE_Y, 2]} receiveShadow>
      <planeGeometry args={[width, 5]} />
      <meshStandardMaterial map={texture} roughness={0.55} />
    </mesh>
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

function BuildCell({ cell, rows, glow, filled }: { cell: CellRef; rows: number; glow: boolean; filled: boolean }) {
  const texture = useMemo(() => buildCellTexture(), []);
  const c = cellCentre(cell, rows);
  return (
    <mesh position={[c.x, c.y, BOARD_Z + 0.005]}>
      <planeGeometry args={[0.94, 0.94]} />
      <meshBasicMaterial map={texture} color={glow ? "#FFD34D" : "#FFFFFF"} transparent opacity={glow ? 1 : filled ? 0.3 : 0.85} toneMapped={false} />
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
      {/* An open rim, so each new marble visibly drops in. */}
      <mesh position={[0, 0.3, 0]} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[TUBE_RADIUS * 1.05, 0.035, 12, 40]} />
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

export type PlayingRun = Run & { startedAt: number };

/**
 * The marble. Waiting, it sits in the start tube (dropping in from above
 * each time a new one arrives); running, it follows the run's frames at 60
 * a second, turning as it rolls, and reports sounds and the finish.
 */
function Marble({ level, run, spawnedAt, onEvent, onEnd }: { level: Level; run: PlayingRun | null; spawnedAt: number; onEvent: (kind: RunEvent["kind"]) => void; onEnd: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const heard = useRef(-1);
  const ended = useRef<PlayingRun | null>(null);
  const last = useRef(new THREE.Vector3());
  const rest = useMemo(() => new THREE.Vector3(level.start + 0.5, level.rows + 0.3, 0), [level]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const now = performance.now();
    if (!run) {
      // A new marble drops into the tube.
      const t = Math.min((now - spawnedAt) / 350, 1);
      m.position.set(rest.x, rest.y + (1 - t * t) * 0.6, rest.z);
      m.scale.setScalar(0.4 + 0.6 * t);
      last.current.copy(m.position);
      heard.current = -1;
      return;
    }
    m.scale.setScalar(1);
    const tick = Math.floor((now - run.startedAt) / (TICK * 1000));
    const f = run.frames[Math.min(tick, run.frames.length - 1)];
    m.position.set(f.x, f.y, f.z);

    // Roll: turn about the axis across the direction of travel, by the distance covered.
    const moved = m.position.clone().sub(last.current);
    const distance = moved.length();
    if (distance > 1e-5) {
      const axis = new THREE.Vector3(0, 0, 1).cross(moved).normalize();
      m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, -distance / MARBLE_RADIUS));
    }
    last.current.copy(m.position);

    for (const e of run.events) if (e.tick > heard.current && e.tick <= tick) onEvent(e.kind);
    heard.current = Math.max(heard.current, tick);
    if (tick >= run.frames.length && ended.current !== run) {
      ended.current = run;
      onEnd();
    }
  });

  return (
    <mesh ref={mesh} castShadow renderOrder={1}>
      <sphereGeometry args={[MARBLE_RADIUS, 48, 32]} />
      <meshPhysicalMaterial color="#E8322B" roughness={0.04} metalness={0.1} clearcoat={1} clearcoatRoughness={0} />
      {/* A pale swirl, so you can see it roll. */}
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[MARBLE_RADIUS * 0.92, MARBLE_RADIUS * 0.12, 12, 48]} />
        <meshPhysicalMaterial color="#FFD9D2" roughness={0.1} clearcoat={1} />
      </mesh>
    </mesh>
  );
}

/** Where things are on screen, for the buttons laid over the board. Pixels, relative to the scene's box. */
export type SceneView = {
  cellRect: (cell: CellRef) => { left: number; top: number; width: number; height: number };
  cellAt: (x: number, y: number) => CellRef | null;
};

/** Frame the board: a gentle three-quarter view, from a little above and to the right. */
function Rig({ level, onView }: { level: Level; onView: (view: SceneView) => void }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const w = level.cols + BOARD_MARGIN * 2 + 0.25;
    const h = level.rows + BOARD_MARGIN + 0.75 + 0.35; // the bottom margin, room for the start tube poking out of the top, and a strip of table
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const aspect = size.width / size.height;
    const distance = Math.max(h / 2 / Math.tan(half), w / 2 / (Math.tan(half) * aspect));
    const target = new THREE.Vector3(level.cols / 2, level.rows / 2 + 0.05, 0);
    cam.position.set(target.x + distance * 0.1, target.y + distance * 0.12, distance * 0.99);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const frozen = cam.clone();
    const toScreen = (x: number, y: number) => {
      const p = new THREE.Vector3(x, y, 0).project(frozen);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    };
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    onView({
      cellRect(cell) {
        const c = cellCentre(cell, level.rows);
        const corners = [toScreen(c.x - 0.5, c.y - 0.5), toScreen(c.x + 0.5, c.y - 0.5), toScreen(c.x - 0.5, c.y + 0.5), toScreen(c.x + 0.5, c.y + 0.5)];
        const left = Math.min(...corners.map((p) => p.x));
        const top = Math.min(...corners.map((p) => p.y));
        return { left, top, width: Math.max(...corners.map((p) => p.x)) - left, height: Math.max(...corners.map((p) => p.y)) - top };
      },
      cellAt(x, y) {
        raycaster.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, 1 - (y / size.height) * 2), frozen);
        const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        if (!hit) return null;
        const col = Math.floor(hit.x);
        const row = level.rows - 1 - Math.floor(hit.y);
        return col >= 0 && col < level.cols && row >= 0 && row < level.rows ? { col, row } : null;
      },
    });
  }, [camera, size, level, onView]);
  return null;
}

export type SceneProps = {
  level: Level;
  placed: Placed[];
  /** Open cells get the dashed "build here" mark; empty in free build, where every cell is open. */
  marked: CellRef[];
  hoverCell: CellRef | null;
  /** A see-through piece: where a dragged piece would snap to. */
  preview: Placed | null;
  /** The hint: a breathing see-through piece. */
  hint: Placed | null;
  run: PlayingRun | null;
  spawnedAt: number;
  onView: (view: SceneView) => void;
  onEvent: (kind: RunEvent["kind"]) => void;
  onEnd: () => void;
};

export function MarbleScene({ level, placed, marked, hoverCell, preview, hint, run, spawnedAt, onView, onEvent, onEnd }: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 28, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }} style={{ pointerEvents: "none" }}>
      <Rig level={level} onView={onView} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[level.cols / 2 - 3, level.rows + 5, 7]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 1, 3]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 0, 3]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={2} position={[2, 3, 6]} scale={1.5} />
      </Environment>

      <Table level={level} />
      <Board level={level} />
      {marked.map((cell) => (
        <BuildCell
          key={`${cell.col},${cell.row}`}
          cell={cell}
          rows={level.rows}
          glow={hoverCell?.col === cell.col && hoverCell?.row === cell.row}
          filled={placed.some((p) => p.col === cell.col && p.row === cell.row)}
        />
      ))}
      <StartTube level={level} />
      <Bucket level={level} />
      {level.fixed.map((p) => (
        <Piece key={`f${p.col},${p.row}`} piece={p} rows={level.rows} fixed />
      ))}
      {placed.map((p) => (
        <Piece key={`p${p.col},${p.row},${p.type},${p.turns}`} piece={p} rows={level.rows} />
      ))}
      {preview && <Piece key="preview" piece={preview} rows={level.rows} ghost />}
      {hint && <Piece key="hint" piece={hint} rows={level.rows} ghost pulse />}
      <Marble level={level} run={run} spawnedAt={spawnedAt} onEvent={onEvent} onEnd={onEnd} />
    </Canvas>
  );
}
