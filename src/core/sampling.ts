/**
 * Sample generators — convert expression-based scene objects into
 * typed-array vertex data ready for GPU upload.
 */

import type { FunctionObject, SurfaceObject, ParametricCurveObject, ColormapName } from "../types/index.js";
import type { Evaluator, EvalScope } from "./evaluator.js";
import { colormapAt } from "./color.js";

/**
 * Line data returned by curve samplers.
 *
 * Samples are split into contiguous segments at points where the evaluated
 * value is non-finite (NaN / ±Infinity), e.g. `log(x, 10)` at x ≤ 0.
 * Each segment is a flat Float32Array of [x,y,z, x,y,z, ...].
 * `positions` is a convenience concatenation of all segments for backwards-
 * compatible consumers that only need a flat array (e.g. label placement).
 */
export interface LineGeometryData {
    /** Contiguous vertex segments, split at non-finite values. */
    segments: Float32Array[];
    /** All vertices concatenated (for backwards compatibility). */
    positions: Float32Array;
    /** Total vertex count across all segments. */
    count: number;
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
    const dx = (xMax - xMin) / (n - 1);

    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
        const x = xMin + i * dx;
        const y = evaluator.eval(obj.expr, { ...scope, x });
        pts.push(x, y, 0);
    }
    return buildLineData(pts);
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
            // Clamp non-finite z to 0 to avoid NaN poisoning the GPU buffers.
            const sz = Number.isFinite(z) ? z : 0;
            positions[p++] = x;
            positions[p++] = y;
            positions[p++] = sz;
            if (sz < zMin) zMin = sz;
            if (sz > zMax) zMax = sz;
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
    const dt = (tMax - tMin) / (n - 1);

    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
        const t = tMin + i * dt;
        const s = { ...scope, t };
        pts.push(
            evaluator.eval(obj.exprX, s),
            evaluator.eval(obj.exprY, s),
            evaluator.eval(obj.exprZ, s),
        );
    }
    return buildLineData(pts);
}

// ---------------------------------------------------------------------------

/**
 * Convert a flat [x,y,z, x,y,z, ...] array of sample points into
 * LineGeometryData, splitting at any vertex that contains a non-finite
 * component.  This prevents NaN/Infinity from reaching three.js geometry
 * buffers, which would poison bounding-sphere / normal computations.
 */
function buildLineData(pts: number[]): LineGeometryData {
    const segments: Float32Array[] = [];
    let current: number[] = [];
    let count = 0;

    const flush = () => {
        if (current.length >= 6) { // at least 2 vertices
            segments.push(new Float32Array(current));
            count += current.length / 3;
        }
        current = [];
    };

    for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i];
        const y = pts[i + 1];
        const z = pts[i + 2];
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            current.push(x, y, z);
        } else {
            flush();
        }
    }
    flush();

    const positions = new Float32Array(segments.reduce((s, seg) => s + seg.length, 0));
    let off = 0;
    for (const seg of segments) {
        positions.set(seg, off);
        off += seg.length;
    }

    return { segments, positions, count };
}
