/* eslint-disable react/no-unknown-property -- R3F JSX elements take three.js props (geometry, args, intensity…), not DOM attributes */
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {DUR, EASE, gsap} from '~/lib/motion';
import type {Flavour} from '~/lib/flavours';
import {drawCanLabel} from '~/components/product/canLabel';

/**
 * 3D product viewer (React Three Fiber v8, three r186): a stylised 330 ml
 * Sunfizz can that slowly turns on its own and leans a little toward the
 * mouse (damped parallax tilt, no drag). Fizz bubbles rise around it.
 * One can for a flavour, a ring of four for the variety pack.
 *
 * Loaded lazily and client-only by ProductStage. Renders continuously only
 * while on screen and motion is allowed; otherwise it draws on demand.
 */

// ---------- tunables ----------

const SPIN_SPEED = 0.42; // rad/s auto-rotate (~15 s per turn)
const REST_TILT_Z = 0.1; // resting lean, matches the packshot's -6°
const TILT = {
  x: 0.22, // rad forward/back at the screen edge
  y: 0.45, // rad turn toward the pointer
  z: 0.1, // rad extra lean
  shift: 0.12, // world units of drift
  lambda: 3.5, // damping: higher = snappier follow
};
const FIZZ_COUNT = 34;
const DROPLET_COUNT = 180;
const CAMERA = {fov: 26, z: 8};

// ---------- geometry (shared between cans, built once) ----------

const R = 0.5; // can radius, world units
const BODY_Y0 = 0.2;
const BODY_H = 1.85;
const CAN_H = 2.4;

type CanGeometry = {
  body: THREE.CylinderGeometry;
  shoulder: THREE.LatheGeometry;
  lid: THREE.LatheGeometry;
  base: THREE.LatheGeometry;
  foot: THREE.LatheGeometry;
  tab: THREE.ExtrudeGeometry;
  droplet: THREE.SphereGeometry;
  dropletMatrices: THREE.Matrix4[];
};

let geometry: CanGeometry | null = null;

const lathe = (points: Array<[number, number]>) =>
  new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    96,
  );

function canGeometry(): CanGeometry {
  if (geometry) return geometry;

  // Open cylinder; thetaStart -π puts u = 0.5 (the label's front) at +z, facing the camera.
  const body = new THREE.CylinderGeometry(R, R, BODY_H, 96, 1, true, -Math.PI, Math.PI * 2);
  body.translate(0, BODY_Y0 + BODY_H / 2, 0);

  const shoulder = lathe([
    [R, BODY_Y0 + BODY_H],
    [0.495, 2.12],
    [0.47, 2.2],
    [0.435, 2.27],
    [0.415, 2.31],
  ]);
  const lid = lathe([
    [0.415, 2.31],
    [0.408, 2.335],
    [0.42, 2.355],
    [0.425, 2.375],
    [0.412, 2.392],
    [0.392, 2.386],
    [0.382, 2.36],
    [0.2, 2.352],
    [0, 2.35],
  ]);
  const base = lathe([
    [0.46, 0.075],
    [0.485, 0.13],
    [R, BODY_Y0],
  ]);
  const foot = lathe([
    [0, 0.1],
    [0.3, 0.03],
    [0.36, 0.0],
    [0.41, 0.012],
    [0.445, 0.045],
    [0.46, 0.075],
  ]);

  // Pull tab: a rounded plate with a finger hole, lying on the lid.
  const shape = new THREE.Shape();
  const w = 0.13;
  const h = 0.22;
  shape.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false);
  shape.absarc(0, -h / 2 + w / 2, w / 2, Math.PI, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absellipse(0, h / 2 - w / 2 - 0.005, w * 0.3, w * 0.24, 0, Math.PI * 2, false, 0);
  shape.holes.push(hole);
  const tab = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.004,
    bevelSegments: 2,
    curveSegments: 16,
  });
  tab.rotateX(-Math.PI / 2);
  tab.translate(0, 2.362, 0.07);

  // Condensation: tiny flattened beads stuck to the body, seeded.
  const droplet = new THREE.SphereGeometry(1, 10, 8);
  const dropletMatrices: THREE.Matrix4[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const normal = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < DROPLET_COUNT; i++) {
    const theta = rand() * Math.PI * 2;
    const y = BODY_Y0 + 0.06 + rand() * (BODY_H - 0.12);
    const s = 0.008 + rand() * rand() * 0.024;
    normal.set(Math.sin(theta), 0, Math.cos(theta));
    dropletMatrices.push(
      new THREE.Matrix4().compose(
        normal.clone().multiplyScalar(R + s * 0.2).setY(y),
        new THREE.Quaternion().setFromUnitVectors(zAxis, normal),
        new THREE.Vector3(s, s * 1.35, s * 0.45),
      ),
    );
  }

  geometry = {body, shoulder, lid, base, foot, tab, droplet, dropletMatrices};
  return geometry;
}

// ---------- materials ----------

const PAINT = {roughness: 0.3, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12};
const METAL = {color: '#dcd6cc', roughness: 0.26, metalness: 1};

// ---------- scene parts ----------

const WARM_CUBE_CAMERA = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
const WARM_FLAT_CAMERA = new THREE.OrthographicCamera();

type PmremInternals = {
  _setSize?: (cubeSize: number) => void;
  _allocateTargets?: () => THREE.WebGLRenderTarget;
  _lodMeshes?: THREE.Mesh[];
  _ggxMaterial?: THREE.Material | null;
  _blurMaterial?: THREE.Material | null;
  _pingPongRenderTarget?: THREE.WebGLRenderTarget | null;
};

/**
 * Compile, in the background, every shader PMREMGenerator.fromScene(room) is
 * about to use: the room's materials plus PMREM's own blur and GGX filter, for
 * the half-float target it renders into. Generated cold, fromScene waited
 * ~550 ms for the GGX filter to compile (Windows/ANGLE) and froze the page;
 * warmed, it takes ~30 ms. Reaches into PMREMGenerator internals (three r186,
 * pinned); if they ever change, the warm-up is skipped and it works as before.
 */
async function warmPmrem(gl: THREE.WebGLRenderer, pmrem: THREE.PMREMGenerator, room: THREE.Scene) {
  const internals = pmrem as unknown as PmremInternals;
  if (typeof internals._setSize !== 'function' || typeof internals._allocateTargets !== 'function') return;
  internals._setSize(256); // fromScene's default size, so it reuses these exact materials
  internals._allocateTargets().dispose();
  const plane = internals._lodMeshes?.[0]?.geometry;
  const target = internals._pingPongRenderTarget;
  if (!plane || !target || !internals._ggxMaterial || !internals._blurMaterial) return;
  const filters = new THREE.Scene();
  filters.add(new THREE.Mesh(plane, internals._ggxMaterial), new THREE.Mesh(plane, internals._blurMaterial));
  // compileAsync picks the shader variants for the current render target at call time, then waits.
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const compiled = Promise.all([
    gl.compileAsync(room, WARM_CUBE_CAMERA),
    gl.compileAsync(filters, WARM_FLAT_CAMERA),
  ]);
  gl.setRenderTarget(previous);
  await compiled;
}

/** Reflections for the metal and the clear coat: a PMREM of three's RoomEnvironment. */
function Environment({onReady}: {onReady: () => void}) {
  const {gl, scene} = useThree();
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    let cancelled = false;
    let env: THREE.Texture | null = null;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    void warmPmrem(gl, pmrem, room)
      .catch(() => undefined) // the warm-up only saves time
      .then(() => {
        if (cancelled) return;
        env = pmrem.fromScene(room, 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.85;
        onReadyRef.current();
      });
    return () => {
      cancelled = true;
      scene.environment = null;
      env?.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/**
 * Keeps the cans and bubbles hidden until their shaders have compiled in the
 * background (compileAsync uses KHR_parallel_shader_compile), then shows them.
 * Compiled on their first render instead, they blocked the page for ~0.4 s.
 * three's compile() covers hidden objects' materials too.
 */
function CompileGate({ready, onShown, children}: {ready: boolean; onShown: () => void; children: ReactNode}) {
  const {gl, scene, camera, invalidate} = useThree();
  const [shown, setShown] = useState(false);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    if (!ready || shown) return;
    let cancelled = false;
    void gl.compileAsync(scene, camera).then(() => {
      if (cancelled) return;
      setShown(true);
      invalidate();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, shown, gl, scene, camera, invalidate]);

  // Tell the page once a frame with the cans in it has been drawn.
  useEffect(() => {
    if (!shown) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => onShownRef.current());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [shown]);

  return <group visible={shown}>{children}</group>;
}

function useLabel(flavour: Flavour, onReady: () => void) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    let made: THREE.CanvasTexture | null = null;
    void drawCanLabel(flavour).then((canvas) => {
      if (!alive) return;
      made = new THREE.CanvasTexture(canvas);
      made.colorSpace = THREE.SRGBColorSpace;
      made.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      setTexture(made);
      invalidate();
      onReadyRef.current();
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [flavour, gl, invalidate]);

  return texture;
}

function Can({flavour, onReady}: {flavour: Flavour; onReady: () => void}) {
  const geo = canGeometry();
  const label = useLabel(flavour, onReady);
  const droplets = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = droplets.current;
    if (!mesh) return;
    geo.dropletMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [geo]);

  return (
    // Centre the can on its own middle so it turns around its axis.
    <group position={[0, -CAN_H / 2, 0]}>
      <mesh geometry={geo.body} visible={Boolean(label)}>
        <meshPhysicalMaterial map={label} {...PAINT} />
      </mesh>
      <mesh geometry={geo.shoulder}>
        <meshPhysicalMaterial color={flavour.body[1]} {...PAINT} />
      </mesh>
      <mesh geometry={geo.base}>
        <meshPhysicalMaterial color={flavour.body[1]} {...PAINT} />
      </mesh>
      <mesh geometry={geo.lid}>
        <meshStandardMaterial {...METAL} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.foot}>
        <meshStandardMaterial {...METAL} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.tab}>
        <meshStandardMaterial {...METAL} />
      </mesh>
      <instancedMesh
        ref={droplets}
        args={[geo.droplet, undefined, DROPLET_COUNT]}
        frustumCulled={false}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.5}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
        />
      </instancedMesh>
    </group>
  );
}

/** The variety pack: four cans on a ring, each facing out. */
function CanRing({flavours, onReady}: {flavours: Flavour[]; onReady: () => void}) {
  const radius = 0.95;
  return (
    <group scale={0.66}>
      {flavours.map((flavour, i) => {
        const angle = (i / flavours.length) * Math.PI * 2;
        return (
          <group
            key={flavour.key}
            position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}
            rotation={[0, angle, 0]}
          >
            <Can flavour={flavour} onReady={onReady} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Auto-rotation, a small spin-in once the can is revealed, and a full extra
 * turn whenever `spinKey` changes (switching flavour).
 */
function Spinner({
  motion,
  revealed,
  spinKey,
  children,
}: {
  motion: boolean;
  revealed: boolean;
  spinKey: string;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const extra = useRef({turn: motion ? -0.9 : 0});
  const introKey = useRef<string | null>(null);

  useEffect(() => {
    if (!motion) {
      extra.current.turn = 0;
      return;
    }
    if (!revealed) return; // hold the spin-in pose until the can is shown
    const intro = introKey.current === null;
    if (intro) introKey.current = spinKey;
    const tween = gsap.fromTo(
      extra.current,
      {turn: intro ? -0.9 : -Math.PI * 2},
      {turn: 0, duration: intro ? DUR.hero + 0.4 : DUR.hero, ease: EASE.out},
    );
    return () => {
      tween.kill();
    };
  }, [motion, revealed, spinKey]);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    if (motion && revealed) angle.current += Math.min(delta, 0.1) * SPIN_SPEED;
    group.rotation.y = angle.current + extra.current.turn;
  });

  return <group ref={ref}>{children}</group>;
}

/** Leans the can toward the pointer (window-wide), eased with frame-rate independent damping. */
function Tilt({
  motion,
  pointer,
  children,
}: {
  motion: boolean;
  pointer: MutableRefObject<{x: number; y: number}>;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const group = ref.current;
    if (!group || !motion) return;
    const {x, y} = pointer.current;
    const dt = Math.min(delta, 0.1);
    const damp = THREE.MathUtils.damp;
    group.rotation.x = damp(group.rotation.x, y * TILT.x, TILT.lambda, dt);
    group.rotation.y = damp(group.rotation.y, x * TILT.y, TILT.lambda, dt);
    group.rotation.z = damp(group.rotation.z, REST_TILT_Z - x * TILT.z, TILT.lambda, dt);
    group.position.x = damp(group.position.x, x * TILT.shift, TILT.lambda, dt);
    group.position.y = damp(group.position.y, -y * TILT.shift, TILT.lambda, dt);
  });
  return (
    <group ref={ref} rotation={[0, 0, REST_TILT_Z]}>
      {children}
    </group>
  );
}

const FIZZ_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vec4 mv = modelViewMatrix * local;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FIZZ_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Bright rim, clear middle: reads as a gas bubble, not a pearl.
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    gl_FragColor = vec4(vec3(1.0), rim * 0.95 + 0.06);
  }
`;

/** Rising bubbles around the can (world space, not tilted). */
function Fizz({motion}: {motion: boolean}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bubbles = useMemo(() => {
    let seed = 9;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({length: FIZZ_COUNT}, () => ({
      x: (rand() * 2 - 1) * 1.7,
      y: -1.7 + rand() * 3.6,
      z: -1.1 + rand() * 1.8,
      r: 0.022 + rand() * rand() * 0.07,
      speed: 0.22 + rand() * 0.4,
      phase: rand() * Math.PI * 2,
    }));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FIZZ_VERTEX,
        fragmentShader: FIZZ_FRAGMENT,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const place = (time: number) => {
    const target = mesh.current;
    if (!target) return;
    bubbles.forEach((b, i) => {
      // Rise, wrap from top to bottom, wobble sideways a little.
      const y = ((b.y + time * b.speed + 1.7) % 3.6) - 1.7;
      dummy.position.set(b.x + Math.sin(time * 1.3 + b.phase) * 0.05, y, b.z);
      dummy.scale.setScalar(b.r);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => place(0));
  useFrame((state) => {
    if (motion) place(state.clock.elapsedTime);
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, FIZZ_COUNT]}
      material={material}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 20, 14]} />
    </instancedMesh>
  );
}

/** Scales the scene so the can is `fit.canHeightPx` tall and sits `fit.offsetYPx` below centre. */
function Fit({fit, children}: {fit: CanViewerProps['fit']; children: ReactNode}) {
  const height = useThree((state) => state.size.height);
  const worldPerPx = (2 * CAMERA.z * Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2))) / height;
  const scale = (fit.canHeightPx * worldPerPx) / CAN_H;
  return (
    <group scale={scale} position={[0, -fit.offsetYPx * worldPerPx, 0]}>
      {children}
    </group>
  );
}

// ---------- the viewer ----------

export type CanViewerProps = {
  /** One flavour = one can; several = the variety ring. */
  flavours: Flavour[];
  /** False under prefers-reduced-motion: no spin, no tilt, still bubbles. */
  motion: boolean;
  /** Changes when the product changes; triggers a spin. */
  spinKey: string;
  /** True once the viewer is shown (after the page transition landed). */
  revealed: boolean;
  fit: {canHeightPx: number; offsetYPx: number};
  onReady: () => void;
  /** Accessible description of the model (the canvas itself is hidden from AT). */
  label: string;
};

export default function CanViewer({
  flavours,
  motion,
  spinKey,
  revealed,
  fit,
  onReady,
  label,
}: CanViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({x: 0, y: 0});
  const [onScreen, setOnScreen] = useState(true);

  // Pause the render loop while the viewer is scrolled away.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!motion) return;
    // Touch screens have no hovering pointer: lean with the scroll position instead.
    if (window.matchMedia('(hover: none)').matches) {
      const onScroll = () => {
        const el = wrapRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const half = window.innerHeight / 2;
        const y = Math.max(-1, Math.min(1, (r.top + r.height / 2 - half) / half));
        pointer.current.y = y;
        pointer.current.x = -y * 0.4;
      };
      onScroll();
      window.addEventListener('scroll', onScroll, {passive: true});
      return () => window.removeEventListener('scroll', onScroll);
    }
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, {passive: true});
    return () => window.removeEventListener('pointermove', onMove);
  }, [motion]);

  // Shown once the reflections and every can's label are ready and the shaders
  // have compiled in the background; then the page cross-fades from the packshot.
  const [envReady, setEnvReady] = useState(false);
  const [labelsReady, setLabelsReady] = useState(false);
  const labelCount = useRef(0);
  const handleLabelReady = () => {
    labelCount.current += 1;
    if (labelCount.current >= flavours.length) setLabelsReady(true);
  };
  const readyFired = useRef(false);
  const handleShown = () => {
    if (readyFired.current) return;
    readyFired.current = true;
    onReady();
  };

  return (
    <div className="can-viewer" ref={wrapRef} role="img" aria-label={label}>
      <Canvas
        flat
        dpr={[1, 1.75]}
        frameloop={motion && onScreen ? 'always' : 'demand'}
        camera={{fov: CAMERA.fov, position: [0, 0, CAMERA.z], near: 0.1, far: 50}}
        gl={{antialias: true, alpha: true, powerPreference: 'high-performance'}}
        aria-hidden="true"
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <directionalLight position={[-4, 1.5, -3]} intensity={0.7} color="#ffe2c4" />
        <Environment onReady={() => setEnvReady(true)} />
        <Fit fit={fit}>
          <CompileGate ready={envReady && labelsReady} onShown={handleShown}>
            <Tilt motion={motion} pointer={pointer}>
              <Spinner motion={motion} revealed={revealed} spinKey={spinKey}>
                {flavours.length === 1 ? (
                  <Can flavour={flavours[0]} onReady={handleLabelReady} />
                ) : (
                  <CanRing flavours={flavours} onReady={handleLabelReady} />
                )}
              </Spinner>
            </Tilt>
            <Fizz motion={motion} />
          </CompileGate>
        </Fit>
      </Canvas>
    </div>
  );
}

/* eslint-enable react/no-unknown-property */
