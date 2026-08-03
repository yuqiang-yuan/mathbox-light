/**
 * MathBox-Light Type Definitions
 *
 * Scene data model — JSON-serializable so it can be stored in TipTap nodes,
 * transported via API, and round-tripped between editor and player.
 */

// ============================================================================
// Primitives
// ============================================================================

/** RGB hex color, e.g. "#3b82f6". */
export type HexColor = string;

/**
 * Colormap name for gradient surface coloring.
 * When set on a SurfaceObject, per-vertex colors are computed by mapping
 * the z value (normalized to [0,1]) through the colormap.
 */
export type ColormapName = "rainbow" | "viridis" | "heat" | "cool" | "grayscale";

/** 3D vector / point position [x, y, z]. */
export type Vec3 = [number, number, number];

/** Numeric range [min, max]. */
export type Range = [number, number];

/** Saved camera pose (position + look-at target) for view restoration. */
export interface CameraPose {
    position: Vec3;
    target: Vec3;
}

/** 3D bounding box. */
export interface Bounds3D {
    min: Vec3;
    max: Vec3;
}

// ============================================================================
// Scene Objects (visual elements)
// ============================================================================

/** Base properties shared by all visual scene objects. */
export interface SceneObjectBase {
    /** Unique identifier within the scene. */
    id: string;
    /** Object type discriminator. */
    type: SceneObjectType;
    /** Whether the object is visible. */
    visible: boolean;
    /** Hex color, e.g. "#3b82f6". */
    color: HexColor;
    /** Opacity 0–1. */
    opacity: number;
    /**
     * Display label supporting mixed text and LaTeX.
     * Text outside `$...$` is plain text; text inside `$...$` is LaTeX.
     */
    label?: string;
    /** Whether to render the label. */
    showLabel: boolean;
}

/** A 2D function curve: y = f(x). */
export interface FunctionObject extends SceneObjectBase {
    type: "function";
    /** Expression in x, e.g. "sin(x)", "x^2 + 2*x - 1". */
    expr: string;
    /** X domain [xMin, xMax]. */
    domain: Range;
    /** Number of sample points along x. */
    samples: number;
    /** Line width in pixels. */
    width: number;
    /** Whether to close the curve (connect last point back to first). */
    closed: boolean;
}

/** A 3D surface: z = f(x, y). */
export interface SurfaceObject extends SceneObjectBase {
    type: "surface";
    /** Expression in x and y, e.g. "sin(x) * cos(y)". */
    expr: string;
    /** X domain. */
    domainX: Range;
    /** Y domain. */
    domainY: Range;
    /** Number of sample points along x. */
    samplesX: number;
    /** Number of sample points along y. */
    samplesY: number;
    /** Whether to show wireframe edges on the surface. Defaults to false. */
    wireframe?: boolean;
    /** Colormap for gradient coloring by z value. Omit for solid color. */
    colormap?: ColormapName;
}

/** A parametric curve: (x(t), y(t), z(t)). */
export interface ParametricCurveObject extends SceneObjectBase {
    type: "parametric";
    /** Expression for x in terms of t. */
    exprX: string;
    /** Expression for y in terms of t. */
    exprY: string;
    /** Expression for z in terms of t. */
    exprZ: string;
    /** Parameter domain [tMin, tMax]. */
    domain: Range;
    /** Number of sample points. */
    samples: number;
    /** Line width in pixels. */
    width: number;
    /** Whether to close the curve. */
    closed: boolean;
}

/** A point in 3D space. */
export interface PointObject extends SceneObjectBase {
    type: "point";
    /** Position [x, y, z]. */
    position: Vec3;
    /** Point size in pixels. */
    size: number;
}

/** A line segment between two points. */
export interface LineObject extends SceneObjectBase {
    type: "line";
    /** Start point. */
    start: Vec3;
    /** End point. */
    end: Vec3;
    /** Line width in pixels. */
    width: number;
}

/** A vector (arrow) from tail to head. */
export interface VectorObject extends SceneObjectBase {
    type: "vector";
    /** Tail position. */
    tail: Vec3;
    /** Head position. */
    head: Vec3;
    /** Line width in pixels. */
    width: number;
}

/** Discriminated union of all visual scene objects. */
export type SceneObject =
    | FunctionObject
    | SurfaceObject
    | ParametricCurveObject
    | PointObject
    | LineObject
    | VectorObject;

export type SceneObjectType = SceneObject["type"];

// ============================================================================
// Parameters (variables referenced in expressions)
// ============================================================================

/**
 * A variable that can be referenced by symbol in any expression.
 * The scene editor renders a slider for each parameter.
 */
export interface Parameter {
    /** Unique identifier within the scene. */
    id: string;
    /** Variable symbol used in expressions, e.g. "a", "k", "omega". */
    symbol: string;
    /** Current value. */
    value: number;
    /** Slider minimum. */
    min: number;
    /** Slider maximum. */
    max: number;
    /** Slider step. */
    step: number;
}

// ============================================================================
// Scene Config
// ============================================================================

export interface AxisConfig {
    visible: boolean;
    range: Range;
    /** Visual scale factor per-axis (independent from data range). */
    scale: number;
    /** Axis label (mixed text + LaTeX). */
    label?: string;
    /** Axis color as a hex string (e.g. "#cc5555"). Defaults to black. */
    color?: HexColor;
}

/**
 * Coordinate system type.
 *
 * - "cartesian": x, y, z — standard rectangular coordinates.
 *   Function objects interpret expr as y = f(x).
 * - "polar": r, θ — polar coordinates in the xy-plane.
 *   Function objects interpret expr as r = f(θ).
 * - "spherical": ρ, θ, φ — spherical coordinates.
 *   Surface objects interpret expr as ρ = f(θ, φ).
 *
 * Initially only "cartesian" is implemented; the other types are
 * reserved so the data model is forward-compatible.
 */
export type CoordinateSystem = "cartesian" | "polar" | "spherical";

export interface GridPlaneConfig {
    visible: boolean;
    /** Spacing between grid lines in world units. */
    step: number;
    /** Grid line color as a hex string (e.g. "#cccccc"). */
    color?: HexColor;
    /** Grid line opacity, 0–1. */
    opacity?: number;
}

export interface GridConfig {
    /** Master toggle — when false, all planes are hidden. */
    visible: boolean;
    /** XY plane (z = 0). Omit to use defaults. */
    xy?: GridPlaneConfig;
    /** XZ plane (y = 0). Omit to use defaults. */
    xz?: GridPlaneConfig;
    /** YZ plane (x = 0). Omit to use defaults. */
    yz?: GridPlaneConfig;
}

export interface SceneConfig {
    /** Coordinate system for interpreting expressions. */
    coordinateSystem: CoordinateSystem;
    /**
     * Scene dimension mode.
     * - "2D": camera looks straight down the z-axis, z-axis data ignored by autoFit.
     * - "3D": camera uses perspective view at an angle.
     */
    dimension: "2D" | "3D";
    axes: {
        x: AxisConfig;
        y: AxisConfig;
        z: AxisConfig;
    };
    grid: GridConfig;
    camera: {
        canRotate: boolean;
        canZoom: boolean;
        canPan: boolean;
        position: Vec3;
        lookAt: Vec3;
        /**
         * Fractional position of the world origin on screen, [0–1, 0–1].
         * [0.5, 0.5] = centered (default). [0.3, 0.3] = origin toward lower-left.
         * When set, camera position/lookAt are computed to place the origin
         * at this screen position instead of using raw position/lookAt.
         */
        originPosition?: [number, number];
        /**
         * When true, camera position/lookAt/originPosition are computed
         * automatically from the bounding box of all scene objects.
         * Overrides manual position/lookAt/originPosition.
         */
        autoFit?: boolean;
        /**
         * A camera pose saved by the user after manually adjusting the view
         * (rotate/zoom/pan). When present, the controller animates from the
         * initial camera position to this pose on load.
         * Differs from `position`/`lookAt` which is the designer-set initial view.
         */
        savedPose?: CameraPose;
    };
}

// ============================================================================
// Root Scene
// ============================================================================

export interface MathScene {
    /** Schema version for forward compatibility. */
    version: 1;
    config: SceneConfig;
    parameters: Parameter[];
    objects: SceneObject[];
}
