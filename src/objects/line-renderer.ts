/**
 * Line segment renderer — renders a fat line between two points.
 */

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { LineObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { hexToColor } from "../core/color.js";
import { makeLabelSprite } from "../core/label.js";

export class LineRenderer extends ObjectRenderer<LineObject> {
    private line: Line2 | null = null;
    private labelSprite: THREE.Sprite | null = null;
    private material: LineMaterial;
    private resolution: number;

    constructor(parent: THREE.Object3D, resolution: number) {
        super(parent);
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

    update(obj: LineObject): void {
        this.disposeLine();
        this.disposeLabel();
        const geom = new LineGeometry();
        geom.setPositions([...obj.start, ...obj.end]);
        this.material.color = hexToColor(obj.color);
        this.material.linewidth = obj.width;
        this.material.opacity = obj.opacity;

        this.line = new Line2(geom, this.material);
        this.root.add(this.line);

        // Label at the midpoint
        if (obj.showLabel && obj.label) {
            const mid: [number, number, number] = [
                (obj.start[0] + obj.end[0]) / 2 + 0.1,
                (obj.start[1] + obj.end[1]) / 2 + 0.1,
                (obj.start[2] + obj.end[2]) / 2,
            ];
            this.labelSprite = makeLabelSprite(obj.label, obj.color, this.labelRenderer);
            this.labelSprite.position.set(...mid);
            this.root.add(this.labelSprite);
        }
    }

    refresh(_obj: LineObject): void {
        // Static — no per-frame update needed unless parameters change
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
