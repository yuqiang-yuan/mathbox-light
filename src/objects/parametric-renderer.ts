/**
 * Parametric curve renderer: (x(t), y(t), z(t)).
 */

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { ParametricCurveObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { sampleParametric } from "../core/sampling.js";
import type { Evaluator, EvalScope } from "../core/evaluator.js";
import { hexToColor } from "../core/color.js";

export class ParametricRenderer extends ObjectRenderer<ParametricCurveObject> {
    private line: Line2 | null = null;
    private material: LineMaterial;
    private evaluator: Evaluator;
    private scope: EvalScope;
    private resolution: number;

    constructor(parent: THREE.Object3D, evaluator: Evaluator, scope: EvalScope, resolution: number) {
        super(parent);
        this.evaluator = evaluator;
        this.scope = scope;
        this.resolution = resolution;
        this.material = new LineMaterial({
            color: 0x3b82f6,
            linewidth: 3,
            worldUnits: false,
            transparent: true,
            opacity: 1,
        });
        this.material.resolution.set(resolution, resolution);
    }

    update(obj: ParametricCurveObject): void {
        const data = sampleParametric(obj, this.evaluator, this.scope);
        this.disposeLine();

        const geom = new LineGeometry();
        geom.setPositions(Array.from(data.positions));
        this.material.color = hexToColor(obj.color);
        this.material.linewidth = obj.width;
        this.material.opacity = obj.opacity;

        this.line = new Line2(geom, this.material);
        this.line.computeLineDistances();
        this.root.add(this.line);
    }

    refresh(obj: ParametricCurveObject): void {
        this.update(obj);
    }

    override needsRefresh(): boolean {
        return true;
    }

    setResolution(width: number, height: number): void {
        const max = Math.max(width, height);
        if (max !== this.resolution) {
            this.resolution = max;
        }
        this.material.resolution.set(width, height);
    }

    dispose(): void {
        this.disposeLine();
        this.material.dispose();
    }

    private disposeLine(): void {
        if (this.line) {
            this.root.remove(this.line);
            this.line.geometry.dispose();
            this.line = null;
        }
    }
}
