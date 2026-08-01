# mathbox-next

Lightweight 3D math visualization library built on [three.js](https://threejs.org/) r185 and TypeScript. Inspired by [MathBox](https://github.com/unconed/mathbox), but rewritten from scratch with a simplified architecture — no threestrap, no ShaderGraph, no data-as-texture GPU pipeline, no legacy three.js APIs.

## Why?

MathBox is a powerful library, but it was built on three.js r71 (2014) and depends on threestrap and ShaderGraph. Running it alongside modern three.js (r160+) causes:

- **ESM resolution errors** — directory imports without `/index.js` break Node's ESM resolver
- **`WebGL1Renderer` not found** — removed in three.js r163
- **`window.THREE` global pollution** — the bundle overwrites `window.THREE`, conflicting with any other three.js usage on the same page
- **Internal API breakage** — `renderer.state`, `renderer.properties`, deprecated uniform type strings

mathbox-next sidesteps all of this by using standard ESM imports of modern three.js directly. No globals, no patches, no SSR workarounds.

## Install

```bash
npm install mathbox-next three
# or
yarn add mathbox-next three
```

> `three` is a peer dependency — you bring your own version (≥0.160.0).

## Quick Start

```ts
import { MathBoxController, createDefaultScene } from "mathbox-next";

const container = document.getElementById("container")!;
const scene = createDefaultScene();

const controller = new MathBoxController(container, scene);
controller.start();

// Update the scene (adds/removes/updates objects via diffing)
controller.updateScene(updatedScene);

// Clean up
controller.dispose();
```

## Scene Model

The scene is a plain JSON-serializable object — store it, send it over the wire, round-trip it through an editor.

```ts
interface MathScene {
    version: 1;
    config: {
        coordinateSystem: "cartesian" | "polar" | "spherical";
        axes: {
            x: { visible: boolean; range: [number, number]; scale: number; label?: string };
            y: { ... };
            z: { ... };
        };
        grid: { visible: boolean };
        camera: {
            canRotate: boolean;
            canZoom: boolean;
            canPan: boolean;
            position: [number, number, number];
            lookAt: [number, number, number];
        };
    };
    parameters: Parameter[];   // slider variables referenced in expressions
    objects: SceneObject[];    // visual elements
}
```

### Object Types

| Type | Description | Key fields |
|---|---|---|
| `function` | 2D curve `y = f(x)` | `expr`, `domain`, `samples`, `width` |
| `surface` | 3D surface `z = f(x, y)` | `expr`, `domainX`, `domainY`, `samplesX`, `samplesY` |
| `parametric` | 3D curve `(x(t), y(t), z(t))` | `exprX`, `exprY`, `exprZ`, `domain`, `samples` |
| `point` | Point in 3D space | `position`, `size` |
| `line` | Line segment between two points | `start`, `end`, `width` |
| `vector` | Arrow from tail to head | `tail`, `head`, `width` |

### Expression Syntax

Expressions are JavaScript math expressions. All `Math.*` functions are available as bare names:

```js
"sin(x)"
"x^2 + 2*x - 1"          // ^ is rewritten to **
"sin(x) * cos(y)"
"sqrt(x^2 + y^2)"
"exp(-t) * cos(2*t)"
```

Parameters defined in `scene.parameters` are available as variables:

```ts
const scene = {
    // ...
    parameters: [
        { id: "p1", symbol: "a", value: 2, min: 0, max: 5, step: 0.1 },
    ],
    objects: [
        {
            id: "fn1",
            type: "function",
            visible: true,
            color: "#3b82f6",
            opacity: 1,
            showLabel: false,
            expr: "a * sin(x)",   // references parameter "a"
            domain: [-5, 5],
            samples: 200,
            width: 3,
            closed: false,
        },
    ],
};
```

### Example: Full Scene

```ts
const scene: MathScene = {
    version: 1,
    config: {
        coordinateSystem: "cartesian",
        axes: {
            x: { visible: true, range: [-5, 5], scale: 1, label: "x" },
            y: { visible: true, range: [-3, 3], scale: 1, label: "y" },
            z: { visible: true, range: [-3, 3], scale: 1, label: "z" },
        },
        grid: { visible: true },
        camera: {
            canRotate: true,
            canZoom: true,
            canPan: true,
            position: [4, 3, 6],
            lookAt: [0, 0, 0],
        },
    },
    parameters: [],
    objects: [
        {
            id: "surface1",
            type: "surface",
            visible: true,
            color: "#10b981",
            opacity: 0.8,
            showLabel: false,
            expr: "sin(x) * cos(y)",
            domainX: [-3, 3],
            domainY: [-3, 3],
            samplesX: 60,
            samplesY: 60,
        },
        {
            id: "vec1",
            type: "vector",
            visible: true,
            color: "#8b5cf6",
            opacity: 1,
            showLabel: false,
            tail: [0, 0, 0],
            head: [2, 2, 1],
            width: 2,
        },
    ],
};
```

## API

### `MathBoxController`

The top-level orchestrator. Manages the three.js renderer, scene graph, camera, lights, and animation loop.

```ts
const controller = new MathBoxController(container, scene);
```

| Method | Description |
|---|---|
| `start()` | Begin the `requestAnimationFrame` render loop. |
| `stop()` | Stop the render loop. |
| `updateScene(scene)` | Replace the scene definition. Diffs objects — adds new, updates changed, disposes removed. |
| `updateParameters(params)` | Update parameter values (e.g. from slider input). Refreshes affected renderers. |
| `dispose()` | Stop loop and dispose all GPU resources. |

### `MathScene` / Types

All types are exported from the package root:

```ts
import type { MathScene, SceneObject, FunctionObject, SurfaceObject, ... } from "mathbox-next";
```

## Extending

### Custom Object Type

Register a new scene object type by implementing `ObjectRenderer` and registering it:

```ts
import { ObjectRenderer, registerRenderer } from "mathbox-next";
import * as THREE from "three";

class SphereRenderer extends ObjectRenderer<MySphereObject> {
    private mesh: THREE.Mesh;

    update(obj: MySphereObject): void {
        // Build or update geometry from obj
    }

    refresh(obj: MySphereObject): void {
        // Called when parameters change but the object definition hasn't
    }

    needsRefresh(): boolean { return true; }

    setVisible(visible: boolean): void {
        this.root.visible = visible;
    }

    setResolution(w: number, h: number): void { /* ... */ }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}

registerRenderer("sphere", (parent, evaluator, scope, resolution) =>
    new SphereRenderer(parent, evaluator, scope, resolution));
```

### Custom Evaluator

The default `SimpleEvaluator` uses `new Function` for expression evaluation. For untrusted input, swap in a sandboxed parser:

```ts
import type { Evaluator, EvalScope } from "mathbox-next";

class MathJSEvaluator implements Evaluator {
    eval(expr: string, scope: EvalScope): number {
        // Use math.js, expr-eval, or any safe parser
        return mathjs.evaluate(expr, scope);
    }
}
```

## License

MIT
