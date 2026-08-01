/**
 * Label sprite utilities — shared by axis labels and object labels.
 */

import * as THREE from "three";

/**
 * Custom label renderer supplied by the caller (e.g. to support LaTeX via KaTeX).
 *
 * - Return an `HTMLCanvasElement` or `HTMLImageElement` to use it directly as
 *   the sprite texture (the caller handles all rendering/styling).
 * - Return a `string` to fall back to mathbox-next's built-in plain-text
 *   canvas rendering, using the returned string instead of the original input.
 */
export type LabelRenderer = (text: string, color: string) => HTMLCanvasElement | HTMLImageElement | string;

/** Draw plain text onto a canvas (used when no LabelRenderer is set or it returns a string). */
function drawTextToCanvas(text: string, color: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = 48;
    ctx.font = `${fontSize}px serif`;
    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width) + 16;
    canvas.height = fontSize + 12;

    // Re-set font after canvas resize (context resets)
    ctx.font = `${fontSize}px serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return canvas;
}

/** Create a text label as a Sprite using a Canvas or Image texture. */
export function makeLabelSprite(text: string, color = "#000000", labelRenderer?: LabelRenderer, size = 0.3): THREE.Sprite {
    let source: HTMLCanvasElement | HTMLImageElement;

    if (labelRenderer) {
        const result = labelRenderer(text, color);
        if (typeof result === "string") {
            source = drawTextToCanvas(result, color);
        } else {
            source = result;
        }
    } else {
        source = drawTextToCanvas(text, color);
    }

    const texture = source instanceof HTMLCanvasElement
        ? new THREE.CanvasTexture(source)
        : new THREE.Texture(source);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    const aspect = source.width / source.height;
    sprite.scale.set(size * aspect, size, 1);
    return sprite;
}
