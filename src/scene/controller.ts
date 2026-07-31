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
import type { MathScene, SceneObject, Parameter, Vec3 } from "../types/index.js";
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

    constructor(container: HTMLElement, scene: MathScene, options?: MathBoxControllerOptions) {
        registerDefaultRenderers();

        const rect = container.getBoundingClientRect();
        const width = rect.width || container.clientWidth || 800;
        const height = rect.height || container.clientHeight || 400;

        this.env = new SceneEnvironment(container, scene, { width, height, labelRenderer: options?.labelRenderer });
        this.scene = scene;
        this.evaluator = new SimpleEvaluator();
        this.lastCameraConfig = { position: [0,0,0], lookAt: [0,0,0], originPosition: undefined };
        this.syncCameraSnapshot(scene.config.camera);

        // Root group for all object renderers
        this.objectsRoot = new THREE.Group();
        this.env.scene.add(this.objectsRoot);

        this.buildRenderers();

        // Auto-fit camera after renderers are built
        if (scene.config.camera.autoFit) {
            this.runAutoFit();
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

        // Camera: only apply when the panel-driven config actually changed.
        // This preserves the user's mouse-driven camera state (orbit/pan/zoom).
        const cam = scene.config.camera;
        const posChanged = !vec3Equal(cam.position, this.lastCameraConfig.position);
        const lookChanged = !vec3Equal(cam.lookAt, this.lastCameraConfig.lookAt);
        const originChanged = !originEqual(cam.originPosition, this.lastCameraConfig.originPosition);

        if (cam.autoFit) {
            this.runAutoFit();
            this.syncCameraSnapshot(cam);
        } else if (posChanged || lookChanged || originChanged) {
            this.env.updateCamera(scene);
            this.syncCameraSnapshot(cam);
        }
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

    /** Start the render loop. */
    start(): void {
        const loop = () => {
            if (this.disposed) return;
            this.animationId = requestAnimationFrame(loop);
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
        for (const renderer of Array.from(this.renderers.values())) {
            renderer.dispose();
        }
        this.renderers.clear();
        this.env.dispose();
    }
}
