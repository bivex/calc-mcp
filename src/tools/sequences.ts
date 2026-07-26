import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	sequence: z
		.enum([
			"fibonacci",
			"lucas",
			"jacobsthal",
			"pell",
			"catalan",
			"stirling1",
			"stirling2",
			"bell",
			"partitions",
		])
		.describe(
			"Special sequence to compute: fibonacci, lucas, jacobsthal, pell, catalan, stirling1, stirling2, bell, partitions",
		),
	n: z.number().describe("Index n (non-negative integer)"),
	k: z
		.number()
		.optional()
		.describe("Second parameter k for stirling1 or stirling2 numbers"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function fibonacci(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	let a = 0n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const temp = a + b;
		a = b;
		b = temp;
	}
	return a;
}

function lucas(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	let a = 2n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const temp = a + b;
		a = b;
		b = temp;
	}
	return a;
}

function jacobsthal(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	let a = 0n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const temp = b + 2n * a;
		a = b;
		b = temp;
	}
	return a;
}

function pell(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	let a = 0n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const temp = 2n * b + a;
		a = b;
		b = temp;
	}
	return a;
}

function factorial(n: number): bigint {
	let res = 1n;
	for (let i = 2; i <= n; i++) res *= BigInt(i);
	return res;
}

function nCr(n: number, r: number): bigint {
	if (r < 0 || r > n) return 0n;
	if (r === 0 || r === n) return 1n;
	const k = Math.min(r, n - r);
	let num = 1n;
	let den = 1n;
	for (let i = 1; i <= k; i++) {
		num *= BigInt(n - i + 1);
		den *= BigInt(i);
	}
	return num / den;
}

function catalan(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	return nCr(2 * n, n) / BigInt(n + 1);
}

function stirling2(n: number, k: number): bigint {
	if (n < 0 || k < 0) throw new Error("n and k must be non-negative");
	if (n === 0 && k === 0) return 1n;
	if (n === 0 || k === 0 || k > n) return 0n;

	let sum = 0n;
	for (let j = 0; j <= k; j++) {
		const comb = nCr(k, j);
		const term = BigInt(j) ** BigInt(n);
		const sign = (k - j) % 2 === 0 ? 1n : -1n;
		sum += sign * comb * term;
	}
	return sum / factorial(k);
}

function stirling1Signed(n: number, k: number): bigint {
	if (n < 0 || k < 0) throw new Error("n and k must be non-negative");
	if (n === 0 && k === 0) return 1n;
	if (n === 0 || k === 0 || k > n) return 0n;

	const dp: bigint[][] = Array.from({ length: n + 1 }, () =>
		new Array<bigint>(k + 1).fill(0n),
	);
	const dp0 = dp[0];
	if (dp0) dp0[0] = 1n;

	for (let i = 1; i <= n; i++) {
		const dpI = dp[i];
		const dpPrev = dp[i - 1];
		if (!dpI || !dpPrev) continue;
		for (let j = 1; j <= Math.min(i, k); j++) {
			dpI[j] = (dpPrev[j - 1] ?? 0n) - BigInt(i - 1) * (dpPrev[j] ?? 0n);
		}
	}

	const dpN = dp[n];
	return dpN ? (dpN[k] ?? 0n) : 0n;
}

function bell(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	let sum = 0n;
	for (let k = 0; k <= n; k++) {
		sum += stirling2(n, k);
	}
	return sum;
}

function partitionCount(n: number): bigint {
	if (n < 0) throw new Error("n must be non-negative");
	if (n === 0) return 1n;

	const p: bigint[] = new Array<bigint>(n + 1).fill(0n);
	p[0] = 1n;

	for (let i = 1; i <= n; i++) {
		let sum = 0n;
		let k = 1;
		while (true) {
			const g1 = (k * (3 * k - 1)) / 2;
			const g2 = (k * (3 * k + 1)) / 2;
			if (g1 > i) break;

			const sign = k % 2 === 1 ? 1n : -1n;
			sum += sign * (p[i - g1] ?? 0n);
			if (g2 <= i) {
				sum += sign * (p[i - g2] ?? 0n);
			}
			k++;
		}
		p[i] = sum;
	}

	return p[n] ?? 0n;
}

export function execute(input: Input): string {
	const n = input.n;
	const seq = input.sequence;

	let val: bigint;

	switch (seq) {
		case "fibonacci":
			val = fibonacci(n);
			break;
		case "lucas":
			val = lucas(n);
			break;
		case "jacobsthal":
			val = jacobsthal(n);
			break;
		case "pell":
			val = pell(n);
			break;
		case "catalan":
			val = catalan(n);
			break;
		case "stirling1": {
			const k = input.k ?? 0;
			val = stirling1Signed(n, k);
			break;
		}
		case "stirling2": {
			const k = input.k ?? 0;
			val = stirling2(n, k);
			break;
		}
		case "bell":
			val = bell(n);
			break;
		case "partitions":
			val = partitionCount(n);
			break;
	}

	return JSON.stringify({
		sequence: seq,
		n,
		...(input.k !== undefined && { k: input.k }),
		value: val.toString(),
	});
}

export const tool: ToolDefinition = {
	name: "sequences",
	description:
		"Special integer sequences calculator: Fibonacci, Lucas, Jacobsthal, Pell, Catalan, Stirling (1st & 2nd kind), Bell, and Euler integer partitions p(n) with BigInt precision",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
