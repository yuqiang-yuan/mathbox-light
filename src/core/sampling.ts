/**
 * Sample generators — convert expression-based scene objects into
 * typed-array vertex data ready for GPU upload.
 */

import type { FunctionObject, SurfaceObject, ParametricCurveObject, ColormapName } from "../types/index.js";
import type { Evaluator, EvalScope } from "./evaluator.js";
import { colormapAt } from "./color.js";

export interface LineGeometryData {
    positions: Float32Array; // [x,y,z, x,y,z, ...]
    count: number;           // number of vertices
}

export interface SurfaceGeometryData {
    positions: Float32Array;
    indices: Uint32Array;
    colors: Float32Array | null; // per-vertex RGB when colormap is set, null otherwise
    width: number;  // samples in x
    height: number; // samples in y
}

/** Sample y = f(x) → 3D line data (z=0). */
export function sampleFunction(
    obj: FunctionObject,
    evaluator: Evaluator,
    scope: EvalScope,
): LineGeometryData {
    const [xMin, xMax] = obj.domain;
    const n = Math.max(2, obj.samples);
    const positions = new Float32Array(n * 3);
    const dx = (xMax - xMin) / (n - 1);

    for (let i = 0; i < n; i++) {
        const x = xMin + i * dx;
        const y = evaluator.eval(obj.expr, { ...scope, x });
        positions[i * 3]     = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;
    }
    return { positions, count: n };
}

/** Sample z = f(x,y) → surface grid. */
export function sampleSurface(
    obj: SurfaceObject,
    evaluator: Evaluator,
    scope: EvalScope,
): SurfaceGeometryData {
    const [xMin, xMax] = obj.domainX;
    const [yMin, yMax] = obj.domainY;
    const nx = Math.max(2, obj.samplesX);
    const ny = Math.max(2, obj.samplesY);
    const dx = (xMax - xMin) / (nx - 1);
    const dy = (yMax - yMin) / (ny - 1);

    const positions = new Float32Array(nx * ny * 3);
    let zMin = Infinity;
    let zMax = -Infinity;
    let p = 0;
    for (let j = 0; j < ny; j++) {
        const y = yMin + j * dy;
        for (let i = 0; i < nx; i++) {
            const x = xMin + i * dx;
            const z = evaluator.eval(obj.expr, { ...scope, x, y });
            positions[p++] = x;
            positions[p++] = y;
            positions[p++] = z;
            if (z < zMin) zMin = z;
            if (z > zMax) zMax = z;
        }
    }

    // Build triangle indices (two triangles per grid cell)
    const indices = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let ii = 0;
    for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
            const a = j * nx + i;
            const b = j * nx + i + 1;
            const c = (j + 1) * nx + i;
            const d = (j + 1) * nx + i + 1;
            indices[ii++] = a; indices[ii++] = c; indices[ii++] = b;
            indices[ii++] = b; indices[ii++] = c; indices[ii++] = d;
        }
    }

    // Per-vertex colormap colors
    let colors: Float32Array | null = null;
    if (obj.colormap) {
        const cm: ColormapName = obj.colormap;
        const zRange = zMax - zMin;
        colors = new Float32Array(nx * ny * 3);
        let ci = 0;
        for (let k = 0; k < nx * ny; k++) {
            const z = positions[k * 3 + 2];
            const t = zRange > 1e-10 ? (z - zMin) / zRange : 0.5;
            const [r, g, b] = colormapAt(cm, t);
            colors[ci++] = r;
            colors[ci++] = g;
            colors[ci++] = b;
        }
    }

    return { positions, indices, colors, width: nx, height: ny };
}

/** Sample parametric (x(t), y(t), z(t)) → 3D line data. */
export function sampleParametric(
    obj: ParametricCurveObject,
    evaluator: Evaluator,
    scope: EvalScope,
): LineGeometryData {
    const [tMin, tMax] = obj.domain;
    const n = Math.max(2, obj.samples);
    const positions = new Float32Array(n * 3);
    const dt = (tMax - tMin) / (n - 1);

    for (let i = 0; i < n; i++) {
        const t = tMin + i * dt;
        const s = { ...scope, t };
        positions[i * 3]     = evaluator.eval(obj.exprX, s);
        positions[i * 3 + 1] = evaluator.eval(obj.exprY, s);
        positions[i * 3 + 2] = evaluator.eval(obj.exprZ, s);
    }
    return { positions, count: n };
}
