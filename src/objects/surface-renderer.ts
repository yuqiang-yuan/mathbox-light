/**
 * Surface renderer: z = f(x, y).
 *
 * Produces a three.js Mesh with BufferGeometry, rendered as a
 * wireframe + filled surface with double-sided material.
 */

import * as THREE from "three";
import type { SurfaceObject } from "../types/index.js";
import { ObjectRenderer } from "./base.js";
import { sampleSurface } from "../core/sampling.js";
import type { Evaluator, EvalScope } from "../core/evaluator.js";
import { hexToColor } from "../core/color.js";

export class SurfaceRenderer extends ObjectRenderer<SurfaceObject> {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.MeshStandardMaterial;
    private wireMaterial: THREE.LineBasicMaterial;
    private evaluator: Evaluator;
    private scope: EvalScope;

    constructor(parent: THREE.Object3D, evaluator: Evaluator, scope: EvalScope) {
        super(parent);
        this.evaluator = evaluator;
        this.scope = scope;
        this.material = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
            flatShading: false,
            metalness: 0.0,
            roughness: 0.65,
        });
        this.wireMaterial = new THREE.LineBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.3,
        });
    }

    update(obj: SurfaceObject): void {
        const data = sampleSurface(obj, this.evaluator, this.scope);
        this.disposeMesh();

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
        geometry.computeVertexNormals();

        this.material.color = hexToColor(obj.color);
        this.material.opacity = obj.opacity;

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.root.add(this.mesh);

        // Wireframe overlay
        const wireGeom = new THREE.WireframeGeometry(geometry);
        const wire = new THREE.LineSegments(wireGeom, this.wireMaterial);
        this.root.add(wire);
    }

    refresh(obj: SurfaceObject): void {
        this.update(obj);
    }

    override needsRefresh(): boolean {
        return true;
    }

    dispose(): void {
        this.disposeMesh();
        this.material.dispose();
        this.wireMaterial.dispose();
    }

    private disposeMesh(): void {
        // Dispose all children (mesh + wireframe)
        for (const child of this.root.children) {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
            } else if (child instanceof THREE.LineSegments) {
                child.geometry.dispose();
            }
        }
        this.root.clear();
        this.mesh = null;
    }
}
