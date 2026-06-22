import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePepperStore } from '../hooks/usePepperState';
import * as THREE from 'three';

/**
 * 3D environment — a warm Scandinavian / IKEA-style living room. Pepper is a
 * social home robot, so it lives in a furnished lounge, not a lab. All props are
 * procedural primitives (no external models / HDRIs) so the build stays lean and
 * works offline. Palette: light oak, warm white, beige, with sage / mustard /
 * ochre accents (per IKEA STOCKHOLM Scandi guidance).
 */

const OAK = '#c8a36b';
const OAK_DARK = '#a8854f';
const WALL = '#ece6db';
const SOFA = '#c3bbac';
const SOFA_CUSHION = '#cfc8ba';
const RUG = '#ddd3c2';
const RUG_BORDER = '#b9ac95';
const SAGE = '#869a72';
const MUSTARD = '#d3a23f';
const OCHRE = '#c47a3d';
const BRASS = '#b08d57';
const POT = '#d9cdbb';

function OakFloor() {
  // Warm oak plane + faint plank seams running front-to-back.
  const seams = useMemo(() => Array.from({ length: 15 }, (_, i) => -3.75 + i * 0.5), []);
  return (
    <group position={[0, -0.25, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color={OAK} roughness={0.85} />
      </mesh>
      {seams.map((x) => (
        <mesh key={x} position={[x, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.012, 6]} />
          <meshBasicMaterial color={OAK_DARK} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Walls() {
  return (
    <group>
      {/* Back wall (warm white) + baseboard */}
      <mesh position={[0, 1.0, -3]} receiveShadow>
        <planeGeometry args={[8, 2.5]} />
        <meshStandardMaterial color={WALL} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.16, -2.97]}>
        <boxGeometry args={[8, 0.12, 0.04]} />
        <meshStandardMaterial color="#f3eee5" roughness={0.7} />
      </mesh>
      {/* Left wall + baseboard */}
      <mesh position={[-4, 1.0, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 2.5]} />
        <meshStandardMaterial color={WALL} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-3.97, -0.16, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[6, 0.12, 0.04]} />
        <meshStandardMaterial color="#f3eee5" roughness={0.7} />
      </mesh>

      {/* Window on the back wall — soft daylight */}
      <group position={[2.4, 1.15, -2.96]}>
        <mesh><boxGeometry args={[1.9, 1.5, 0.06]} /><meshStandardMaterial color="#f6f1e8" roughness={0.6} /></mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[1.66, 1.26]} />
          <meshStandardMaterial color="#dcebf4" emissive="#cfe4f2" emissiveIntensity={0.85} />
        </mesh>
        {/* Mullions */}
        <mesh position={[0, 0, 0.04]}><boxGeometry args={[0.04, 1.26, 0.02]} /><meshStandardMaterial color="#f6f1e8" /></mesh>
        <mesh position={[0, 0, 0.04]}><boxGeometry args={[1.66, 0.04, 0.02]} /><meshStandardMaterial color="#f6f1e8" /></mesh>
      </group>

      {/* Framed art on the back wall */}
      <WallArt position={[-2.2, 1.35, -2.95]} color={SAGE} w={0.7} h={0.9} />
      <WallArt position={[-1.25, 1.45, -2.95]} color={OCHRE} w={0.55} h={0.7} />
    </group>
  );
}

function WallArt({ position, color, w, h }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[w + 0.06, h + 0.06, 0.03]} /><meshStandardMaterial color={BRASS} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[w, h]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
    </group>
  );
}

function Sofa({ position, rotation = [0, 0, 0] }) {
  const cushion = (x) => (
    <mesh key={x} position={[x, 0.40, 0.02]} castShadow>
      <boxGeometry args={[0.66, 0.16, 0.78]} /><meshStandardMaterial color={SOFA_CUSHION} roughness={0.95} />
    </mesh>
  );
  return (
    <group position={position} rotation={rotation}>
      {/* seat base */}
      <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[2.2, 0.22, 0.9]} /><meshStandardMaterial color={SOFA} roughness={0.95} /></mesh>
      {/* backrest */}
      <mesh position={[0, 0.55, -0.36]} castShadow><boxGeometry args={[2.2, 0.5, 0.2]} /><meshStandardMaterial color={SOFA} roughness={0.95} /></mesh>
      {/* arms */}
      <mesh position={[-1.05, 0.42, 0]} castShadow><boxGeometry args={[0.18, 0.42, 0.9]} /><meshStandardMaterial color={SOFA} roughness={0.95} /></mesh>
      <mesh position={[1.05, 0.42, 0]} castShadow><boxGeometry args={[0.18, 0.42, 0.9]} /><meshStandardMaterial color={SOFA} roughness={0.95} /></mesh>
      {/* seat cushions */}
      {[-0.66, 0, 0.66].map(cushion)}
      {/* back cushions */}
      {[-0.66, 0, 0.66].map((x) => (
        <mesh key={`b${x}`} position={[x, 0.58, -0.27]} castShadow><boxGeometry args={[0.64, 0.34, 0.14]} /><meshStandardMaterial color={SOFA_CUSHION} roughness={0.95} /></mesh>
      ))}
      {/* accent throw pillows */}
      <mesh position={[-0.8, 0.56, 0.05]} rotation={[0, 0, 0.3]} castShadow><boxGeometry args={[0.34, 0.34, 0.12]} /><meshStandardMaterial color={MUSTARD} roughness={0.9} /></mesh>
      <mesh position={[0.8, 0.56, 0.05]} rotation={[0, 0, -0.2]} castShadow><boxGeometry args={[0.34, 0.34, 0.12]} /><meshStandardMaterial color={SAGE} roughness={0.9} /></mesh>
      {/* oak feet */}
      {[[-1, 0], [1, 0], [-1, 0.35], [1, 0.35]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.10, z - 0.3]}><cylinderGeometry args={[0.04, 0.03, 0.18, 10]} /><meshStandardMaterial color={OAK_DARK} /></mesh>
      ))}
    </group>
  );
}

function CoffeeTable({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.34, 0]} castShadow><cylinderGeometry args={[0.52, 0.52, 0.05, 32]} /><meshStandardMaterial color={OAK} roughness={0.6} /></mesh>
      <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.44, 0.44, 0.03, 32]} /><meshStandardMaterial color={OAK_DARK} roughness={0.7} /></mesh>
      {/* pedestal legs */}
      {[0.5, 2.6, 4.7].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.4, 0.22, Math.sin(a) * 0.4]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.4, 10]} /><meshStandardMaterial color={OAK_DARK} /></mesh>
      ))}
      {/* books on the lower shelf */}
      <mesh position={[-0.12, 0.18, 0.05]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.28, 0.04, 0.2]} /><meshStandardMaterial color={OCHRE} /></mesh>
      <mesh position={[-0.1, 0.22, 0.05]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.26, 0.035, 0.19]} /><meshStandardMaterial color={SAGE} /></mesh>
      {/* small vase on top */}
      <mesh position={[0.18, 0.42, -0.05]}><cylinderGeometry args={[0.05, 0.07, 0.16, 14]} /><meshStandardMaterial color="#e7e0d3" roughness={0.4} /></mesh>
    </group>
  );
}

function Rug({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <planeGeometry args={[3.2, 2.3]} /><meshStandardMaterial color={RUG_BORDER} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <planeGeometry args={[2.9, 2.0]} /><meshStandardMaterial color={RUG} roughness={1} />
      </mesh>
      {/* geometric stripes */}
      {[-0.7, 0, 0.7].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, z]}>
          <planeGeometry args={[2.5, 0.05]} /><meshBasicMaterial color={RUG_BORDER} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position, scale = 1 }) {
  // Pot + a fan of large leaves (monstera-ish).
  const leaves = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    a: (i / 7) * Math.PI * 2, tilt: 0.5 + (i % 3) * 0.18,
  })), []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]} castShadow><cylinderGeometry args={[0.16, 0.12, 0.36, 16]} /><meshStandardMaterial color={POT} roughness={0.5} /></mesh>
      <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.15, 0.15, 0.04, 16]} /><meshStandardMaterial color="#4a3b2a" /></mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={[Math.cos(l.a) * 0.1, 0.62, Math.sin(l.a) * 0.1]}
          rotation={[l.tilt, l.a, 0]} castShadow>
          <planeGeometry args={[0.28, 0.5]} />
          <meshStandardMaterial color={i % 2 ? '#5f8552' : SAGE} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function FloorLamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.16, 0.18, 0.04, 20]} /><meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.015, 0.015, 1.6, 8]} /><meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.62, 0]}><cylinderGeometry args={[0.18, 0.22, 0.26, 20, 1, true]} /><meshStandardMaterial color="#f3ead4" emissive="#ffdca0" emissiveIntensity={0.6} side={THREE.DoubleSide} roughness={0.7} /></mesh>
      <pointLight position={[0, 1.55, 0]} intensity={0.55} distance={4.5} decay={2} color="#ffd9a0" />
    </group>
  );
}

function Kallax({ position, rotation = [0, 0, 0] }) {
  // 2x2 cube shelf against the wall, filled with books / boxes / a plant.
  const cubes = [[-0.42, 0.42], [0.42, 0.42], [-0.42, 1.18], [0.42, 1.18]];
  const fills = [MUSTARD, SAGE, OCHRE, '#7c8a9c'];
  return (
    <group position={position} rotation={rotation}>
      {/* carcass */}
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[1.05, 1.05, 0.36]} /><meshStandardMaterial color="#efe9dd" roughness={0.7} /></mesh>
      {/* hollow look: dark inset back per cube */}
      {cubes.map(([x, y], i) => (
        <group key={i} position={[x, y, 0.02]}>
          <mesh position={[0, 0, 0.08]}><boxGeometry args={[0.6, 0.6, 0.2]} /><meshStandardMaterial color="#cfc7b6" roughness={0.8} /></mesh>
          {i % 2 === 0
            ? [0, 1, 2].map((b) => (
                <mesh key={b} position={[-0.16 + b * 0.11, -0.12, 0.16]}><boxGeometry args={[0.08, 0.34, 0.22]} /><meshStandardMaterial color={[MUSTARD, SAGE, OCHRE][b]} /></mesh>
              ))
            : <mesh position={[0, -0.1, 0.16]}><boxGeometry args={[0.42, 0.34, 0.24]} /><meshStandardMaterial color={fills[i]} roughness={0.85} /></mesh>}
        </group>
      ))}
    </group>
  );
}

function MediaUnit({ position }) {
  const tvRef = useRef();
  const searchResults = usePepperStore((s) => s.searchResults);
  const active = searchResults.length > 0;
  // The TV doubles as a status screen — it glows when a web search lands.
  useFrame(() => {
    const m = tvRef.current?.material;
    if (!m) return;
    const target = active ? 0.7 : 0.18;
    m.emissiveIntensity += (target - m.emissiveIntensity) * 0.06;
    m.emissive.set(active ? '#bfe3ff' : '#1b2630');
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]} castShadow><boxGeometry args={[1.6, 0.36, 0.4]} /><meshStandardMaterial color={OAK} roughness={0.6} /></mesh>
      {/* drawer lines */}
      <mesh position={[-0.4, 0.18, 0.21]}><boxGeometry args={[0.7, 0.28, 0.01]} /><meshStandardMaterial color={OAK_DARK} roughness={0.6} /></mesh>
      <mesh position={[0.4, 0.18, 0.21]}><boxGeometry args={[0.7, 0.28, 0.01]} /><meshStandardMaterial color={OAK_DARK} roughness={0.6} /></mesh>
      {/* TV */}
      <mesh position={[0, 0.82, -0.05]}><boxGeometry args={[1.25, 0.72, 0.04]} /><meshStandardMaterial color="#0c0f12" /></mesh>
      <mesh ref={tvRef} position={[0, 0.82, -0.028]}>
        <planeGeometry args={[1.16, 0.64]} />
        <meshStandardMaterial color="#0e1318" emissive="#1b2630" emissiveIntensity={0.18} />
      </mesh>
    </group>
  );
}

export default function Room() {
  return (
    <group>
      <OakFloor />
      <Walls />

      {/* Lounge tucked into the back-left so the centre + front floor stay
          clear for Pepper. (The sim has no collision — keep props off the
          walkable middle; the minimap mirrors these footprints.) */}
      <Rug position={[-1.5, -0.245, -2.05]} />
      <Sofa position={[-1.5, -0.25, -2.55]} />
      <CoffeeTable position={[-1.5, -0.25, -1.75]} />
      <Kallax position={[-3.75, -0.25, 0.9]} rotation={[0, Math.PI / 2, 0]} />
      <FloorLamp position={[-3.1, -0.25, -2.45]} />
      <Plant position={[3.4, -0.25, -2.5]} scale={1.15} />
      <Plant position={[-3.45, -0.25, -2.5]} scale={0.8} />
      <MediaUnit position={[1.9, -0.25, -2.7]} />
      <Plant position={[3.3, -0.25, 2.2]} scale={0.95} />

      {/* Lighting — soft, warm, Scandinavian daylight */}
      <hemisphereLight args={['#fff6e8', '#6b5a44', 0.65]} />
      <ambientLight intensity={0.22} color="#fff1dd" />
      <directionalLight position={[3.2, 5.5, 2.5]} intensity={1.05} color="#fff2dd" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      {/* cool fill from the window side */}
      <directionalLight position={[2.4, 2.5, -3]} intensity={0.3} color="#cfe0ee" />
    </group>
  );
}
