/**
 * Point renderer — renders a sphere at a 3D position.
 */

import * as THREE from "three";
import type { PointObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { hexToColor } from "../core/color.js";
import { makeLabelSprite } from "../core/label.js";

export class PointRenderer extends ObjectRenderer<PointObject> {
    private mesh: THREE.Mesh | null = null;
    private labelSprite: THREE.Sprite | null = null;
    private material: THREE.MeshBasicMaterial;

    constructor(parent: THREE.Object3D) {
        super(parent);
        this.material = new THREE.MeshBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 1,
        });
    }

    update(obj: PointObject): void {
        this.disposeMesh();
        this.disposeLabel();
        this.material.color = hexToColor(obj.color);
        this.material.opacity = obj.opacity;

        // Use size as sphere radius, scaled to be visible
        const radius = obj.size / 50;
        const geom = new THREE.SphereGeometry(radius, 24, 16);
        this.mesh = new THREE.Mesh(geom, this.material);
        this.mesh.position.set(...obj.position);
        this.root.add(this.mesh);

        // Label
        if (obj.showLabel && obj.label) {
            const offset = radius + 0.1;
            this.labelSprite = makeLabelSprite(obj.label, obj.color, this.labelRenderer);
            this.labelSprite.position.set(obj.position[0] + offset, obj.position[1] + offset, obj.position[2]);
            this.root.add(this.labelSprite);
        }
    }

    refresh(obj: PointObject): void {
        if (this.mesh) {
            this.mesh.position.set(...obj.position);
        }
    }

    override needsRefresh(): boolean {
        return true;
    }

    dispose(): void {
        this.disposeMesh();
        this.disposeLabel();
        this.material.dispose();
    }

    private disposeMesh(): void {
        if (this.mesh) {
            this.root.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
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
