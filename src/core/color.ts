/**
 * Color utility — convert "#rrggbb" hex strings to three.js color numbers,
 * and colormap sampling for gradient surface coloring.
 */

import * as THREE from "three";
import type { ColormapName } from "../types/index.js";

export function hexToColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
}

export function hexToNumber(hex: string): number {
    return parseInt(hex.replace("#", "0x"), 16);
}

// ----------------------------------------------------------------------------
// Colormaps
// ----------------------------------------------------------------------------

type RGB = [number, number, number];

/** Linearly interpolate between two RGB colors. */
function lerpColor(a: RGB, b: RGB, t: number): RGB {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

/** Multi-stop gradient sampler. Stops must be ordered by position [0,1]. */
function sampleGradient(stops: [number, RGB][], t: number): RGB {
    const clamped = Math.max(0, Math.min(1, t));
    if (clamped <= stops[0][0]) return stops[0][1];
    if (clamped >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
    for (let i = 0; i < stops.length - 1; i++) {
        const [p0, c0] = stops[i];
        const [p1, c1] = stops[i + 1];
        if (clamped >= p0 && clamped <= p1) {
            return lerpColor(c0, c1, (clamped - p0) / (p1 - p0));
        }
    }
    return stops[stops.length - 1][1];
}

/** HSV to RGB (h in [0,1]). */
function hsv(h: number, s: number, v: number): RGB {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

// Colormap definitions as ordered stops. Values are 0-255 RGB.
const COLORMAPS: Record<ColormapName, (t: number) => RGB> = {
    rainbow: (t) => {
        // hsv() returns 0–1 values; scale to 0–255 to match other colormaps.
        const [r, g, b] = hsv(t, 0.85, 1);
        return [r * 255, g * 255, b * 255];
    },

    viridis: (t) => sampleGradient([
        [0.0, [68, 1, 84]],
        [0.25, [59, 82, 139]],
        [0.5, [33, 145, 140]],
        [0.75, [94, 201, 98]],
        [1.0, [253, 231, 37]],
    ], t),

    heat: (t) => sampleGradient([
        [0.0, [0, 0, 0]],
        [0.33, [180, 0, 0]],
        [0.66, [255, 180, 0]],
        [1.0, [255, 255, 255]],
    ], t),

    cool: (t) => sampleGradient([
        [0.0, [0, 80, 200]],
        [0.5, [80, 200, 200]],
        [1.0, [200, 255, 255]],
    ], t),

    grayscale: (t) => {
        const v = Math.round(t * 255);
        return [v, v, v];
    },
};

/**
 * Sample a colormap at normalized position t ∈ [0,1].
 * Returns RGB values in 0–1 range (ready for three.js).
 */
export function colormapAt(name: ColormapName, t: number): RGB {
    const [r, g, b] = COLORMAPS[name](t);
    return [r / 255, g / 255, b / 255];
}

/** Available colormap names (for UI dropdowns). */
export const COLORMAP_NAMES: ColormapName[] = ["rainbow", "viridis", "heat", "cool", "grayscale"];
