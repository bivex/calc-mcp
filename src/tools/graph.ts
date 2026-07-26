import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const edgeSchema = z.tuple([z.number(), z.number()]);

const schema = {
	action: z
		.enum(["indices", "bounds"])
		.optional()
		.describe(
			"Action: indices (default: calculate all topological indices) or bounds (compare DSO with paper bounds)",
		),
	edges: z
		.array(edgeSchema)
		.optional()
		.describe(
			"List of graph edges as vertex index pairs, e.g. [[0, 1], [1, 2], [2, 0]]",
		),
	adjacencyMatrix: z
		.array(z.array(z.number()))
		.optional()
		.describe("Adjacency matrix of the graph"),
	graphType: z
		.enum(["star", "cycle", "path", "complete"])
		.optional()
		.describe("Preset graph type: star, cycle, path, or complete"),
	n: z.number().optional().describe("Number of vertices for graphType preset"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

interface GraphData {
	n: number;
	m: number;
	degrees: Map<number, number>;
	edges: [number, number][];
	delta: number;
	Delta: number;
}

function parseGraph(input: Input): GraphData {
	let rawEdges: [number, number][] = [];
	const vertexSet = new Set<number>();

	if (input.graphType && input.n) {
		const n = input.n;
		if (n < 2) throw new Error("n must be at least 2 for presets");
		if (input.graphType === "star") {
			// Center is 0, leaves 1..n-1
			for (let i = 1; i < n; i++) rawEdges.push([0, i]);
		} else if (input.graphType === "path") {
			for (let i = 0; i < n - 1; i++) rawEdges.push([i, i + 1]);
		} else if (input.graphType === "cycle") {
			for (let i = 0; i < n; i++) rawEdges.push([i, (i + 1) % n]);
		} else if (input.graphType === "complete") {
			for (let i = 0; i < n; i++) {
				for (let j = i + 1; j < n; j++) rawEdges.push([i, j]);
			}
		}
	} else if (input.edges && input.edges.length > 0) {
		rawEdges = input.edges;
	} else if (input.adjacencyMatrix && input.adjacencyMatrix.length > 0) {
		const mat = input.adjacencyMatrix;
		const n = mat.length;
		for (let i = 0; i < n; i++) {
			const row = mat[i];
			if (!row) continue;
			for (let j = i + 1; j < n; j++) {
				if (row[j] && row[j] > 0) rawEdges.push([i, j]);
			}
		}
	} else {
		throw new Error(
			"Graph input required: provide edges array, adjacencyMatrix, or graphType preset with n",
		);
	}

	const degrees = new Map<number, number>();
	const formattedEdges: [number, number][] = [];

	for (const [u, v] of rawEdges) {
		const uMin = Math.min(u, v);
		const vMax = Math.max(u, v);
		vertexSet.add(uMin);
		vertexSet.add(vMax);
		formattedEdges.push([uMin, vMax]);
		degrees.set(uMin, (degrees.get(uMin) ?? 0) + 1);
		degrees.set(vMax, (degrees.get(vMax) ?? 0) + 1);
	}

	const n = vertexSet.size;
	const m = formattedEdges.length;
	if (m === 0) throw new Error("Graph must have at least 1 edge");

	let delta = Number.POSITIVE_INFINITY;
	let Delta = 0;

	for (const d of degrees.values()) {
		if (d < delta) delta = d;
		if (d > Delta) Delta = d;
	}

	return { n, m, degrees, edges: formattedEdges, delta, Delta };
}

export function executeGraph(input: Input): string {
	const g = parseGraph(input);
	const { n, m, degrees, edges, delta, Delta } = g;

	// Topological Indices Calculations
	let DSO = 0;
	let SO = 0;
	let M1 = 0;
	let M2 = 0;
	let R = 0;
	let GA = 0;
	let Alb = 0;
	let sigma = 0;
	let H = 0;
	let ISI = 0;
	let F = 0;
	let HM = 0;

	for (const [u, v] of edges) {
		const du = degrees.get(u) ?? 0;
		const dv = degrees.get(v) ?? 0;

		const sumDeg = du + dv;
		const prodDeg = du * dv;
		const diffDeg = Math.abs(du - dv);
		const sumSqDeg = du * du + dv * dv;

		DSO += Math.sqrt(sumSqDeg) / sumDeg;
		SO += Math.sqrt(sumSqDeg);
		M1 += sumDeg;
		M2 += prodDeg;
		R += 1 / Math.sqrt(prodDeg);
		GA += (2 * Math.sqrt(prodDeg)) / sumDeg;
		Alb += diffDeg;
		sigma += diffDeg * diffDeg;
		H += 2 / sumDeg;
		ISI += prodDeg / sumDeg;
		F += sumSqDeg;
		HM += sumDeg * sumDeg;
	}

	// Total Irregularity Index irr_t
	let irr_t = 0;
	const degArr = Array.from(degrees.values());
	for (let i = 0; i < degArr.length; i++) {
		for (let j = i + 1; j < degArr.length; j++) {
			const d1 = degArr[i] ?? 0;
			const d2 = degArr[j] ?? 0;
			irr_t += Math.abs(d1 - d2);
		}
	}

	const isRegular = delta === Delta;

	if (input.action === "bounds") {
		// Theorem 1 Upper Bound: m * sqrt(Delta^2 + delta^2) / (Delta + delta)
		const th1_upper =
			(m * Math.sqrt(Delta ** 2 + delta ** 2)) / (Delta + delta);

		// Theorem 3 Upper Bound: sqrt(m^2 - m * M2 / (2 * Delta^2))
		const th3_upper = Math.sqrt(m * (m - M2 / (2 * Delta ** 2)));

		// Theorem 4 Bounds
		const th4_lower = delta ** 2 * R;
		const th4_upper = Delta ** 2 * R;

		// Theorem 7 Bounds (GA)
		const th7_lower = 0.5 * GA;
		const th7_upper = 0.5 * (Delta / delta + delta / Delta) * GA;

		// Theorem 8 Upper Bound (Harmonic & ISI)
		const th8_upper = Math.sqrt((H / 2) * (M1 - 2 * ISI));

		// Theorem 14 Lower Bound (Sombor & Forgotten & HM)
		const th14_lower = SO ** 2 / Math.sqrt(F * HM);

		return JSON.stringify(
			{
				graphProperties: { n, m, delta, Delta, isRegular },
				actualDSO: Number(DSO.toFixed(6)),
				bounds: {
					theorem1_upper: Number(th1_upper.toFixed(6)),
					theorem3_upper: Number(th3_upper.toFixed(6)),
					theorem4_lower: Number(th4_lower.toFixed(6)),
					theorem4_upper: Number(th4_upper.toFixed(6)),
					theorem7_lower: Number(th7_lower.toFixed(6)),
					theorem7_upper: Number(th7_upper.toFixed(6)),
					theorem8_upper: Number(th8_upper.toFixed(6)),
					theorem14_lower: Number(th14_lower.toFixed(6)),
				},
			},
			null,
			2,
		);
	}

	return JSON.stringify(
		{
			graphProperties: {
				order_n: n,
				size_m: m,
				minDegree_delta: delta,
				maxDegree_Delta: Delta,
				isRegular,
			},
			indices: {
				DSO_DiminishedSombor: Number(DSO.toFixed(6)),
				SO_Sombor: Number(SO.toFixed(6)),
				M1_FirstZagreb: M1,
				M2_SecondZagreb: M2,
				F_Forgotten: F,
				HM_HyperZagreb: HM,
				R_Randic: Number(R.toFixed(6)),
				GA_GeometricArithmetic: Number(GA.toFixed(6)),
				Alb_Albertson: Alb,
				sigma_Irregularity: sigma,
				H_Harmonic: Number(H.toFixed(6)),
				ISI_InverseSum: Number(ISI.toFixed(6)),
				irr_t_TotalIrregularity: irr_t,
			},
		},
		null,
		2,
	);
}

export const tool: ToolDefinition = {
	name: "graph",
	description:
		"Graph theory calculator: calculate all 13 topological indices (Diminished Sombor DSO, Sombor SO, Zagreb M1/M2/HM, Randic, GA, Albertson, Forgotten, Harmonic, ISI, Total Irregularity) and compare sharp paper bounds",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return executeGraph(input);
	},
};
