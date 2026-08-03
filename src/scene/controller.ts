/**
 * MathBoxController — top-level orchestrator.
 *
 * Given a container element and a MathScene definition, this class:
 * 1. Creates a SceneEnvironment (three.js scene/camera/renderer/lights).
 * 2. Creates ObjectRenderers for each scene object.
 * 3. Runs an animation loop that refreshes renderers and draws frames.
 * 4. Supports scene updates (add/remove/modify objects) via `updateScene()`.
 *
 * Usage:
 *   const controller = new MathBoxController(container, scene, { labelRenderer });
 *   controller.start();
 *   // ... later, when scene changes:
 *   controller.updateScene(newScene);
 *   // cleanup:
 *   controller.dispose();
 */

import * as THREE from "three";
import type { MathScene, SceneObject, Parameter, Vec3, CameraPose } from "../types/index.js";
import { SceneEnvironment } from "./environment.js";
import type { LabelRenderer } from "./environment.js";
import { SimpleEvaluator } from "../core/evaluator.js";
import type { Evaluator, EvalScope } from "../core/evaluator.js";
import { sceneBounds, computeAutoFit } from "../core/bounds.js";
import { createRenderer, registerDefaultRenderers } from "../objects/registry.js";
import type { ObjectRenderer } from "../objects/base.js";

export interface MathBoxControllerOptions {
    /** Custom label renderer (e.g. for LaTeX/KaTeX support). */
    labelRenderer?: LabelRenderer | null;
}

/** Compare two Vec3 arrays for equality. */
function vec3Equal(a: Vec3, b: Vec3): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Compare two originPosition tuples for equality. */
function originEqual(a: [number, number] | undefined, b: [number, number] | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a[0] === b[0] && a[1] === b[1];
}

export class MathBoxController {
    private env: SceneEnvironment;
    private evaluator: Evaluator;
    private scene: MathScene;
    private renderers = new Map<string, ObjectRenderer>();
    private objectsRoot: THREE.Group;
    private animationId = 0;
    private disposed = false;
    /** Snapshot of last applied camera config, to detect panel-driven changes. */
    private lastCameraConfig: { position: Vec3; lookAt: Vec3; originPosition: [number, number] | undefined };
    private labelRenderer?: LabelRenderer;
    /** Active camera animation (null when idle). */
    private cameraAnim: {
        startPos: THREE.Vector3;
        startTarget: THREE.Vector3;
        endPos: THREE.Vector3;
        endTarget: THREE.Vector3;
        startTime: number;
        duration: number;
        savedControls: { rotate: boolean; zoom: boolean; pan: boolean };
    } | null = null;

    constructor(container: HTMLElement, scene: MathScene, options?: MathBoxControllerOptions) {
        registerDefaultRenderers();

        const rect = container.getBoundingClientRect();
        const width = rect.width || container.clientWidth || 800;
        const height = rect.height || container.clientHeight || 400;

        this.env = new SceneEnvironment(container, scene, { width, height, labelRenderer: options?.labelRenderer });
        this.scene = scene;
        this.evaluator = new SimpleEvaluator();
        this.labelRenderer = options?.labelRenderer ?? undefined;
        this.lastCameraConfig = { position: [0,0,0], lookAt: [0,0,0], originPosition: undefined };
        this.syncCameraSnapshot(scene.config.camera);

        // Root group for all object renderers.
        // Scaled by per-axis scale so objects match the axis/grid visual scaling.
        this.objectsRoot = new THREE.Group();
        this.applyAxisScales();
        this.env.scene.add(this.objectsRoot);

        this.buildRenderers();

        // Auto-fit camera after renderers are built
        if (scene.config.camera.autoFit) {
            this.runAutoFit();
        }

        // If a saved pose exists, animate from the initial view to the saved pose.
        if (scene.config.camera.savedPose) {
            this.animateToCameraPose(scene.config.camera.savedPose);
        }
    }

    private getScope(): EvalScope {
        const scope: EvalScope = {};
        for (const param of this.scene.parameters) {
            scope[param.symbol] = param.value;
        }
        return scope;
    }

    private buildRenderers(): void {
        const scope = this.getScope();
        const [w, h] = this.env.getResolution();

        for (const obj of this.scene.objects) {
            this.createRendererFor(obj, scope, w, h);
        }
    }

    private createRendererFor(obj: SceneObject, scope: EvalScope, w: number, h: number): void {
        const renderer = createRenderer(obj.type, this.objectsRoot, this.evaluator, scope, Math.max(w, h));
        if (!renderer) return;
        renderer.setLabelRenderer(this.labelRenderer);
        renderer.update(obj);
        renderer.setVisible(obj.visible);
        this.renderers.set(obj.id, renderer);
    }

    /** Update the entire scene definition and rebuild renderers as needed. */
    updateScene(scene: MathScene): void {
        this.scene = scene;

        // Axes + grid always update
        this.env.updateAxes(scene);
        this.env.updateGrid(scene);
        this.applyAxisScales();

        const scope = this.getScope();
        const [w, h] = this.env.getResolution();

        // Diff: remove renderers for deleted objects, update existing ones
        const newIds = new Set(scene.objects.map((o) => o.id));
        for (const id of Array.from(this.renderers.keys())) {
            if (!newIds.has(id)) {
                const renderer = this.renderers.get(id)!;
                renderer.dispose();
                this.renderers.delete(id);
            }
        }

        for (const obj of scene.objects) {
            const existing = this.renderers.get(obj.id);
            if (existing) {
                existing.update(obj);
                existing.setVisible(obj.visible);
            } else {
                this.createRendererFor(obj, scope, w, h);
            }
        }

        // Always sync control enable flags (rotate/zoom/pan) — these don't
        // affect camera pose, so it's safe to apply on every update.
        this.env.syncControls(scene);

        // Camera pose: only apply when the panel-driven config actually changed.
        // This preserves the user's mouse-driven camera state (orbit/pan/zoom).
        const cam = scene.config.camera;
        const posChanged = !vec3Equal(cam.position, this.lastCameraConfig.position);
        const lookChanged = !vec3Equal(cam.lookAt, this.lastCameraConfig.lookAt);
        const originChanged = !originEqual(cam.originPosition, this.lastCameraConfig.originPosition);

        if (cam.autoFit) {
            this.runAutoFit();
            this.syncCameraSnapshot(cam);
        } else if (cam.savedPose && !this.poseEqual(cam.savedPose, this.env.getCameraPose())) {
            this.animateToCameraPose(cam.savedPose);
            this.syncCameraSnapshot(cam);
        } else if (posChanged || lookChanged || originChanged) {
            this.env.updateCamera(scene);
            this.syncCameraSnapshot(cam);
        }
    }

    /** Compare a CameraPose to the current live camera state. */
    private poseEqual(pose: CameraPose, live: CameraPose): boolean {
        return vec3Equal(pose.position, live.position) && vec3Equal(pose.target, live.target);
    }

    /** Apply per-axis scale to the objectsRoot group so rendered objects
     *  match the visual scaling of axes and grid. */
    private applyAxisScales(): void {
        const { x, y, z } = this.scene.config.axes;
        this.objectsRoot.scale.set(x.scale, y.scale, z.scale);
    }

    /** Update lastCameraConfig snapshot from scene camera config. */
    private syncCameraSnapshot(cam: MathScene["config"]["camera"]): void {
        this.lastCameraConfig = {
            position: [...cam.position] as Vec3,
            lookAt: [...cam.lookAt] as Vec3,
            originPosition: cam.originPosition ? [...cam.originPosition] as [number, number] : undefined,
        };
    }

    /** Update parameter values (for slider interaction). */
    updateParameters(parameters: Parameter[]): void {
        this.scene = { ...this.scene, parameters };
        for (const obj of this.scene.objects) {
            const renderer = this.renderers.get(obj.id);
            if (renderer && renderer.needsRefresh()) {
                renderer.refresh(obj);
            }
        }
    }

    /** Compute bounds and apply auto-fit camera. */
    private runAutoFit(): void {
        const bounds = sceneBounds(this.scene);
        const { fov, aspect } = this.env.camera;
        const dimension = this.scene.config.dimension;
        const result = computeAutoFit(bounds, fov, aspect, dimension);
        this.env.applyAutoFit(result.position, result.lookAt, result.originPosition, dimension);
    }

    /** Reset camera to auto-fit view (e.g. after user has moved/zoomed). */
    resetView(): void {
        this.runAutoFit();
    }

    /** Get the current camera position + target as a pose snapshot. */
    getCameraPose(): CameraPose {
        return this.env.getCameraPose();
    }

    /** Instantly apply a camera pose (no animation). */
    applyCameraPose(pose: CameraPose): void {
        this.cancelCameraAnim();
        this.env.applyCameraPose(pose);
    }

    /**
     * Animate the camera from its current pose to the target pose over
     * `duration` ms (default 800). User interaction is disabled during
     * the animation and restored afterwards.
     */
    animateToCameraPose(pose: CameraPose, duration = 800): void {
        this.cancelCameraAnim();

        const controls = this.env.controls;
        this.cameraAnim = {
            startPos: this.env.camera.position.clone(),
            startTarget: controls.target.clone(),
            endPos: new THREE.Vector3(...pose.position),
            endTarget: new THREE.Vector3(...pose.target),
            startTime: performance.now(),
            duration,
            savedControls: {
                rotate: controls.enableRotate,
                zoom: controls.enableZoom,
                pan: controls.enablePan,
            },
        };
        // Disable user interaction during animation.
        controls.enableRotate = false;
        controls.enableZoom = false;
        controls.enablePan = false;
    }

    /** Cancel any in-progress camera animation, restoring controls. */
    private cancelCameraAnim(): void {
        if (!this.cameraAnim) return;
        const controls = this.env.controls;
        controls.enableRotate = this.cameraAnim.savedControls.rotate;
        controls.enableZoom = this.cameraAnim.savedControls.zoom;
        controls.enablePan = this.cameraAnim.savedControls.pan;
        this.cameraAnim = null;
    }

    /** Advance the camera animation by one frame. Called from the render loop. */
    private updateCameraAnim(): void {
        if (!this.cameraAnim) return;
        const anim = this.cameraAnim;
        const elapsed = performance.now() - anim.startTime;
        const t = Math.min(elapsed / anim.duration, 1);
        // easeInOutCubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        this.env.camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
        this.env.controls.target.lerpVectors(anim.startTarget, anim.endTarget, ease);
        this.env.controls.update();

        if (t >= 1) {
            // Animation complete — restore controls.
            const controls = this.env.controls;
            controls.enableRotate = anim.savedControls.rotate;
            controls.enableZoom = anim.savedControls.zoom;
            controls.enablePan = anim.savedControls.pan;
            this.cameraAnim = null;
        }
    }

    /** Start the render loop. */
    start(): void {
        const loop = () => {
            if (this.disposed) return;
            this.animationId = requestAnimationFrame(loop);
            this.updateCameraAnim();
            this.env.controls.update();
            this.env.render();
        };
        this.animationId = requestAnimationFrame(loop);
    }

    /** Stop the render loop. */
    stop(): void {
        cancelAnimationFrame(this.animationId);
    }

    /** Clean up all resources. */
    dispose(): void {
        this.disposed = true;
        this.stop();
        this.cancelCameraAnim();
        for (const renderer of Array.from(this.renderers.values())) {
            renderer.dispose();
        }
        this.renderers.clear();
        this.env.dispose();
    }
}
