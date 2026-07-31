/**
 * Scene environment — sets up three.js scene, camera, renderer, lights,
 * OrbitControls, axes, and grid based on MathScene config.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MathScene, AxisConfig } from "../types/index.js";

export interface SceneEnvironmentOptions {
    /** CSS pixel width of the container. */
    width: number;
    /** CSS pixel height of the container. */
    height: number;
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
        this.camera.position.set(...scene.config.camera.position);
        this.camera.lookAt(...scene.config.camera.lookAt);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableRotate = scene.config.camera.canRotate;
        this.controls.enableZoom = scene.config.camera.canZoom;
        this.controls.enablePan = scene.config.camera.canPan;
        this.controls.target.set(...scene.config.camera.lookAt);

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

    private makeAxis(axis: number, config: AxisConfig): THREE.Object3D {
        const [min, max] = config.range;
        const length = (max - min) * config.scale;
        // Use a simple cylinder for the axis line
        const dir = new THREE.Vector3(
            axis === 1 ? 1 : 0,
            axis === 2 ? 1 : 0,
            axis === 3 ? 1 : 0,
        );
        const origin = new THREE.Vector3(0, 0, 0);
        const arrow = new THREE.ArrowHelper(
            dir,
            origin,
            length,
            0x000000,
            Math.min(length * 0.05, 0.3),
            Math.min(length * 0.03, 0.2),
        );
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
        if (!scene.config.grid.visible) return;

        const { x, y, z } = scene.config.axes;
        const size = Math.max(
            (x.range[1] - x.range[0]) * x.scale,
            (y.range[1] - y.range[0]) * y.scale,
            (z.range[1] - z.range[0]) * z.scale,
        );
        const gridColor = 0xcccccc;
        const gridMat = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.5 });

        // XY grid (z=0 plane)
        const gridXY = new THREE.GridHelper(size, 10, gridColor, gridColor);
        gridXY.material = gridMat;
        this.gridGroup.add(gridXY);
    }

    updateCamera(scene: MathScene): void {
        this.camera.position.set(...scene.config.camera.position);
        this.camera.lookAt(...scene.config.camera.lookAt);
        this.controls.target.set(...scene.config.camera.lookAt);
        this.controls.enableRotate = scene.config.camera.canRotate;
        this.controls.enableZoom = scene.config.camera.canZoom;
        this.controls.enablePan = scene.config.camera.canPan;
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
