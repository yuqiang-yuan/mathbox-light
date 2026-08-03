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

    // First pass: sample all points.
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
        const x = xMin + i * dx;
        xs.push(x);
        ys.push(evaluator.eval(obj.expr, { ...scope, x }));
    }

    detectDiscontinuities1D(xs, ys, (x) => evaluator.eval(obj.expr, { ...scope, x }));

    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
        pts.push(xs[i], ys[i], 0);
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

    // First pass: sample all points.
    const ts: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < n; i++) {
        const t = tMin + i * dt;
        const s = { ...scope, t };
        ts.push(t);
        xs.push(evaluator.eval(obj.exprX, s));
        ys.push(evaluator.eval(obj.exprY, s));
        zs.push(evaluator.eval(obj.exprZ, s));
    }

    // Detect discontinuities on each axis independently; if any axis is
    // discontinuous at a given index, mark the point as NaN on all axes
    // so buildLineData breaks the segment there.
    const evalExpr = (expr: string, t: number) =>
        evaluator.eval(expr, { ...scope, t });

    const breaks = new Set<number>();
    for (const vals of [xs, ys, zs]) {
        const expr = vals === xs ? obj.exprX : vals === ys ? obj.exprY : obj.exprZ;
        detectDiscontinuities1D(ts, vals, (t: number) => evalExpr(expr, t));
        for (let i = 0; i < n; i++) {
            if (Number.isNaN(vals[i])) breaks.add(i);
        }
    }

    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
        if (breaks.has(i)) {
            pts.push(NaN, NaN, NaN);
        } else {
            pts.push(xs[i], ys[i], zs[i]);
        }
    }
    return buildLineData(pts);
}

// ---------------------------------------------------------------------------

/**
 * Detect discontinuities (asymptotes) in sampled 1D data using the midpoint test.
 *
 * For each pair of adjacent finite samples, if the slope is steep relative to
 * the median slope, the midpoint is evaluated. If the midpoint value deviates
 * significantly from linear interpolation of the two endpoints, the segment is
 * deemed discontinuous and the **second** point is set to NaN (so buildLineData
 * breaks the line there).
 *
 * `ys` is mutated in place.
 *
 * @param xs        Sample positions (monotonic).
 * @param ys        Sample values (parallel to xs). Mutated.
 * @param evalAt    Function to evaluate the underlying expression at an arbitrary x.
 */
function detectDiscontinuities1D(
    xs: number[],
    ys: number[],
    evalAt: (x: number) => number,
): void {
    const n = xs.length;
    if (n < 2) return;

    // Compute absolute slopes of all adjacent finite pairs.
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        if (Number.isFinite(ys[i]) && Number.isFinite(ys[i + 1])) {
            slopes.push(Math.abs((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])));
        }
    }
    if (slopes.length === 0) return;

    // Median slope — robust against asymptote outliers.
    const sorted = [...slopes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;

    // A segment is "steep" if its slope exceeds 10× the median.
    // For steep segments, sample the midpoint and compare to linear interpolation.
    const STEEP_FACTOR = 10;
    // If midpoint deviates from the interpolation by more than this fraction of
    // the segment's y-range, it's a discontinuity.
    const DEVIATION_RATIO = 0.5;

    for (let i = 0; i < n - 1; i++) {
        const y0 = ys[i];
        const y1 = ys[i + 1];
        if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;

        const dx = xs[i + 1] - xs[i];
        const slope = Math.abs((y1 - y0) / dx);
        if (slope <= median * STEEP_FACTOR) continue;

        // Steep segment — evaluate midpoint.
        const midX = (xs[i] + xs[i + 1]) / 2;
        const midY = evalAt(midX);
        if (!Number.isFinite(midY)) continue; // NaN midpoint → already handled by buildLineData

        const midLinear = (y0 + y1) / 2;
        const yRange = Math.abs(y1 - y0);
        if (yRange < 1e-12) continue;

        const deviation = Math.abs(midY - midLinear) / yRange;
        if (deviation > DEVIATION_RATIO) {
            // Discontinuity: break the segment by NaN-ing the second point.
            ys[i + 1] = NaN;
        }
    }
}

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
