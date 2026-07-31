/**
 * Base class for all scene object renderers.
 *
 * Each renderer takes a scene object definition and produces three.js
 * Object3D(s) that are added to the scene.  When the object definition
 * changes, `update()` is called to rebuild or mutate the three.js objects.
 */

import { Object3D } from "three";
import type { SceneObject } from "../types/index.js";

export abstract class ObjectRenderer<T extends SceneObject = SceneObject> {
    protected readonly root: Object3D;

    constructor(parent: Object3D) {
        this.root = new Object3D();
        parent.add(this.root);
    }

    /** Build / rebuild three.js objects from the scene object definition. */
    abstract update(obj: T): void;

    /** Update per-frame (e.g. animated parameters changed vertex data). */
    abstract refresh(obj: T): void;

    /** Whether this renderer needs per-frame re-sampling.  Default false. */
    needsRefresh(): boolean {
        return false;
    }

    /** Visibility toggle. */
    setVisible(visible: boolean): void {
        this.root.visible = visible;
    }

    /** Dispose all three.js resources. */
    abstract dispose(): void;

    get object3d(): Object3D {
        return this.root;
    }
}
