/**
 * Function curve renderer: y = f(x).
 *
 * Produces a three.js Line2 (fat lines) or LineSegments depending on width.
 * For simplicity we use Line2 from three/examples for width control.
 */

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { FunctionObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { sampleFunction } from "../core/sampling.js";
import type { Evaluator, EvalScope } from "../core/evaluator.js";
import { hexToColor } from "../core/color.js";
import { makeLabelSprite } from "../core/label.js";

export class FunctionRenderer extends ObjectRenderer<FunctionObject> {
    private line: Line2 | null = null;
    private labelSprite: THREE.Sprite | null = null;
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
            linewidth: 3,       // pixels
            worldUnits: false,
            transparent: true,
            opacity: 1,
        });
        this.material.resolution.set(resolution, resolution);
    }

    update(obj: FunctionObject): void {
        const data = sampleFunction(obj, this.evaluator, this.scope);
        this.disposeLine();
        this.disposeLabel();

        const geom = new LineGeometry();
        geom.setPositions(Array.from(data.positions));
        this.material.color = hexToColor(obj.color);
        this.material.linewidth = obj.width;
        this.material.opacity = obj.opacity;

        this.line = new Line2(geom, this.material);
        this.line.computeLineDistances();
        this.root.add(this.line);

        // Label at the end of the curve
        if (obj.showLabel && obj.label && data.positions.length >= 3) {
            const lastIdx = data.positions.length - 3;
            const x = data.positions[lastIdx];
            const y = data.positions[lastIdx + 1];
            const z = data.positions[lastIdx + 2];
            this.labelSprite = makeLabelSprite(obj.label, obj.color, this.labelRenderer);
            this.labelSprite.position.set(x + 0.1, y + 0.1, z);
            this.root.add(this.labelSprite);
        }
    }

    refresh(obj: FunctionObject): void {
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
        this.disposeLabel();
        this.material.dispose();
    }

    private disposeLine(): void {
        if (this.line) {
            this.root.remove(this.line);
            this.line.geometry.dispose();
            this.line = null;
        }
    }

    private disposeLabel(): void {
        if (this.labelSprite) {
            this.root.remove(this.labelSprite);
            this.labelSprite.material.map?.dispose();
            this.labelSprite.material.dispose();
            this.labelSprite = null;
        }
    }
}
