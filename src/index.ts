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
    Vec3,
    Range,
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
    SceneConfig,
    MathScene,
} from "./types/index.js";

// Core
export { SimpleEvaluator } from "./core/evaluator.js";
export type { Evaluator, EvalScope } from "./core/evaluator.js";
export { sampleFunction, sampleSurface, sampleParametric } from "./core/sampling.js";
export { hexToColor, hexToNumber } from "./core/color.js";

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
export type { SceneEnvironmentOptions } from "./scene/environment.js";
export { MathBoxController } from "./scene/controller.js";

// Convenience: create a default scene for testing
export function createDefaultScene(): import("./types/index.js").MathScene {
    return {
        version: 1,
        config: {
            coordinateSystem: "cartesian",
            axes: {
                x: { visible: true, range: [-5, 5], scale: 1, label: "x" },
                y: { visible: true, range: [-3, 3], scale: 1, label: "y" },
                z: { visible: true, range: [-3, 3], scale: 1, label: "z" },
            },
            grid: { visible: true },
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
