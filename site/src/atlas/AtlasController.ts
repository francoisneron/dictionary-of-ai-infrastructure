// The renderer core. Deliberately not a React component: camera, hover and the
// render loop change at frame rate, and nothing that changes at frame rate is
// allowed to touch React.
//
// Three instanced draw calls and zero per-frame buffer uploads. Hover, focus,
// colour mode, time and level of detail are all uniforms — the geometry is
// uploaded once at startup and never touched again.

import type { Atlas } from "./types";
import { createProgram, staticBuffer, bindAttribs, uniforms } from "./gl";
import { NODE_VERT, NODE_FRAG } from "./shaders/nodes";
import {
  EDGE_VERT,
  EDGE_FRAG,
  PARTICLE_VERT,
  PARTICLE_FRAG,
  edgeStripGeometry,
  EDGE_SEGMENTS,
  PARTICLES_PER_EDGE,
} from "./shaders/edges";
import { INK, PAPER } from "./palette";
import {
  defaultCamera,
  clampDistance,
  clampElevation,
  viewProjection,
  projectPoint,
  planFlight,
  sampleFlight,
  easeGleasing,
  FOV,
  type Camera,
  type Flight,
} from "./camera";

const NODE_STRIDE = 6 * 4; // pos(3) radius index status
const EDGE_STRIDE = 11 * 4; // p0(3) p1(3) a b curve w tier
const HOVER_SLOP_PX = 8;
const DRIFT_AMPLITUDE = 0.009;
const PARTICLE_SPEED = 0.24;

/**
 * Node radius in world units. Deliberately a wider spread than sqrt alone
 * gives: a term's degree is its importance in the dictionary, and that should
 * be legible at a glance rather than a subtlety.
 */
function baseRadius(degree: number): number {
  return 0.0055 + 0.0021 * Math.pow(degree, 0.78);
}

/** Radians per second the graph turns when nothing is selected. */
const IDLE_SPIN = 0.045;

/** Camera distances between which the share of labelled terms ramps. */
const LABEL_LOD_FAR = 4.6;
const LABEL_LOD_NEAR = 1.7;
/** Share of terms labelled when the camera is fully pulled back. */
const LABEL_LOD_MIN_SHARE = 0.38;
/** Extra share a label already on screen is judged against, so one sitting on
 *  the threshold does not blink as the distance wobbles. */
const LABEL_LOD_HYSTERESIS = 0.08;

export type LodState = {
  labelDegreeFloor: number;
  /** The floor a label already on screen is held to — always ≤ the above. */
  labelDegreeFloorHold: number;
  distance: number;
  /** Depth range of the graph right now, so labels fade exactly like nodes. */
  fadeNear: number;
  fadeFar: number;
};

export type LabelSync = (
  /** Per node, stride 4: x, y in CSS px, view depth (0 = behind camera), radius in CSS px. */
  projected: Float32Array,
  lod: LodState,
  hover: number,
  focus: number
) => void;

export type AtlasEvents = {
  onSelect?: (index: number | null) => void;
  onHover?: (index: number | null) => void;
};

export class AtlasController {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private atlas: Atlas;
  private events: AtlasEvents;

  private nodeProgram!: WebGLProgram;
  private nodeVao!: WebGLVertexArrayObject;
  private nodeUni!: ReturnType<typeof uniforms>;
  private edgeProgram!: WebGLProgram;
  private edgeVao!: WebGLVertexArrayObject;
  private edgeUni!: ReturnType<typeof uniforms>;
  private particleProgram!: WebGLProgram;
  private particleVao!: WebGLVertexArrayObject;
  private particleUni!: ReturnType<typeof uniforms>;
  private buffers: WebGLBuffer[] = [];

  private cam: Camera = defaultCamera();
  private flight: Flight | null = null;
  private viewProj = new Float32Array(16);
  private proj = { x: 0, y: 0, w: 0 };

  private hover = -1;
  private focus = -1;
  private reducedMotion = false;
  private startedAt = 0;
  /** Idle rotation pauses for a moment after any deliberate interaction. */
  private userActiveUntil = 0;
  private lastFrame = 0;

  private width = 1;
  private height = 1;
  private dpr = 1;

  private raf = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  private dragging = false;
  private pointerId: number | null = null;
  private lastPointer = { x: 0, y: 0 };
  private movedWhileDown = false;
  private pinchDistance = 0;
  private activePointers = new Map<number, { x: number; y: number }>();

  /** Reused every frame — the render loop allocates nothing. */
  private projected: Float32Array;
  private lod: LodState = {
    labelDegreeFloor: 0,
    labelDegreeFloorHold: 0,
    distance: 3,
    fadeNear: 0,
    fadeFar: 1,
  };
  /** Distance from the origin to the furthest node — the graph's own radius. */
  private graphRadius = 1;
  /** Measured view-space depth of the nearest and furthest node this frame. */
  private depthMin = 0;
  private depthMax = 1;
  private labelSync: LabelSync | null = null;
  private sortedDegrees: number[] = [];
  /**
   * Sideways screen offset in CSS px that keeps a focused node clear of the
   * panel, and the value it is easing towards. Held in screen units rather than
   * world units on purpose — see `viewCamera`.
   */
  private shiftPx = 0;
  private shiftTarget = 0;
  /** Scratch for the rendered camera, so the render loop still allocates nothing. */
  private viewCam: Camera = defaultCamera();
  /**
   * Page colours, tweened. A section change washes the canvas across rather
   * than cutting to it, on the same curve the stylesheet uses for the DOM.
   */
  private paper = new Float32Array(PAPER);
  private ink = new Float32Array(INK);
  private paperTarget = new Float32Array(PAPER);
  private inkTarget = new Float32Array(INK);

  constructor(
    canvas: HTMLCanvasElement,
    atlas: Atlas,
    events: AtlasEvents = {}
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      // Analytic SDFs antialias themselves, and MSAA on thin dark strokes over
      // light paper is expensive and driver-inconsistent.
      antialias: false,
      // A depth buffer is what makes the graph read as a volume: near nodes
      // occlude the edges behind them instead of everything compositing flat.
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");

    this.gl = gl;
    this.canvas = canvas;
    this.atlas = atlas;
    this.events = events;
    this.projected = new Float32Array(atlas.nodes.length * 4);
    this.startedAt = performance.now();

    this.graphRadius = Math.max(
      0.2,
      ...atlas.nodes.map((n) => Math.hypot(n.x, n.y, n.z))
    );

    // Degrees ascending — the ladder the label level of detail walks up and
    // down. Pulled back only the hubs are labelled; flown in, everything is,
    // so the floor reaches zero rather than some percentile, or the
    // least-connected terms would never be named at any distance.
    this.sortedDegrees = atlas.nodes.map((n) => n.degree).sort((a, b) => a - b);

    this.reducedMotion =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.lastFrame = this.startedAt;
    this.initGL();
    this.attachEvents();
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(canvas);
    this.loop();
  }

  // --- setup -------------------------------------------------------------

  private initGL(): void {
    const { gl } = this;

    gl.enable(gl.BLEND);
    // Premultiplied alpha. Getting this wrong puts a dark halo around every
    // node and edge on a light background, which reads as a design bug.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1);

    this.initNodes();
    this.initEdges();
    this.initParticles();
  }

  private nodeInstanceData(): Float32Array {
    const nodes = this.atlas.nodes;
    const data = new Float32Array(nodes.length * 6);
    nodes.forEach((n, i) => {
      const o = i * 6;
      data[o] = n.x;
      data[o + 1] = n.y;
      data[o + 2] = n.z;
      data[o + 3] = baseRadius(n.degree);
      data[o + 4] = n.i;
      data[o + 5] = n.status === "published" ? 1 : 0;
    });
    return data;
  }

  private initNodes(): void {
    const { gl } = this;
    this.nodeProgram = createProgram(gl, NODE_VERT, NODE_FRAG, "nodes");
    this.nodeUni = uniforms(gl, this.nodeProgram, [
      "uViewProj",
      "uHalfPx",
      "uProjScale",
      "uDpr",
      "uTime",
      "uDrift",
      "uHover",
      "uFocus",
      "uFadeNear",
      "uFadeFar",
      "uInk",
      "uPaper",
      "uDim",
    ]);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create node VAO");
    this.nodeVao = vao;
    gl.bindVertexArray(vao);

    const corners = staticBuffer(
      gl,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    );
    this.buffers.push(corners);
    bindAttribs(gl, this.nodeProgram, corners, 8, [
      { name: "aCorner", size: 2, offset: 0, divisor: 0 },
    ]);

    const inst = staticBuffer(gl, this.nodeInstanceData());
    this.buffers.push(inst);
    bindAttribs(gl, this.nodeProgram, inst, NODE_STRIDE, [
      { name: "aPos", size: 3, offset: 0, divisor: 1 },
      { name: "aRadius", size: 1, offset: 12, divisor: 1 },
      { name: "aIndex", size: 1, offset: 16, divisor: 1 },
      { name: "aStatus", size: 1, offset: 20, divisor: 1 },
    ]);

    gl.bindVertexArray(null);
    gl.useProgram(this.nodeProgram);
    gl.uniform3fv(this.nodeUni.uInk!, new Float32Array(INK));
    gl.uniform3fv(this.nodeUni.uPaper!, new Float32Array(PAPER));
  }

  /** p0(3) p1(3) a b curve w tier = 11 floats. */
  private edgeInstanceData(): Float32Array {
    const { edges, nodes } = this.atlas;
    const data = new Float32Array(edges.length * 11);
    edges.forEach((e, i) => {
      const a = nodes[e.a]!;
      const b = nodes[e.b]!;
      const o = i * 11;
      data[o] = a.x;
      data[o + 1] = a.y;
      data[o + 2] = a.z;
      data[o + 3] = b.x;
      data[o + 4] = b.y;
      data[o + 5] = b.z;
      data[o + 6] = e.a;
      data[o + 7] = e.b;
      data[o + 8] = e.c;
      data[o + 9] = e.w;
      data[o + 10] = e.t;
    });
    return data;
  }

  private static readonly EDGE_ATTRIBS = [
    { name: "aP0", size: 3, offset: 0, divisor: 1 as const },
    { name: "aP1", size: 3, offset: 12, divisor: 1 as const },
    { name: "aA", size: 1, offset: 24, divisor: 1 as const },
    { name: "aB", size: 1, offset: 28, divisor: 1 as const },
    { name: "aCurve", size: 1, offset: 32, divisor: 1 as const },
    { name: "aW", size: 1, offset: 36, divisor: 1 as const },
    { name: "aTier", size: 1, offset: 40, divisor: 1 as const },
  ];

  private initEdges(): void {
    const { gl } = this;
    this.edgeProgram = createProgram(gl, EDGE_VERT, EDGE_FRAG, "edges");
    this.edgeUni = uniforms(gl, this.edgeProgram, [
      "uViewProj",
      "uHalfPx",
      "uDpr",
      "uTime",
      "uDrift",
      "uHover",
      "uFocus",
      "uBackboneAlpha",
      "uSecondaryAlpha",
      "uEgoAlpha",
      "uDim",
      "uFadeNear",
      "uFadeFar",
      "uInk",
    ]);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create edge VAO");
    this.edgeVao = vao;
    gl.bindVertexArray(vao);

    const strip = staticBuffer(gl, edgeStripGeometry());
    this.buffers.push(strip);
    bindAttribs(gl, this.edgeProgram, strip, 8, [
      { name: "aSeg", size: 2, offset: 0, divisor: 0 },
    ]);

    const inst = staticBuffer(gl, this.edgeInstanceData());
    this.buffers.push(inst);
    bindAttribs(
      gl,
      this.edgeProgram,
      inst,
      EDGE_STRIDE,
      AtlasController.EDGE_ATTRIBS
    );

    gl.bindVertexArray(null);
    gl.useProgram(this.edgeProgram);
    gl.uniform3fv(this.edgeUni.uInk!, new Float32Array(INK));
  }

  private initParticles(): void {
    const { gl } = this;
    this.particleProgram = createProgram(
      gl,
      PARTICLE_VERT,
      PARTICLE_FRAG,
      "particles"
    );
    this.particleUni = uniforms(gl, this.particleProgram, [
      "uViewProj",
      "uHalfPx",
      "uProjScale",
      "uDpr",
      "uTime",
      "uDrift",
      "uNode",
      "uSpeed",
      "uFadeNear",
      "uFadeFar",
      "uInk",
    ]);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("could not create particle VAO");
    this.particleVao = vao;
    gl.bindVertexArray(vao);

    const corners = staticBuffer(
      gl,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    );
    this.buffers.push(corners);
    bindAttribs(gl, this.particleProgram, corners, 8, [
      { name: "aCorner", size: 2, offset: 0, divisor: 0 },
    ]);

    // Each edge repeated once per particle, with a stagger offset appended.
    // Every edge carries instances so selection is a uniform change, not an
    // upload; the shader hides the ones that are not incident to the focus.
    const edges = this.atlas.edges;
    const per = 12;
    const data = new Float32Array(edges.length * PARTICLES_PER_EDGE * per);
    const { nodes } = this.atlas;
    let o = 0;
    edges.forEach((e) => {
      const a = nodes[e.a]!;
      const b = nodes[e.b]!;
      for (let k = 0; k < PARTICLES_PER_EDGE; k++) {
        data[o] = a.x;
        data[o + 1] = a.y;
        data[o + 2] = a.z;
        data[o + 3] = b.x;
        data[o + 4] = b.y;
        data[o + 5] = b.z;
        data[o + 6] = e.a;
        data[o + 7] = e.b;
        data[o + 8] = e.c;
        // Stagger, offset per edge as well so they don't pulse in unison.
        data[o + 9] =
          k / PARTICLES_PER_EDGE + ((e.a * 7 + e.b * 13) % 100) / 700;
        data[o + 10] = 0;
        data[o + 11] = 0;
        o += per;
      }
    });
    const inst = staticBuffer(gl, data);
    this.buffers.push(inst);
    bindAttribs(gl, this.particleProgram, inst, per * 4, [
      { name: "aP0", size: 3, offset: 0, divisor: 1 },
      { name: "aP1", size: 3, offset: 12, divisor: 1 },
      { name: "aA", size: 1, offset: 24, divisor: 1 },
      { name: "aB", size: 1, offset: 28, divisor: 1 },
      { name: "aCurve", size: 1, offset: 32, divisor: 1 },
      { name: "aOffset", size: 1, offset: 36, divisor: 1 },
    ]);

    gl.bindVertexArray(null);
    gl.useProgram(this.particleProgram);
    gl.uniform3fv(this.particleUni.uInk!, new Float32Array(INK));
  }

  private syncSize(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    // A hidden tab reports a zero-size rect. Rendering into a degenerate buffer
    // would just thrash; hold the last good size and wait for it to come back.
    if (rect.width < 1 || rect.height < 1) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this.width && h === this.height && dpr === this.dpr) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.gl.viewport(0, 0, w, h);
    return true;
  }

  /** Device px per world unit at unit depth. */
  private projScale(): number {
    return this.height / 2 / Math.tan(FOV / 2);
  }

  // --- interaction -------------------------------------------------------

  private attachEvents(): void {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("pointerleave", this.onPointerLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("webglcontextlost", this.onContextLost);
    c.addEventListener("webglcontextrestored", this.onContextRestored);
  }

  private devicePos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * this.dpr,
      y: (e.clientY - rect.top) * this.dpr,
    };
  }

  private onPointerDown = (e: PointerEvent): void => {
    // Label pills sit above the canvas and are the accessible click target;
    // only drive the camera from events that actually landed on the canvas.
    if (e.target !== this.canvas) return;
    this.activePointers.set(e.pointerId, this.devicePos(e));
    if (this.activePointers.size === 2) {
      const [p, q] = [...this.activePointers.values()];
      this.pinchDistance = Math.hypot(p!.x - q!.x, p!.y - q!.y);
      this.dragging = false;
      return;
    }
    this.dragging = true;
    this.movedWhileDown = false;
    this.pointerId = e.pointerId;
    this.lastPointer = this.devicePos(e);
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.devicePos(e);
    if (this.activePointers.has(e.pointerId))
      this.activePointers.set(e.pointerId, p);

    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (this.pinchDistance > 0) {
        this.cam.distance = clampDistance(
          this.cam.distance * (this.pinchDistance / Math.max(d, 1))
        );
      }
      this.pinchDistance = d;
      this.flight = null;
      return;
    }

    if (this.dragging && e.pointerId === this.pointerId) {
      const dx = p.x - this.lastPointer.x;
      const dy = p.y - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.movedWhileDown = true;
      // Dragging orbits the graph rather than sliding it: that is what makes
      // the layout read as a volume instead of a picture.
      this.cam.azimuth -= (dx / this.height) * 2.4;
      this.cam.elevation = clampElevation(
        this.cam.elevation + (dy / this.height) * 2.4
      );
      this.lastPointer = p;
      this.flight = null;
      this.userActiveUntil = performance.now() + 3500;
      return;
    }

    this.setHover(this.pick(p.x, p.y));
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) this.pinchDistance = 0;
    if (e.pointerId !== this.pointerId) return;
    const wasDrag = this.movedWhileDown;
    this.dragging = false;
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    if (wasDrag) return;
    const p = this.devicePos(e);
    const hit = this.pick(p.x, p.y);
    this.events.onSelect?.(hit >= 0 ? hit : null);
  };

  private onPointerLeave = (): void => {
    this.setHover(-1);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cam.distance = clampDistance(
      this.cam.distance * Math.exp(e.deltaY * 0.0014)
    );
    this.flight = null;
    this.userActiveUntil = performance.now() + 3500;
  };

  private onContextLost = (e: Event): void => {
    // Fires on GPU reset, driver update, and aggressive tab discarding.
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private onContextRestored = (): void => {
    // Everything is derived from the immutable atlas, so a rebuild is enough.
    this.buffers = [];
    this.initGL();
    this.syncSize();
    if (!this.raf && !this.disposed) this.loop();
  };

  private radiusPx(degree: number, w: number): number {
    return Math.min(
      Math.max(
        (baseRadius(degree) * this.projScale()) / Math.max(w, 0.001),
        1.7 * this.dpr
      ),
      15 * this.dpr
    );
  }

  /** Linear scan over the projected nodes. 84 is well under 10µs. */
  private pick(px: number, py: number): number {
    const slop = HOVER_SLOP_PX * this.dpr;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.atlas.nodes.length; i++) {
      const depth = this.projected[i * 4 + 2]!;
      if (depth <= 0) continue; // behind the camera
      const sx = this.projected[i * 4]! * this.dpr;
      const sy = this.projected[i * 4 + 1]! * this.dpr;
      const d = Math.hypot(px - sx, py - sy);
      const r = this.projected[i * 4 + 3]! * this.dpr + slop;
      if (d <= r && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  private setHover(index: number): void {
    if (index === this.hover) return;
    this.hover = index;
    // Hovering a term is a deliberate act; hold the idle behaviour off briefly
    // so the spotlight doesn't fight the pointer.
    if (index >= 0) this.userActiveUntil = performance.now() + 2500;
    this.canvas.style.cursor = index >= 0 ? "pointer" : "grab";
    // Hover never reaches React — it changes several times a second on a drag.
    this.events.onHover?.(index >= 0 ? index : null);
  }

  // --- public API --------------------------------------------------------

  select(index: number | null): void {
    this.focus = index ?? -1;
    this.userActiveUntil = performance.now() + 3500;
  }

  /**
   * The page's paper and ink. Handed in rather than derived here so the canvas
   * and the stylesheet cannot disagree about what colour the page is — the
   * halo punched around every node has to be exactly the page behind it.
   */
  setTheme(
    paper: [number, number, number],
    ink: [number, number, number]
  ): void {
    this.paperTarget.set(paper);
    this.inkTarget.set(ink);
    if (this.reducedMotion) {
      this.paper.set(paper);
      this.ink.set(ink);
    }
  }

  setLabelSync(fn: LabelSync | null): void {
    this.labelSync = fn;
  }

  /** Width of chrome covering the right edge, in CSS px. */
  setInsetRight(px: number): void {
    this.shiftTarget = px / 2;
  }

  getCamera(): Camera {
    return { ...this.cam };
  }

  getHover(): number {
    return this.hover;
  }

  /**
   * Frames a node and turns it to the front of the graph.
   *
   * The camera swings onto the ray running from the centre of the layout out
   * through the node, so the node ends up between the viewer and everything
   * else and the rest of the map falls in behind it. The rotation is therefore
   * a function of where the term actually sits in the volume rather than a
   * fixed nudge: one buried at the back swings the map around half a turn,
   * while one already facing you barely moves at all.
   */
  flyTo(index: number, distance = 2.45): void {
    const n = this.atlas.nodes[index];
    if (!n) return;

    // Direction from the graph's centre out to the node, as orbit angles.
    // Inverse of `eyePosition`: it places the eye on the outward side, so the
    // node is the nearest point of the graph along the view axis.
    const len = Math.hypot(n.x, n.y, n.z);
    const outward = len > 1e-3;
    const azimuth = outward ? Math.atan2(n.x, n.z) : this.cam.azimuth;
    const elevation = outward
      ? Math.asin(Math.min(1, Math.max(-1, n.y / len)))
      : this.cam.elevation;

    // The look-at point is the node itself. Room for the panel is made in
    // `viewCamera`, per frame, in screen units — not baked in here.
    const target: Camera = {
      tx: n.x,
      ty: n.y,
      tz: n.z,
      distance: clampDistance(distance),
      azimuth,
      // A few degrees above the ray. Far too small to disturb which node is in
      // front, and it keeps the framing from going dead flat for the many terms
      // that sit near the layout's equator.
      elevation: clampElevation(elevation + 0.1),
    };

    if (this.reducedMotion) {
      this.cam = target;
      this.flight = null;
      return;
    }
    this.flight = planFlight({ ...this.cam }, target, performance.now());
  }

  resetView(): void {
    const home = defaultCamera();
    if (this.reducedMotion) {
      this.cam = home;
      this.flight = null;
      return;
    }
    this.flight = planFlight({ ...this.cam }, home, performance.now());
  }

  /**
   * Advances and draws one complete frame immediately. Needed wherever
   * requestAnimationFrame is throttled — a background tab, or a headless check.
   * It advances the camera flight too, so a hand-driven frame is a whole frame
   * rather than a render of stale state.
   */
  renderNow(): void {
    const now = performance.now();
    this.advance(now);
    this.syncSize();
    this.render(now);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("pointerleave", this.onPointerLeave);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("webglcontextlost", this.onContextLost);
    c.removeEventListener("webglcontextrestored", this.onContextRestored);
    const { gl } = this;
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.nodeVao);
    gl.deleteVertexArray(this.edgeVao);
    gl.deleteVertexArray(this.particleVao);
    gl.deleteProgram(this.nodeProgram);
    gl.deleteProgram(this.edgeProgram);
    gl.deleteProgram(this.particleProgram);
  }

  // --- render ------------------------------------------------------------

  /**
   * Eases the panel offset. It changes when a term opens, when one closes, and
   * on resize; stepped straight to its target the whole map lurches sideways.
   */
  private easeShift(dt: number): void {
    if (this.reducedMotion) {
      this.shiftPx = this.shiftTarget;
      return;
    }
    const remaining = this.shiftTarget - this.shiftPx;
    if (Math.abs(remaining) < 0.05) {
      this.shiftPx = this.shiftTarget;
      return;
    }
    // Frame-rate independent: the same curve at 60Hz and 144Hz.
    this.shiftPx += remaining * (1 - Math.exp(-dt * 9));
  }

  /**
   * Crossfades paper and ink towards the active section's wash. Rate 6 lands
   * within a frame or two of the 0.45s CSS transition on the DOM, so the panel
   * and the map change colour together rather than in sequence.
   */
  private easeTheme(dt: number): void {
    if (this.reducedMotion) return;
    const k = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 3; i++) {
      this.paper[i]! += (this.paperTarget[i]! - this.paper[i]!) * k;
      this.ink[i]! += (this.inkTarget[i]! - this.ink[i]!) * k;
    }
  }

  /**
   * The camera actually rendered.
   *
   * The orbit target is the focused node itself; the room made for the panel is
   * a screen-space offset re-derived from the current distance every frame.
   * Holding it in world units instead — baked into the target once at fly-to
   * time — pinned the offset to one distance, so zooming in swung the node
   * further and further off to the left until it left the viewport, and the
   * zoom appeared to be centred on empty space rather than on the selection.
   */
  private viewCamera(): Camera {
    const c = this.cam;
    if (Math.abs(this.shiftPx) < 0.01) return c;

    // Distance cancels the perspective divide, so the node holds exactly this
    // many CSS px from centre at every zoom level.
    const world = (this.shiftPx * this.dpr * c.distance) / this.projScale();
    // [cos, 0, -sin] is the view matrix's own right axis, so this displaces the
    // node horizontally on screen and not at all vertically, at any elevation.
    const v = this.viewCam;
    v.tx = c.tx + Math.cos(c.azimuth) * world;
    v.ty = c.ty;
    v.tz = c.tz - Math.sin(c.azimuth) * world;
    v.distance = c.distance;
    v.azimuth = c.azimuth;
    v.elevation = c.elevation;
    return v;
  }

  /** Steps time-dependent state. Separate from render so renderNow can reuse it. */
  private advance(now: number): void {
    if (this.flight) {
      const t = Math.min(
        1,
        (now - this.flight.startedAt) / this.flight.duration
      );
      sampleFlight(this.flight, easeGleasing(t), this.cam);
      if (t >= 1) this.flight = null;
    }

    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.easeShift(dt);
    this.easeTheme(dt);
    if (this.reducedMotion) return;

    // A slow turn while nothing is selected: it reads as a solid being shown to
    // you, and it is the cheapest way to make the third dimension obvious.
    const idle =
      this.focus < 0 && this.hover < 0 && !this.dragging && !this.flight;
    if (idle && now > this.userActiveUntil) {
      this.cam.azimuth += IDLE_SPIN * dt;
    }
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();

    this.advance(now);
    this.syncSize();
    // Rendering every frame rather than on demand: the graph drifts and the
    // particles run continuously, so there is no idle state to skip.
    this.render(now);
  };

  private render(now: number): void {
    const { gl } = this;
    if (this.width < 2 || this.height < 2) return;

    const time = this.reducedMotion ? 0 : (now - this.startedAt) / 1000;
    const drift = this.reducedMotion ? 0 : DRIFT_AMPLITUDE;

    viewProjection(this.viewCamera(), this.width / this.height, this.viewProj);

    // Project before drawing: the fade has to be normalised over the graph's
    // measured depth spread this frame, not an assumed one. A bounding sphere
    // over-estimates it — the graph is not a ball, so the spread along the view
    // axis is narrower than 2r and every node lands in the middle of the curve,
    // leaving the front short of opaque and the back short of invisible.
    this.projectNodes(time, drift);

    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const scale = this.projScale();
    const dim = this.focus >= 0 ? 0.3 : 1;
    const fadeNear = this.depthMin;
    const fadeFar = this.depthMax;

    // Paper and ink are uniforms now rather than upload-once constants: the
    // page changes colour per section. Three vec3s a frame is nothing.
    gl.clearColor(this.paper[0]!, this.paper[1]!, this.paper[2]!, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1. Nodes first, writing depth, so they occlude the edges behind them.
    gl.depthMask(true);
    gl.useProgram(this.nodeProgram);
    gl.bindVertexArray(this.nodeVao);
    gl.uniform3fv(this.nodeUni.uInk!, this.ink);
    gl.uniform3fv(this.nodeUni.uPaper!, this.paper);
    gl.uniformMatrix4fv(this.nodeUni.uViewProj!, false, this.viewProj);
    gl.uniform2f(this.nodeUni.uHalfPx!, halfW, halfH);
    gl.uniform1f(this.nodeUni.uProjScale!, scale);
    gl.uniform1f(this.nodeUni.uDpr!, this.dpr);
    gl.uniform1f(this.nodeUni.uTime!, time);
    gl.uniform1f(this.nodeUni.uDrift!, drift);
    gl.uniform1f(this.nodeUni.uHover!, this.hover);
    gl.uniform1f(this.nodeUni.uFocus!, this.focus);
    gl.uniform1f(this.nodeUni.uFadeNear!, fadeNear);
    gl.uniform1f(this.nodeUni.uFadeFar!, fadeFar);
    gl.uniform1f(this.nodeUni.uDim!, this.focus >= 0 ? 0.4 : 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.atlas.nodes.length);

    // 2. Edges: depth-tested but not depth-writing, the standard order for
    //    translucent geometry over opaque.
    gl.depthMask(false);
    gl.useProgram(this.edgeProgram);
    gl.bindVertexArray(this.edgeVao);
    gl.uniform3fv(this.edgeUni.uInk!, this.ink);
    gl.uniformMatrix4fv(this.edgeUni.uViewProj!, false, this.viewProj);
    gl.uniform2f(this.edgeUni.uHalfPx!, halfW, halfH);
    gl.uniform1f(this.edgeUni.uDpr!, this.dpr);
    gl.uniform1f(this.edgeUni.uTime!, time);
    gl.uniform1f(this.edgeUni.uDrift!, drift);
    gl.uniform1f(this.edgeUni.uHover!, this.hover);
    gl.uniform1f(this.edgeUni.uFocus!, this.focus);
    // Both zero: an untouched map is nodes only. Lines exist to answer "what is
    // this term connected to", so they appear only when a term is hovered or
    // selected, never as ambient texture.
    gl.uniform1f(this.edgeUni.uBackboneAlpha!, 0);
    gl.uniform1f(this.edgeUni.uSecondaryAlpha!, 0);
    gl.uniform1f(this.edgeUni.uEgoAlpha!, 0.5);
    gl.uniform1f(this.edgeUni.uDim!, dim);
    gl.uniform1f(this.edgeUni.uFadeNear!, fadeNear);
    gl.uniform1f(this.edgeUni.uFadeFar!, fadeFar);
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      (EDGE_SEGMENTS + 1) * 2,
      this.atlas.edges.length
    );

    // 3. Particles along the lit node's edges. Hover takes precedence over
    //    selection, matching the labels: while a term is open you can still
    //    point at another and see its connections.
    const litNode = this.hover >= 0 ? this.hover : this.focus;

    if (litNode >= 0 && !this.reducedMotion) {
      gl.useProgram(this.particleProgram);
      gl.bindVertexArray(this.particleVao);
      gl.uniform3fv(this.particleUni.uInk!, this.ink);
      gl.uniformMatrix4fv(this.particleUni.uViewProj!, false, this.viewProj);
      gl.uniform2f(this.particleUni.uHalfPx!, halfW, halfH);
      gl.uniform1f(this.particleUni.uProjScale!, scale);
      gl.uniform1f(this.particleUni.uDpr!, this.dpr);
      gl.uniform1f(this.particleUni.uTime!, time);
      gl.uniform1f(this.particleUni.uDrift!, drift);
      gl.uniform1f(this.particleUni.uNode!, litNode);
      gl.uniform1f(this.particleUni.uSpeed!, PARTICLE_SPEED);
      gl.uniform1f(this.particleUni.uFadeNear!, fadeNear);
      gl.uniform1f(this.particleUni.uFadeFar!, fadeFar);
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        4,
        this.atlas.edges.length * PARTICLES_PER_EDGE
      );
    }

    gl.bindVertexArray(null);
    gl.depthMask(true);

    this.syncLabels(fadeNear, fadeFar);
  }

  /**
   * Projects every node to screen space and records the frame's depth range.
   * Fills `projected` with stride 4: x, y (CSS px), view depth, radius (CSS px).
   * Allocates nothing.
   */
  private projectNodes(time: number, drift: number): void {
    const nodes = this.atlas.nodes;
    const m = this.viewProj;
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    let lo = Infinity;
    let hi = -Infinity;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      // Must match the shader's drift exactly or labels lag their nodes.
      const phase = i * 2.399963;
      const x = n.x + drift * Math.sin(time * 0.31 + phase);
      const y = n.y + drift * Math.sin(time * 0.27 + phase * 1.7 + 1.1);
      const z = n.z + drift * Math.sin(time * 0.23 + phase * 2.3 + 2.2);

      projectPoint(m, x, y, z, this.proj);
      const o = i * 4;
      if (this.proj.w <= 0.001) {
        this.projected[o] = -9999;
        this.projected[o + 1] = -9999;
        this.projected[o + 2] = 0;
        this.projected[o + 3] = 0;
        continue;
      }
      const ndcX = this.proj.x / this.proj.w;
      const ndcY = this.proj.y / this.proj.w;
      this.projected[o] = ((ndcX * halfW + halfW) / this.dpr) | 0;
      this.projected[o + 1] = ((-ndcY * halfH + halfH) / this.dpr) | 0;
      this.projected[o + 2] = this.proj.w;
      // Fourth is the node's rendered radius in CSS px, so labels can sit
      // exactly above the disc whatever its size and depth.
      this.projected[o + 3] = this.radiusPx(n.degree, this.proj.w) / this.dpr;

      if (this.proj.w < lo) lo = this.proj.w;
      if (this.proj.w > hi) hi = this.proj.w;
    }

    // A hair of padding so the nearest node is not pinned exactly at fully
    // opaque and the furthest not exactly at zero.
    const pad = Math.max(0.02, (hi - lo) * 0.04);
    this.depthMin = Number.isFinite(lo) ? lo - pad : 0;
    this.depthMax = Number.isFinite(hi) ? hi + pad : 1;
  }

  /** The degree below which a term goes unlabelled, for a given share shown. */
  private degreeForShare(share: number): number {
    if (share >= 1) return 0;
    const s = this.sortedDegrees;
    const idx = Math.min(
      s.length - 1,
      Math.max(0, Math.floor((1 - share) * s.length))
    );
    return s[idx] ?? 0;
  }

  private syncLabels(fadeNear: number, fadeFar: number): void {
    if (!this.labelSync) return;
    const d = this.cam.distance;
    // The share of terms labelled ramps continuously with distance. Three fixed
    // tiers put a whole percentile band on screen in a single frame whenever
    // the camera crossed one, which reads as the map flashing even though every
    // label fades in properly on its own.
    const t = Math.min(
      1,
      Math.max(0, (LABEL_LOD_FAR - d) / (LABEL_LOD_FAR - LABEL_LOD_NEAR))
    );
    const share = LABEL_LOD_MIN_SHARE + (1 - LABEL_LOD_MIN_SHARE) * t;
    this.lod.labelDegreeFloor = this.degreeForShare(share);
    this.lod.labelDegreeFloorHold = this.degreeForShare(
      Math.min(1, share + LABEL_LOD_HYSTERESIS)
    );
    this.lod.distance = d;
    // Handed through so labels fade on exactly the curve the shaders use.
    this.lod.fadeNear = fadeNear;
    this.lod.fadeFar = fadeFar;
    this.labelSync(this.projected, this.lod, this.hover, this.focus);
  }
}
