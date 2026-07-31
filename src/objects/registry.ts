/**
 * Object renderer factory — maps SceneObject types to their renderers.
 *
 * Extensible: register new types via `registerRenderer`.
 */

import type * as THREE from "three";
import type { SceneObject, SceneObjectType } from "../types/index.js";
import type { ObjectRenderer } from "./base.js";
import { FunctionRenderer } from "./function-renderer.js";
import { SurfaceRenderer } from "./surface-renderer.js";
import { ParametricRenderer } from "./parametric-renderer.js";
import { PointRenderer } from "./point-renderer.js";
import { LineRenderer } from "./line-renderer.js";
import { VectorRenderer } from "./vector-renderer.js";
import type { Evaluator, EvalScope } from "../core/evaluator.js";

export type RendererFactory = (
    parent: THREE.Object3D,
    evaluator: Evaluator,
    scope: EvalScope,
    resolution: number,
) => ObjectRenderer;

const registry = new Map<SceneObjectType, RendererFactory>();

export function registerRenderer(type: SceneObjectType, factory: RendererFactory): void {
    registry.set(type, factory);
}

export function createRenderer(
    type: SceneObjectType,
    parent: THREE.Object3D,
    evaluator: Evaluator,
    scope: EvalScope,
    resolution: number,
): ObjectRenderer | null {
    const factory = registry.get(type);
    if (!factory) {
        console.warn(`[mathbox-light] No renderer registered for type "${type}"`);
        return null;
    }
    return factory(parent, evaluator, scope, resolution);
}

// --- Default registrations ---

export function registerDefaultRenderers(): void {
    registerRenderer("function", (parent, evaluator, scope, resolution) =>
        new FunctionRenderer(parent, evaluator, scope, resolution));
    registerRenderer("surface", (parent, evaluator, scope) =>
        new SurfaceRenderer(parent, evaluator, scope));
    registerRenderer("parametric", (parent, evaluator, scope, resolution) =>
        new ParametricRenderer(parent, evaluator, scope, resolution));
    registerRenderer("point", (parent) => new PointRenderer(parent));
    registerRenderer("line", (parent, _eval, _scope, resolution) =>
        new LineRenderer(parent, resolution));
    registerRenderer("vector", (parent) => new VectorRenderer(parent));
}

export type { ObjectRenderer };
export type { SceneObject };
