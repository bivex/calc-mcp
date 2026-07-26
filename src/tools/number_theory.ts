import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["divisors", "fractional_sum", "gauss_circle", "mobius", "erdos_979"])
		.describe(
			"Number theory action: divisors, fractional_sum, gauss_circle, mobius, or erdos_979",
		),
	n: z
		.number()
		.optional()
		.describe("Number n for divisors, mobius, fractional_sum, or erdos_979"),
	k: z
		.number()
		.optional()
		.describe(
			"Power k for divisor sum sigma_k or erdos_979 power k (default: 1 for divisors, 2 for erdos_979)",
		),
	radius: z.number().optional().describe("Radius R for Gauss circle problem"),
	sequence: z
		.enum(["fibonacci", "lucas", "natural"])
		.optional()
		.describe("Sequence type for fractional_sum (default: fibonacci)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function isPrime(num: number): boolean {
	if (num < 2) return false;
	if (num === 2 || num === 3) return true;
	if (num % 2 === 0 || num % 3 === 0) return false;
	for (let i = 5; i * i <= num; i += 6) {
		if (num % i === 0 || num % (i + 2) === 0) return false;
	}
	return true;
}

function getDivisors(n: number): number[] {
	if (n <= 0) throw new Error("n must be a positive integer");
	const divs: number[] = [];
	for (let i = 1; i * i <= n; i++) {
		if (n % i === 0) {
			divs.push(i);
			if (i * i !== n) {
				divs.push(n / i);
			}
		}
	}
	return divs.sort((a, b) => a - b);
}

function mobius(n: number): number {
	if (n <= 0) throw new Error("n must be a positive integer");
	if (n === 1) return 1;

	let pCount = 0;
	let temp = n;

	for (let i = 2; i * i <= temp; i++) {
		if (temp % i === 0) {
			pCount++;
			temp /= i;
			if (temp % i === 0) return 0; // Square factor found
		}
	}
	if (temp > 1) pCount++;

	return pCount % 2 === 1 ? -1 : 1;
}

function fibonacciBig(n: number): bigint {
	let a = 0n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const t = a + b;
		a = b;
		b = t;
	}
	return a;
}

function lucasBig(n: number): bigint {
	let a = 2n;
	let b = 1n;
	for (let i = 0; i < n; i++) {
		const t = a + b;
		a = b;
		b = t;
	}
	return a;
}

function calculateFractionalSum(input: Input): string {
	const n = input.n ?? 10;
	if (n <= 0 || n > 100)
		throw new Error("n must be between 1 and 100 for fractional_sum");

	const seqType = input.sequence ?? "fibonacci";
	let sumFrac = 0;

	if (seqType === "fibonacci") {
		const Fn = fibonacciBig(n);
		for (let k = 1; k <= n; k++) {
			const Fk = fibonacciBig(k);
			if (Fk > 0n) {
				const rem = Fn % Fk;
				const frac = Number(rem) / Number(Fk);
				sumFrac += frac;
			}
		}
	} else if (seqType === "lucas") {
		const Ln = lucasBig(n);
		for (let k = 1; k <= n; k++) {
			const Lk = lucasBig(k);
			if (Lk > 0n) {
				const rem = Ln % Lk;
				const frac = Number(rem) / Number(Lk);
				sumFrac += frac;
			}
		}
	} else {
		for (let k = 1; k <= n; k++) {
			const rem = n % k;
			sumFrac += rem / k;
		}
	}

	return JSON.stringify({
		n,
		sequence: seqType,
		fractionalSum: Number(sumFrac.toFixed(6)),
	});
}

function calculateGaussCircle(R: number): string {
	if (R < 0) throw new Error("radius R must be non-negative");

	const R2 = R * R;
	let latticePoints = 0;

	const maxCoord = Math.floor(R);
	for (let x = -maxCoord; x <= maxCoord; x++) {
		const yMax = Math.floor(Math.sqrt(R2 - x * x));
		latticePoints += 2 * yMax + 1;
	}

	const exactArea = Math.PI * R2;
	const errorTerm = latticePoints - exactArea;

	return JSON.stringify({
		radius_R: R,
		latticePointsCount_N: latticePoints,
		exactArea_PiR2: Number(exactArea.toFixed(4)),
		errorTerm_E: Number(errorTerm.toFixed(4)),
	});
}

function calculateErdos979(n: number, k = 2): string {
	if (n <= 0) throw new Error("n must be positive for erdos_979");
	if (k < 2 || k > 4) throw new Error("k must be 2, 3, or 4 for erdos_979");

	const maxPrime = Math.floor(n ** (1 / k));
	const primes: number[] = [];
	for (let p = 2; p <= maxPrime; p++) {
		if (isPrime(p)) primes.push(p);
	}

	const primeTuples: number[][] = [];

	function search(
		startIdx: number,
		currentSum: number,
		currentTuple: number[],
	) {
		if (currentTuple.length === k) {
			if (currentSum === n) {
				primeTuples.push([...currentTuple]);
			}
			return;
		}

		for (let i = startIdx; i < primes.length; i++) {
			const p = primes[i];
			if (p === undefined) continue;
			const pPow = p ** k;
			if (currentSum + pPow > n) break;
			currentTuple.push(p);
			search(i, currentSum + pPow, currentTuple);
			currentTuple.pop();
		}
	}

	search(0, 0, []);

	return JSON.stringify({
		n,
		k,
		maxPrimeLimit: maxPrime,
		representationCount_f_k: primeTuples.length,
		primeTuples,
	});
}

export function execute(input: Input): string {
	switch (input.action) {
		case "divisors": {
			const n = input.n;
			if (n === undefined) throw new Error("n is required for divisors");
			const divs = getDivisors(n);
			const k = input.k ?? 1;
			const sigmaK = divs.reduce((acc, d) => acc + d ** k, 0);

			return JSON.stringify({
				n,
				divisorCount_d: divs.length,
				sigmaK,
				divisors: divs,
			});
		}
		case "fractional_sum":
			return calculateFractionalSum(input);
		case "gauss_circle": {
			const r = input.radius;
			if (r === undefined)
				throw new Error("radius is required for gauss_circle");
			return calculateGaussCircle(r);
		}
		case "mobius": {
			const n = input.n;
			if (n === undefined) throw new Error("n is required for mobius");
			return JSON.stringify({
				n,
				mobius: mobius(n),
			});
		}
		case "erdos_979": {
			const n = input.n;
			if (n === undefined) throw new Error("n is required for erdos_979");
			const k = input.k ?? 2;
			return calculateErdos979(n, k);
		}
	}
}

export const tool: ToolDefinition = {
	name: "number_theory",
	description:
		"Number theory calculator: divisors list and sigma_k sum, Mobius function, Gauss circle problem lattice points, fractional part sums, and Erdős #979 prime-power representations f_k(n)",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
