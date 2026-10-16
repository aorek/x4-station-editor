import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CATEGORIES, describeModule, type ModuleInfo, type ModuleShape } from "../catalog/modules";
import { entryQuaternion } from "../plan/transform";
import type { ConstructionPlan, PlanEntry } from "../plan/types";

export interface ModulePick {
  entry: PlanEntry;
  info: ModuleInfo;
}

interface ModuleRecord extends ModulePick {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
}

const BACKGROUND = 0x0b1119;
const LINK_COLOR = 0xf0a64b;
const EDGE_OPACITY = 0.22;
const MARK_COLOR = 0xff3b2f;

function geometryFor(shape: ModuleShape): THREE.BufferGeometry {
  const [x, y, z] = shape.size;
  const [cx, cy, cz] = shape.center ?? [0, 0, 0];
  switch (shape.kind) {
    case "cylinderY":
      return new THREE.CylinderGeometry(x / 2, x / 2, y, 24).translate(cx, cy, cz);
    case "cylinderZ":
      return new THREE.CylinderGeometry(x / 2, x / 2, z, 16).rotateX(Math.PI / 2).translate(cx, cy, cz);
    case "box":
      return new THREE.BoxGeometry(x, y, z).translate(cx, cy, cz);
  }
}

/**
 * 3D scene of a station.
 *
 * X4 is left-handed and Three.js is right-handed. Instead of converting every
 * position and rotation, everything hangs from a group with Z scale -1: plan
 * data is used as-is and the mirror does the conversion.
 */
export class StationViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  /** Called when the pointer moves over a module (or leaves it). */
  onHover: (pick: ModulePick | null, x: number, y: number) => void = () => {};
  /** Called when a module is clicked (or deselected). */
  onSelect: (pick: ModulePick | null) => void = () => {};
  /** Called on a right-click (without dragging) on a module, after selecting it. */
  onContextMenu: (pick: ModulePick, x: number, y: number) => void = () => {};

  private readonly scene = new THREE.Scene();
  private readonly mirror = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private records: ModuleRecord[] = [];
  private byIndex = new Map<string, ModuleRecord>();
  private links: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  private grid: THREE.GridHelper | null = null;
  /** Macros drawn faded and ignored by picking. */
  private hidden = new Set<string>();
  private hovered: ModuleRecord | null = null;
  private selected: ModuleRecord | null = null;
  /** Modules flagged for a pending destructive action, drawn in red. */
  private marked = new Set<string>();
  private linksVisible = true;
  private resizeObserver: ResizeObserver;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(BACKGROUND);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 10, 200_000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.fog = new THREE.Fog(BACKGROUND, 20_000, 60_000);
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2230, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, 2, 1.5);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.8);
    fill.position.set(-1.5, -1, -1);
    this.scene.add(sun, fill, this.createStars());

    this.mirror.scale.z = -1;
    this.scene.add(this.mirror);

    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  /**
   * Shows a plan. With `keepView` (e.g. after editing the plan) the camera and
   * hidden modules stay as they were; otherwise the view is reset and framed.
   */
  load(plan: ConstructionPlan, { keepView = false } = {}): void {
    const hidden = new Set(this.hidden);
    this.clear();
    if (keepView) this.hidden = hidden;

    for (const entry of plan.entries) {
      const info = describeModule(entry.macro);
      const material = new THREE.MeshStandardMaterial({
        color: CATEGORIES[info.category].color,
        roughness: 0.55,
        metalness: 0.25,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geometryFor(info.shape), material);
      mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
      mesh.quaternion.fromArray(entryQuaternion(entry));

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 20),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: EDGE_OPACITY }),
      );
      mesh.add(edges);
      this.mirror.add(mesh);

      const record: ModuleRecord = { entry, info, mesh, edges };
      this.records.push(record);
      this.byIndex.set(entry.index, record);
    }

    this.links = this.createLinks(plan);
    this.mirror.add(this.links);

    this.grid = this.createGrid();
    this.scene.add(this.grid);

    this.restyle();
    if (!keepView) this.fit();
  }

  /** Frames the camera on the whole station. */
  fit(): void {
    const box = this.stationBox();
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 0.9;
    const direction = new THREE.Vector3(0.9, 0.55, 1).normalize();
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.controls.target.copy(center);
    this.controls.update();
  }

  /** Station size in metres [x, y, z]. */
  size(): [number, number, number] {
    const s = this.stationBox().getSize(new THREE.Vector3());
    return [s.x, s.y, s.z];
  }

  select(index: string | null, focus = false): void {
    this.selected = index ? (this.byIndex.get(index) ?? null) : null;
    this.restyle();
    if (this.selected && focus) this.controls.target.copy(this.selected.mesh.getWorldPosition(new THREE.Vector3()));
    this.onSelect(this.selected);
  }

  /** Currently selected module, or null. */
  selection(): ModulePick | null {
    return this.selected;
  }

  /** Draws these modules in red (e.g. while confirming their deletion); an empty list clears it. */
  setMarked(indices: string[]): void {
    this.marked = new Set(indices);
    this.restyle();
  }

  isMacroVisible(macro: string): boolean {
    return !this.hidden.has(macro);
  }

  setMacrosVisible(macros: string[], visible: boolean): void {
    for (const macro of macros) {
      if (visible) this.hidden.delete(macro);
      else this.hidden.add(macro);
    }
    this.restyle();
  }

  setLinksVisible(visible: boolean): void {
    this.linksVisible = visible;
    if (this.links) this.links.visible = visible;
  }

  dispose(): void {
    this.clear();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- internals ----------

  private clear(): void {
    for (const r of this.records) {
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      r.edges.geometry.dispose();
      r.edges.material.dispose();
      this.mirror.remove(r.mesh);
    }
    if (this.links) {
      this.links.geometry.dispose();
      this.links.material.dispose();
      this.mirror.remove(this.links);
    }
    if (this.grid) {
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.scene.remove(this.grid);
    }
    this.records = [];
    this.byIndex.clear();
    this.links = null;
    this.grid = null;
    this.hovered = null;
    this.selected = null;
    this.marked.clear();
    this.hidden.clear();
  }

  private stationBox(): THREE.Box3 {
    this.mirror.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const r of this.records) box.expandByObject(r.mesh);
    return box;
  }

  /** Line from each module origin to its predecessor's. */
  private createLinks(plan: ConstructionPlan) {
    const points: THREE.Vector3[] = [];
    for (const entry of plan.entries) {
      const parent = entry.predecessor && this.byIndex.get(entry.predecessor.index);
      const self = this.byIndex.get(entry.index);
      if (parent && self) points.push(parent.mesh.position.clone(), self.mesh.position.clone());
    }
    const links = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: LINK_COLOR, transparent: true, opacity: 0.85, depthTest: false }),
    );
    links.renderOrder = 10;
    links.visible = this.linksVisible;
    return links;
  }

  private createGrid(): THREE.GridHelper {
    const box = this.stationBox();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.ceil((Math.max(size.x, size.z, 2000) * 1.6) / 1000) * 1000;
    const grid = new THREE.GridHelper(span, span / 500, 0x2a3a4d, 0x18222e);
    grid.position.set(center.x, box.min.y - 300, center.z);
    return grid;
  }

  private createStars(): THREE.Points {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(80_000 + Math.random() * 20_000);
      positions.set([v.x, v.y, v.z], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x9fb2c8, size: 1.6, sizeAttenuation: false, fog: false }),
    );
  }

  private restyle(): void {
    for (const r of this.records) {
      const dimmed = this.hidden.has(r.entry.macro);
      const m = r.mesh.material;
      m.opacity = dimmed ? 0.08 : 1;
      m.depthWrite = !dimmed;
      r.edges.material.opacity = dimmed ? 0.04 : EDGE_OPACITY;

      if (this.marked.has(r.entry.index)) {
        m.emissive.set(MARK_COLOR);
        m.emissiveIntensity = 0.6;
        r.edges.material.opacity = 1;
      } else if (r === this.selected) {
        m.emissive.set(0xffffff);
        m.emissiveIntensity = 0.35;
        r.edges.material.opacity = 1;
      } else if (r === this.hovered) {
        m.emissive.set(CATEGORIES[r.info.category].color);
        m.emissiveIntensity = 0.35;
      } else {
        m.emissive.set(0x000000);
      }
    }
  }

  private pick(event: PointerEvent): { record: ModuleRecord | null; x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ndc = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const candidates = this.records.filter((r) => !this.hidden.has(r.entry.macro));
    const hit = this.raycaster.intersectObjects(candidates.map((r) => r.mesh), false)[0];
    const record = hit ? (candidates.find((r) => r.mesh === hit.object) ?? null) : null;
    return { record, x, y };
  }

  private bindPointer(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("pointermove", (event) => {
      const { record, x, y } = this.pick(event);
      if (record !== this.hovered) {
        this.hovered = record;
        this.restyle();
      }
      canvas.style.cursor = record ? "pointer" : "";
      this.onHover(record, x, y);
    });

    canvas.addEventListener("pointerleave", () => {
      this.hovered = null;
      this.restyle();
      this.onHover(null, 0, 0);
    });

    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener("pointerup", (event) => {
      const start = this.pointerDown;
      this.pointerDown = null;
      // A drag to orbit or pan the camera does not count as a click.
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
      const { record, x, y } = this.pick(event);
      if (event.button === 0) this.select(record?.entry.index ?? null);
      else if (event.button === 2 && record) {
        this.select(record.entry.index);
        this.onContextMenu(record, x, y);
      }
    });

    // Right-drag pans the camera; the browser menu would only get in the way.
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
