/**
 * Scene environment — sets up three.js scene, camera, renderer, lights,
 * OrbitControls, axes, and grid based on MathScene config.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MathScene, AxisConfig, Vec3 } from "../types/index.js";
import { hexToNumber } from "../core/color.js";
import { makeLabelSprite } from "../core/label.js";
import type { LabelRenderer } from "../core/label.js";
export type { LabelRenderer } from "../core/label.js";

export interface SceneEnvironmentOptions {
    /** CSS pixel width of the container. */
    width: number;
    /** CSS pixel height of the container. */
    height: number;
    /** Custom label renderer (e.g. for LaTeX/KaTeX support). */
    labelRenderer?: LabelRenderer | null;
}

export class SceneEnvironment {
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;
    readonly controls: OrbitControls;
    private readonly light: THREE.DirectionalLight;
    private readonly ambient: THREE.AmbientLight;
    private readonly axesGroup: THREE.Group;
    private readonly gridGroup: THREE.Group;
    private container: HTMLElement;
    private resizeObserver: ResizeObserver | null = null;
    private labelRenderer: LabelRenderer | null = null;

    constructor(container: HTMLElement, scene: MathScene, options: SceneEnvironmentOptions) {
        this.container = container;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(options.width, options.height);
        this.renderer.setClearColor(0xffffff, 1);
        container.appendChild(this.renderer.domElement);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            options.width / options.height,
            0.1,
            1000,
        );
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        // Only apply manual camera config; autoFit is handled by the controller.
        if (!scene.config.camera.autoFit) {
            this.applyCamera(scene);
        }

        // Lights
        this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambient);
        this.light = new THREE.DirectionalLight(0xffffff, 1.2);
        this.light.position.set(5, 10, 7);
        this.scene.add(this.light);

        // Axes + Grid
        this.axesGroup = new THREE.Group();
        this.gridGroup = new THREE.Group();
        this.scene.add(this.axesGroup);
        this.scene.add(this.gridGroup);

        // Set label renderer before building axes so labels use it.
        this.labelRenderer = options.labelRenderer ?? null;

        this.updateAxes(scene);
        this.updateGrid(scene);

        // Auto-resize
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(container);
    }

    private onResize(): void {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    /** Get current pixel resolution (for LineMaterial). */
    getResolution(): [number, number] {
        return [this.container.clientWidth, this.container.clientHeight];
    }

    /** Set a custom label renderer (e.g. for LaTeX/KaTeX support). */
    setLabelRenderer(renderer: LabelRenderer | null): void {
        this.labelRenderer = renderer;
    }

    private makeAxis(axis: number, config: AxisConfig): THREE.Object3D {
        const [min, max] = config.range;
        const length = (max - min) * config.scale;
        const dir = new THREE.Vector3(
            axis === 1 ? 1 : 0,
            axis === 2 ? 1 : 0,
            axis === 3 ? 1 : 0,
        );
        // Start at min so the axis spans [min, max], not [0, max-min].
        const origin = dir.clone().multiplyScalar(min * config.scale);
        const color = config.color ? hexToNumber(config.color) : 0x000000;
        const arrow = new THREE.ArrowHelper(
            dir,
            origin,
            length,
            color,
            Math.min(length * 0.05, 0.3),
            Math.min(length * 0.03, 0.2),
        );

        // Add label at the arrow tip.
        // ArrowHelper rotates so its local +Y aligns with the axis direction,
        // so place the sprite along local Y (not world axis).
        if (config.label) {
            const labelSize = 0.3;   // fixed world-space size
            const sprite = makeLabelSprite(config.label, config.color ?? "#000000", this.labelRenderer ?? undefined, labelSize);
            sprite.position.set(0, length + labelSize * 0.8, 0);
            arrow.add(sprite);
        }

        return arrow;
    }

    updateAxes(scene: MathScene): void {
        this.axesGroup.clear();
        const axes = [
            { axis: 1, config: scene.config.axes.x },
            { axis: 2, config: scene.config.axes.y },
            { axis: 3, config: scene.config.axes.z },
        ];
        for (const { axis, config } of axes) {
            if (config.visible) {
                this.axesGroup.add(this.makeAxis(axis, config));
            }
        }
    }

    updateGrid(scene: MathScene): void {
        this.gridGroup.clear();
        const grid = scene.config.grid;
        if (!grid.visible) return;

        const { x, y, z } = scene.config.axes;

        type PlaneName = "xy" | "xz" | "yz";
        const planes: PlaneName[] = [];
        if (grid.xy?.visible !== false) planes.push("xy");
        if (grid.xz?.visible !== false) planes.push("xz");
        if (grid.yz?.visible !== false) planes.push("yz");

        for (const plane of planes) {
            const planeCfg = grid[plane];
            const step = planeCfg?.step ?? 1;
            const color = planeCfg?.color ? hexToNumber(planeCfg.color) : 0xcccccc;
            const opacity = planeCfg?.opacity ?? 0.5;
            const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });

            // Two axes that span this plane, with their ranges and scales.
            let aRange: [number, number], aScale: number;
            let bRange: [number, number], bScale: number;
            let aIdx: 0 | 1 | 2, bIdx: 0 | 1 | 2;

            if (plane === "xy") {
                aRange = x.range; aScale = x.scale; aIdx = 0;
                bRange = y.range; bScale = y.scale; bIdx = 1;
            } else if (plane === "xz") {
                aRange = x.range; aScale = x.scale; aIdx = 0;
                bRange = z.range; bScale = z.scale; bIdx = 2;
            } else {
                aRange = y.range; aScale = y.scale; aIdx = 1;
                bRange = z.range; bScale = z.scale; bIdx = 2;
            }

            // Generate grid line positions from origin outward, stopping at axis range.
            // step is in data space (axis units); positions are then scaled to world space.
            const genLines = (range: [number, number], scale: number): number[] => {
                const [min, max] = range;
                const lines: number[] = [];
                // Positive direction from origin
                for (let v = 0; v <= max + 1e-9; v += step) {
                    lines.push(v * scale);
                }
                // Negative direction from origin (skip 0, already added)
                for (let v = -step; v >= min - 1e-9; v -= step) {
                    lines.push(v * scale);
                }
                return lines;
            };

            const aLines = genLines(aRange, aScale);
            const bLines = genLines(bRange, bScale);

            // Plane bounds (axis range × scale) for line endpoints.
            const aMin = aRange[0] * aScale;
            const aMax = aRange[1] * aScale;
            const bMin = bRange[0] * bScale;
            const bMax = bRange[1] * bScale;

            const points: THREE.Vector3[] = [];

            // Helper to create a point on the plane.
            const mkPoint = (av: number, bv: number): THREE.Vector3 => {
                const p: [number, number, number] = [0, 0, 0];
                p[aIdx] = av;
                p[bIdx] = bv;
                return new THREE.Vector3(...p);
            };

            // Lines along b-axis at each a-line position.
            for (const av of aLines) {
                points.push(mkPoint(av, bMin));
                points.push(mkPoint(av, bMax));
            }
            // Lines along a-axis at each b-line position.
            for (const bv of bLines) {
                points.push(mkPoint(aMin, bv));
                points.push(mkPoint(aMax, bv));
            }

            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const segs = new THREE.LineSegments(geom, mat);
            this.gridGroup.add(segs);
        }
    }

    private applyCamera(scene: MathScene): void {
        const { position, lookAt, originPosition } = scene.config.camera;
        this.camera.position.set(...position);
        this.camera.lookAt(...lookAt);
        this.controls.target.set(...lookAt);
        this.controls.enableRotate = scene.config.camera.canRotate;
        this.controls.enableZoom = scene.config.camera.canZoom;
        this.controls.enablePan = scene.config.camera.canPan;

        // Shift the camera so the world origin appears at the requested screen position.
        if (originPosition) {
            const [fx, fy] = originPosition;
            // Direction from lookAt to position (the view direction, pointing toward camera).
            const viewDir = new THREE.Vector3(...position).sub(new THREE.Vector3(...lookAt)).normalize();
            // Camera's right and up vectors (in world space).
            const worldUp = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(viewDir, worldUp).normalize();
            const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();

            const distance = new THREE.Vector3(...position).sub(new THREE.Vector3(...lookAt)).length();
            const fovRad = (this.camera.fov * Math.PI) / 180;
            const viewHeight = 2 * distance * Math.tan(fovRad / 2);
            const viewWidth = viewHeight * this.camera.aspect;

            // Fractional offset: [0.2, 0.2] means origin should be at 20% from lower-left,
            // which is -30% from center → shift camera target in the opposite direction.
            const dx = (fx - 0.5) * viewWidth;
            const dy = -(fy - 0.5) * viewHeight;

            const worldOffset = new THREE.Vector3()
                .addScaledVector(right, dx)
                .addScaledVector(up, dy);

            this.camera.position.add(worldOffset);
            this.controls.target.add(worldOffset);
        }

        this.controls.update();
    }

    updateCamera(scene: MathScene): void {
        this.applyCamera(scene);
    }

    /** Sync only the control enable flags (rotate/zoom/pan) without
     *  touching camera position/lookAt — safe to call on every scene update
     *  because it never overrides the user's mouse-driven camera state. */
    syncControls(scene: MathScene): void {
        this.controls.enableRotate = scene.config.camera.canRotate;
        this.controls.enableZoom = scene.config.camera.canZoom;
        this.controls.enablePan = scene.config.camera.canPan;
    }

    /**
     * Apply auto-fit camera settings computed from scene bounds.
     * Temporarily replaces the scene's camera config with the computed values.
     */
    applyAutoFit(position: Vec3, lookAt: Vec3, originPosition: [number, number], dimension: "2D" | "3D"): void {
        this.camera.position.set(...position);
        this.camera.lookAt(...lookAt);
        this.controls.target.set(...lookAt);

        if (dimension === "2D") {
            // 2D: camera looks straight down z-axis, so screen X/Y maps directly to world X/Y.
            // Just shift position and target by the originPosition offset.
            const distance = new THREE.Vector3(...position).sub(new THREE.Vector3(...lookAt)).length();
            const fovRad = (this.camera.fov * Math.PI) / 180;
            const viewHeight = 2 * distance * Math.tan(fovRad / 2);
            const viewWidth = viewHeight * this.camera.aspect;

            const [fx, fy] = originPosition;
            const dx = (fx - 0.5) * viewWidth;
            const dy = -(fy - 0.5) * viewHeight;

            this.camera.position.x += dx;
            this.camera.position.y += dy;
            this.controls.target.x += dx;
            this.controls.target.y += dy;
        } else {
            // 3D: camera is at an angle, so compute right/up vectors for proper offset.
            const viewDir = new THREE.Vector3(...position).sub(new THREE.Vector3(...lookAt)).normalize();
            const worldUp = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(viewDir, worldUp).normalize();
            const up = new THREE.Vector3().crossVectors(right, viewDir).normalize();

            const distance = new THREE.Vector3(...position).sub(new THREE.Vector3(...lookAt)).length();
            const fovRad = (this.camera.fov * Math.PI) / 180;
            const viewHeight = 2 * distance * Math.tan(fovRad / 2);
            const viewWidth = viewHeight * this.camera.aspect;

            const [fx, fy] = originPosition;
            const dx = (fx - 0.5) * viewWidth;
            const dy = -(fy - 0.5) * viewHeight;

            const worldOffset = new THREE.Vector3()
                .addScaledVector(right, dx)
                .addScaledVector(up, dy);

            this.camera.position.add(worldOffset);
            this.controls.target.add(worldOffset);
        }

        this.controls.update();
    }

    render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    dispose(): void {
        this.resizeObserver?.disconnect();
        this.controls.dispose();
        this.renderer.dispose();
        if (this.renderer.domElement.parentElement === this.container) {
            this.container.removeChild(this.renderer.domElement);
        }
        // Dispose geometries and materials in scene
        this.scene.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                const mat = obj.material;
                if (Array.isArray(mat)) {
                    mat.forEach((m) => m.dispose());
                } else {
                    mat.dispose();
                }
            }
        });
    }
}
