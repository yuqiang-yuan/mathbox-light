/**
 * Vector (arrow) renderer — renders an arrow from tail to head.
 */

import * as THREE from "three";
import type { VectorObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { hexToColor } from "../core/color.js";
import { makeLabelSprite } from "../core/label.js";

export class VectorRenderer extends ObjectRenderer<VectorObject> {
    private arrow: THREE.ArrowHelper | null = null;
    private labelSprite: THREE.Sprite | null = null;
    private lineMaterial: THREE.LineBasicMaterial;

    constructor(parent: THREE.Object3D) {
        super(parent);
        this.lineMaterial = new THREE.LineBasicMaterial({
            transparent: true,
            opacity: 1,
        });
    }

    update(obj: VectorObject): void {
        this.disposeArrow();
        this.disposeLabel();

        const dir = new THREE.Vector3(
            obj.head[0] - obj.tail[0],
            obj.head[1] - obj.tail[1],
            obj.head[2] - obj.tail[2],
        );
        const length = dir.length();
        if (length < 1e-10) return;

        dir.normalize();
        const color = hexToColor(obj.color);

        // ArrowHelper: (dir, origin, length, color, headLength, headWidth)
        const headLength = Math.min(length * 0.2, 0.3);
        const headWidth = headLength * 0.6;
        this.arrow = new THREE.ArrowHelper(
            dir,
            new THREE.Vector3(...obj.tail),
            length,
            color,
            headLength,
            headWidth,
        );

        // Apply opacity
        const mat = this.arrow.line.material as THREE.Material;
        mat.transparent = true;
        mat.opacity = obj.opacity;
        const coneMat = this.arrow.cone.material as THREE.Material;
        coneMat.transparent = true;
        coneMat.opacity = obj.opacity;

        this.root.add(this.arrow);

        // Label at the head of the vector
        if (obj.showLabel && obj.label) {
            this.labelSprite = makeLabelSprite(obj.label, obj.color, this.labelRenderer);
            this.labelSprite.position.set(obj.head[0] + 0.1, obj.head[1] + 0.1, obj.head[2]);
            this.root.add(this.labelSprite);
        }
    }

    refresh(obj: VectorObject): void {
        this.update(obj);
    }

    override needsRefresh(): boolean {
        return true;
    }

    dispose(): void {
        this.disposeArrow();
        this.disposeLabel();
        this.lineMaterial.dispose();
    }

    private disposeArrow(): void {
        if (this.arrow) {
            this.root.remove(this.arrow);
            this.arrow.dispose();
            this.arrow = null;
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
