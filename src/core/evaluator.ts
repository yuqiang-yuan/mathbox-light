/**
 * Expression evaluator using mathjs. Safely parses and evaluates math
 * expressions without `new Function` code execution. Supports `^` for
 * exponentiation, implicit multiplication (`2x`), constants (`pi`, `e`),
 * and the full mathjs function library (sin, cos, abs, sqrt, ...).
 */

import { compile, type EvalFunction } from "mathjs";

export type EvalScope = Record<string, number>;

export interface Evaluator {
    /** Evaluate an expression returning a single number. */
    eval(expr: string, scope: EvalScope): number;
}

export class SimpleEvaluator implements Evaluator {
    private cache = new Map<string, EvalFunction>();

    eval(expr: string, scope: EvalScope): number {
        let fn = this.cache.get(expr);
        if (!fn) {
            fn = compile(expr);
            this.cache.set(expr, fn);
        }
        const result = fn.evaluate(scope);
        // mathjs may return complex/units/etc.; coerce to number.
        const n = typeof result === "number" ? result : Number(result);
        if (Number.isNaN(n)) {
            throw new Error(`Expression "${expr}" did not evaluate to a number`);
        }
        return n;
    }
}
