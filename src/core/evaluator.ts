/**
 * Expression evaluator using `new Function`. Supports standard JS math via
 * `Math.*` functions (sin, cos, abs, sqrt, etc.) accessible without the
 * `Math.` prefix.  Secure enough for trusted authoring tools; for untrusted
 * input, swap in a proper math parser (math.js, expr-eval).
 */

export type EvalScope = Record<string, number>;

export interface Evaluator {
    /** Evaluate an expression returning a single number. */
    eval(expr: string, scope: EvalScope): number;
}

/**
 * Common Math functions exposed as bare names (sin, cos, etc.)
 * so users can write `sin(x)` instead of `Math.sin(x)`.
 */
const MATH_NAMES: string[] = Object.getOwnPropertyNames(Math);

/** Build a function body that exposes Math functions as bare names. */
function buildFunctionBody(jsExpr: string, scopeKeys: string[]): string {
    // Destructure scope variables
    const scopeDestructure =
        scopeKeys.length > 0
            ? `const { ${scopeKeys.join(", ")} } = scope;`
            : "";
    // Expose Math functions as bare names
    const mathAssign = MATH_NAMES.map((n) => `const ${n} = Math.${n};`).join(" ");
    return `${scopeDestructure} ${mathAssign} return ${jsExpr};`;
}

export class SimpleEvaluator implements Evaluator {
    private cache = new Map<string, (scope: EvalScope) => number>();

    eval(expr: string, scope: EvalScope): number {
        // Cache key includes expression only — the function handles arbitrary
        // scope keys at call time via Object.keys(scope).
        const cacheKey = expr;
        let fn = this.cache.get(cacheKey);

        if (!fn) {
            // Rewrite ^ to ** for exponentiation
            const jsExpr = expr.replace(/\^/g, "**");
            // Pre-extract scope keys from a representative call to build the
            // destructuring. We rebuild the function if scope keys change.
            const scopeKeys = Object.keys(scope);
            fn = new Function(
                "scope",
                buildFunctionBody(jsExpr, scopeKeys),
            ) as (scope: EvalScope) => number;
            this.cache.set(cacheKey, fn);
        }

        return fn(scope);
    }
}
