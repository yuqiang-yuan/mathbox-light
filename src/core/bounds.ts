/**
 * AutoFit camera computation.
 *
 * Uses axis ranges directly (not sampled data) to compute camera placement:
 * - 2D: only x/y ranges, camera looks straight down z-axis.
 * - 3D: x/y/z ranges, camera at an angle.
 */

import type { Vec3, MathScene, Bounds3D } from "../types/index.js";

export interface AutoFitResult {
    position: Vec3;
    lookAt: Vec3;
    originPosition: [number, number];
}

/**
 * Compute bounding box from scene axis ranges.
 * 2D: ignores z (z range set to [0, 0]).
 * 3D: uses all three axes.
 */
export function sceneBounds(scene: MathScene): Bounds3D {
    const { x, y, z } = scene.config.axes;
    const dimension = scene.config.dimension;

    if (dimension === "2D") {
        return {
            min: [x.range[0], y.range[0], 0],
            max: [x.range[1], y.range[1], 0],
        };
    }

    return {
        min: [x.range[0], y.range[0], z.range[0]],
        max: [x.range[1], y.range[1], z.range[1]],
    };
}

/**
 * Compute camera position/lookAt/originPosition from a bounding box.
 *
 * 2D mode:
 *   - Camera looks straight down the z-axis.
 *   - Camera positioned at (centerX, centerY, +distance).
 *
 * 3D mode:
 *   - Camera placed along (1, 0.7, 1) direction from scene center.
 *
 * Both modes add a 10% margin around the bounds.
 */
export function computeAutoFit(
    bounds: Bounds3D,
    fov: number,
    aspect: number,
    dimension: "2D" | "3D" = "3D",
): AutoFitResult {
    const { min, max } = bounds;

    // Add 10% margin
    const sizeX = (max[0] - min[0]) * 1.1 || 1;
    const sizeY = (max[1] - min[1]) * 1.1 || 1;
    const sizeZ = (max[2] - min[2]) * 1.1 || 1;
    const centerX = (min[0] + max[0]) / 2;
    const centerY = (min[1] + max[1]) / 2;
    const centerZ = (min[2] + max[2]) / 2;

    const fovRad = (fov * Math.PI) / 180;

    // Origin position: where does (0,0) fall within the XY bounds?
    const originFraction = (origin: number, lo: number, hi: number): number => {
        if (hi === lo) return 0.5;
        return Math.max(0.1, Math.min(0.9, (origin - lo) / (hi - lo)));
    };
    const marginX = (max[0] - min[0]) * 0.05;
    const marginY = (max[1] - min[1]) * 0.05;
    const originPosition: [number, number] = [
        originFraction(0, min[0] - marginX, max[0] + marginX),
        originFraction(0, min[1] - marginY, max[1] + marginY),
    ];

    if (dimension === "2D") {
        // Fit the larger of X/Y into the view, respecting aspect ratio
        const vertDist = (sizeY / 2) / Math.tan(fovRad / 2);
        const horizDist = (sizeX / 2) / (Math.tan(fovRad / 2) * aspect);
        const distance = Math.max(vertDist, horizDist);

        return {
            position: [centerX, centerY, distance],
            lookAt: [centerX, centerY, 0],
            originPosition,
        };
    }

    // 3D mode
    const diagonal = Math.sqrt(sizeX ** 2 + sizeY ** 2 + sizeZ ** 2);
    const halfDiag = diagonal / 2;
    const vertDist = halfDiag / Math.tan(fovRad / 2);
    const horizDist = halfDiag / (Math.tan(fovRad / 2) * aspect);
    const distance = Math.max(vertDist, horizDist);

    // Camera direction: (1, 0.7, 1) normalized — a pleasant 3D viewing angle
    const dirLen = Math.sqrt(1 + 0.49 + 1);
    const dirVec: Vec3 = [1 / dirLen, 0.7 / dirLen, 1 / dirLen];

    return {
        position: [
            centerX + dirVec[0] * distance,
            centerY + dirVec[1] * distance,
            centerZ + dirVec[2] * distance,
        ],
        lookAt: [centerX, centerY, centerZ],
        originPosition,
    };
}
