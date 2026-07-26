import { all, create } from "mathjs";
import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const math = create(all);

const schema = {
	action: z
		.enum([
			"q_bracket",
			"q_factorial",
			"q_binomial",
			"q_pochhammer",
			"jackson_derivative",
		])
		.describe(
			"Action: q_bracket [a]_q, q_factorial [n]_q!, q_binomial [n k]_q, q_pochhammer (a; q)_n, or jackson_derivative D_q f(x)",
		),
	a: z
		.number()
		.optional()
		.describe("Parameter a for q_bracket or q_pochhammer"),
	n: z
		.number()
		.optional()
		.describe("Integer n for factorial, binomial, or pochhammer"),
	k: z.number().optional().describe("Integer k for q_binomial"),
	q: z.number().optional().describe("Quantum parameter q (e.g. 0.5, 0.9)"),
	expression: z
		.string()
		.optional()
		.describe(
			"Mathematical expression f(x) for jackson_derivative, e.g. 'x^3 + 2*x'",
		),
	x: z
		.number()
		.optional()
		.describe("Value of x for jackson_derivative evaluation"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function qBracket(a: number, q: number): number {
	if (Math.abs(q - 1) < 1e-12) return a;
	return (1 - q ** a) / (1 - q);
}

function qFactorial(n: number, q: number): number {
	if (n < 0) throw new Error("n must be non-negative");
	if (n === 0) return 1;
	let prod = 1;
	for (let i = 1; i <= n; i++) {
		prod *= qBracket(i, q);
	}
	return prod;
}

function qBinomial(n: number, k: number, q: number): number {
	if (k < 0 || k > n) return 0;
	if (k === 0 || k === n) return 1;
	const num = qFactorial(n, q);
	const den = qFactorial(k, q) * qFactorial(n - k, q);
	return num / den;
}

function qPochhammer(a: number, q: number, n: number): number {
	if (n < 0) throw new Error("n must be non-negative");
	let prod = 1;
	for (let k = 0; k < n; k++) {
		prod *= 1 - a * q ** k;
	}
	return prod;
}

function jacksonDerivative(
	exprStr: string,
	q: number,
	xVal: number,
): {
	expression: string;
	q: number;
	x: number;
	fx: number;
	fqx: number;
	Dq_f: number;
} {
	const compiled = math.compile(exprStr);
	const fx = Number(compiled.evaluate({ x: xVal }));
	const qxVal = q * xVal;
	const fqx = Number(compiled.evaluate({ x: qxVal }));

	let Dq_f: number;
	if (Math.abs(xVal) < 1e-12) {
		// Limit as x -> 0, approximate with small x
		const smallX = 1e-7;
		const fSmall = Number(compiled.evaluate({ x: smallX }));
		const fqSmall = Number(compiled.evaluate({ x: q * smallX }));
		Dq_f = (fSmall - fqSmall) / ((1 - q) * smallX);
	} else {
		Dq_f = (fx - fqx) / ((1 - q) * xVal);
	}

	return {
		expression: exprStr,
		q,
		x: xVal,
		fx,
		fqx,
		Dq_f: Number(Dq_f.toFixed(8)),
	};
}

export function execute(input: Input): string {
	const q = input.q ?? 0.5;

	switch (input.action) {
		case "q_bracket": {
			const a = input.a ?? input.n ?? 1;
			const val = qBracket(a, q);
			return JSON.stringify({
				action: "q_bracket",
				a,
				q,
				qBracket: Number(val.toFixed(8)),
			});
		}
		case "q_factorial": {
			const n = input.n ?? 1;
			const val = qFactorial(n, q);
			return JSON.stringify({
				action: "q_factorial",
				n,
				q,
				qFactorial: Number(val.toFixed(8)),
			});
		}
		case "q_binomial": {
			const n = input.n ?? 0;
			const k = input.k ?? 0;
			const val = qBinomial(n, k, q);
			return JSON.stringify({
				action: "q_binomial",
				n,
				k,
				q,
				qBinomial: Number(val.toFixed(8)),
			});
		}
		case "q_pochhammer": {
			const a = input.a ?? 1;
			const n = input.n ?? 1;
			const val = qPochhammer(a, q, n);
			return JSON.stringify({
				action: "q_pochhammer",
				a,
				q,
				n,
				qPochhammer: Number(val.toFixed(8)),
			});
		}
		case "jackson_derivative": {
			const exprStr = input.expression;
			if (!exprStr)
				throw new Error("expression is required for jackson_derivative");
			const xVal = input.x ?? 1;
			const res = jacksonDerivative(exprStr, q, xVal);
			return JSON.stringify(res, null, 2);
		}
	}
}

export const tool: ToolDefinition = {
	name: "q_calculus",
	description:
		"Quantum q-calculus calculator: q-bracket [a]_q, q-factorial [n]_q!, q-binomial coefficients [n k]_q, q-Pochhammer symbol (a; q)_n, and Jackson q-derivative D_q f(x)",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
