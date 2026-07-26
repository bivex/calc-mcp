import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["hamming_distance", "parity_check", "self_orthogonal", "syndrome"])
		.describe(
			"Coding theory action: hamming_distance, parity_check, self_orthogonal, or syndrome",
		),
	text1: z
		.string()
		.optional()
		.describe("First binary string for hamming_distance"),
	text2: z
		.string()
		.optional()
		.describe("Second binary string for hamming_distance"),
	vector1: z
		.array(z.number())
		.optional()
		.describe("First binary vector or received codeword vector"),
	vector2: z.array(z.number()).optional().describe("Second binary vector"),
	generatorMatrix: z
		.array(z.array(z.number()))
		.optional()
		.describe("Generator matrix G (binary matrix 0/1)"),
	parityMatrix: z
		.array(z.array(z.number()))
		.optional()
		.describe("Parity check matrix H (binary matrix 0/1)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function calculateHammingDistance(input: Input): string {
	if (input.text1 !== undefined && input.text2 !== undefined) {
		const s1 = input.text1;
		const s2 = input.text2;
		if (s1.length !== s2.length)
			throw new Error("Strings must have the same length for Hamming distance");
		let dist = 0;
		for (let i = 0; i < s1.length; i++) {
			if (s1[i] !== s2[i]) dist++;
		}
		return JSON.stringify({
			type: "string",
			length: s1.length,
			hammingDistance: dist,
		});
	}

	if (input.vector1 !== undefined && input.vector2 !== undefined) {
		const v1 = input.vector1;
		const v2 = input.vector2;
		if (v1.length !== v2.length)
			throw new Error("Vectors must have the same length for Hamming distance");
		let dist = 0;
		for (let i = 0; i < v1.length; i++) {
			if (v1[i] !== v2[i]) dist++;
		}
		return JSON.stringify({
			type: "vector",
			length: v1.length,
			hammingDistance: dist,
		});
	}

	throw new Error(
		"Provide text1 & text2 OR vector1 & vector2 for hamming_distance",
	);
}

function calculateSelfOrthogonal(G: number[][]): string {
	const k = G.length;
	if (k === 0) throw new Error("Generator matrix G cannot be empty");
	const firstRow = G[0];
	if (!firstRow) throw new Error("Generator matrix G cannot have empty rows");
	const n = firstRow.length;

	let isSelfOrthogonal = true;
	const dotMatrix: number[][] = [];

	for (let i = 0; i < k; i++) {
		const rowI = G[i];
		if (!rowI || rowI.length !== n)
			throw new Error("Matrix rows must be of uniform size");
		const rowRes: number[] = [];

		for (let j = 0; j < k; j++) {
			const rowJ = G[j];
			if (!rowJ) continue;
			let dot = 0;
			for (let col = 0; col < n; col++) {
				const valI = rowI[col] ?? 0;
				const valJ = rowJ[col] ?? 0;
				dot = (dot + valI * valJ) % 2;
			}
			rowRes.push(dot);
			if (dot !== 0) {
				isSelfOrthogonal = false;
			}
		}
		dotMatrix.push(rowRes);
	}

	return JSON.stringify(
		{
			k_rows: k,
			n_cols: n,
			isSelfOrthogonal,
			product_G_G_transpose_mod2: dotMatrix,
		},
		null,
		2,
	);
}

function calculateParityCheckMatrix(G: number[][]): string {
	const k = G.length;
	if (k === 0) throw new Error("Generator matrix G cannot be empty");
	const firstRow = G[0];
	if (!firstRow) throw new Error("Generator matrix G cannot have empty rows");
	const n = firstRow.length;
	if (n <= k) throw new Error("Generator matrix G must have n > k");

	// Extract P from G = [Ik | P]
	const P: number[][] = [];
	for (let i = 0; i < k; i++) {
		const row = G[i];
		if (!row || row.length !== n)
			throw new Error("Uniform row length required");
		P.push(row.slice(k));
	}

	// Compute H = [-P^T | I_{n-k}] mod 2
	const nMinusK = n - k;
	const H: number[][] = [];

	for (let i = 0; i < nMinusK; i++) {
		const hRow: number[] = [];
		// Add P^T column i
		for (let j = 0; j < k; j++) {
			const pRow = P[j];
			hRow.push((pRow?.[i] ?? 0) % 2);
		}
		// Add Identity I_{n-k}
		for (let j = 0; j < nMinusK; j++) {
			hRow.push(i === j ? 1 : 0);
		}
		H.push(hRow);
	}

	return JSON.stringify(
		{
			k,
			n,
			code: `[${n}, ${k}]`,
			parityCheckMatrix_H: H,
		},
		null,
		2,
	);
}

function calculateSyndrome(v: number[], H: number[][]): string {
	const numRowsH = H.length;
	if (numRowsH === 0) throw new Error("Parity check matrix H cannot be empty");
	const firstRowH = H[0];
	if (!firstRowH) throw new Error("Row in H cannot be empty");
	const n = firstRowH.length;
	if (v.length !== n)
		throw new Error(
			`Codeword vector length (${v.length}) must match H columns (${n})`,
		);

	const syndrome: number[] = [];
	for (let i = 0; i < numRowsH; i++) {
		const hRow = H[i];
		if (!hRow || hRow.length !== n)
			throw new Error("Uniform row length required in H");
		let sum = 0;
		for (let j = 0; j < n; j++) {
			const vj = v[j] ?? 0;
			const hj = hRow[j] ?? 0;
			sum = (sum + vj * hj) % 2;
		}
		syndrome.push(sum);
	}

	const hasError = syndrome.some((val) => val !== 0);

	return JSON.stringify({
		receivedVector: v,
		syndromeVector: syndrome,
		hasError,
	});
}

export function execute(input: Input): string {
	switch (input.action) {
		case "hamming_distance":
			return calculateHammingDistance(input);
		case "self_orthogonal": {
			const G = input.generatorMatrix;
			if (!G)
				throw new Error("generatorMatrix G is required for self_orthogonal");
			return calculateSelfOrthogonal(G);
		}
		case "parity_check": {
			const G = input.generatorMatrix;
			if (!G) throw new Error("generatorMatrix G is required for parity_check");
			return calculateParityCheckMatrix(G);
		}
		case "syndrome": {
			const v = input.vector1;
			const H = input.parityMatrix;
			if (!v || !H)
				throw new Error(
					"vector1 (received vector) and parityMatrix H required for syndrome",
				);
			return calculateSyndrome(v, H);
		}
	}
}

export const tool: ToolDefinition = {
	name: "coding_theory",
	description:
		"Linear coding theory calculator: Hamming distance, parity-check matrix H generation [I_k | P] -> [-P^T | I_{n-k}], self-orthogonality G*G^T = 0 (mod 2) check, and syndrome decoding",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
