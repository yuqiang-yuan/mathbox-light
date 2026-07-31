/**
 * Color utility — convert "#rrggbb" hex strings to three.js color numbers.
 */

import * as THREE from "three";

export function hexToColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
}

export function hexToNumber(hex: string): number {
    return parseInt(hex.replace("#", "0x"), 16);
}
