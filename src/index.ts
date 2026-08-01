/**
 * MathBox-Light
 *
 * A lightweight TypeScript math visualization library built on three.js r185.
 *
 * Inspired by MathBox (https://github.com/unconed/mathbox) but rewritten from
 * scratch with modern three.js, TypeScript, and a simplified architecture.
 */

// Types
export type {
    HexColor,
    ColormapName,
    Vec3,
    Range,
    Bounds3D,
    SceneObjectBase,
    FunctionObject,
    SurfaceObject,
    ParametricCurveObject,
    PointObject,
    LineObject,
    VectorObject,
    SceneObject,
    SceneObjectType,
    Parameter,
    AxisConfig,
    CoordinateSystem,
    GridPlaneConfig,
    GridConfig,
    SceneConfig,
    MathScene,
} from "./types/index.js";

// Core
export { SimpleEvaluator } from "./core/evaluator.js";
export type { Evaluator, EvalScope } from "./core/evaluator.js";
export { sampleFunction, sampleSurface, sampleParametric } from "./core/sampling.js";
export { hexToColor, hexToNumber, colormapAt, COLORMAP_NAMES } from "./core/color.js";
export { sceneBounds, computeAutoFit } from "./core/bounds.js";
export type { AutoFitResult } from "./core/bounds.js";

// Helpers
export function vec3ToString(v: import("./types/index.js").Vec3): string {
    const [x, y, z] = v;
    return `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
}

/** Parse a Vec3 from a string like "(1, 2, 3)" or "1, 2, 3". Values that cannot be parsed default to 0. */
export function vec3FromString(s: string): import("./types/index.js").Vec3 {
    const cleaned = s.replace(/[()[\]\s]/g, "");
    const parts = cleaned.split(",");
    const parse = (i: number): number => {
        const v = parseFloat(parts[i]);
        return Number.isNaN(v) ? 0 : v;
    };
    return [parse(0), parse(1), parse(2)];
}

// Objects
export { ObjectRenderer } from "./objects/base.js";
export { FunctionRenderer } from "./objects/function-renderer.js";
export { SurfaceRenderer } from "./objects/surface-renderer.js";
export { ParametricRenderer } from "./objects/parametric-renderer.js";
export { PointRenderer } from "./objects/point-renderer.js";
export { LineRenderer } from "./objects/line-renderer.js";
export { VectorRenderer } from "./objects/vector-renderer.js";
export { createRenderer, registerRenderer, registerDefaultRenderers } from "./objects/registry.js";
export type { RendererFactory } from "./objects/registry.js";

// Scene
export { SceneEnvironment } from "./scene/environment.js";
export type { SceneEnvironmentOptions, LabelRenderer } from "./scene/environment.js";
export { MathBoxController } from "./scene/controller.js";

// Convenience: create a default scene for testing
export function createDefaultScene(): import("./types/index.js").MathScene {
    return {
        version: 1,
        config: {
            coordinateSystem: "cartesian",
            dimension: "2D",
            axes: {
                x: { visible: true, range: [-5, 5], scale: 1, label: "x", color: "#cc5555" },
                y: { visible: true, range: [-3, 3], scale: 1, label: "y", color: "#5577cc" },
                z: { visible: true, range: [-3, 3], scale: 1, label: "z", color: "#55aa55" },
            },
            grid: {
                visible: true,
                xy: { visible: true, step: 1, color: "#cccccc", opacity: 0.5 },
                xz: { visible: true, step: 1, color: "#cccccc", opacity: 0.5 },
                yz: { visible: true, step: 1, color: "#cccccc", opacity: 0.5 },
            },
            camera: {
                canRotate: true,
                canZoom: true,
                canPan: true,
                position: [4, 3, 6],
                lookAt: [0, 0, 0],
            },
        },
        parameters: [],
        objects: [
            {
                id: "fn1",
                type: "function",
                visible: true,
                color: "#3b82f6",
                opacity: 1,
                showLabel: false,
                expr: "sin(x)",
                domain: [-5, 5],
                samples: 200,
                width: 3,
                closed: false,
            },
        ],
    };
}
