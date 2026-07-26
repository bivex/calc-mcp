import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const edgeSchema = z.tuple([z.number(), z.number()]);

const schema = {
	action: z
		.enum(["scc", "topological_sort", "fas", "pagerank"])
		.describe(
			"Action: scc (Strongly Connected Components), topological_sort, fas (Feedback Arc Set), or pagerank",
		),
	edges: z
		.array(edgeSchema)
		.describe(
			"List of directed edges [source, target], e.g. [[0, 1], [1, 2], [2, 0]]",
		),
	damping: z
		.number()
		.optional()
		.describe("Damping factor for PageRank (default: 0.85)"),
	iterations: z
		.number()
		.optional()
		.describe("Number of iterations for PageRank (default: 100)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

interface ParsedDigraph {
	nodes: number[];
	adj: Map<number, number[]>;
	inDegree: Map<number, number>;
	outDegree: Map<number, number>;
	edges: [number, number][];
}

function parseDigraph(edges: [number, number][]): ParsedDigraph {
	const nodeSet = new Set<number>();
	const adj = new Map<number, number[]>();
	const inDegree = new Map<number, number>();
	const outDegree = new Map<number, number>();

	for (const [u, v] of edges) {
		nodeSet.add(u);
		nodeSet.add(v);

		const neighbors = adj.get(u) ?? [];
		neighbors.push(v);
		adj.set(u, neighbors);

		outDegree.set(u, (outDegree.get(u) ?? 0) + 1);
		inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
	}

	const nodes = Array.from(nodeSet).sort((a, b) => a - b);
	for (const n of nodes) {
		if (!adj.has(n)) adj.set(n, []);
		if (!inDegree.has(n)) inDegree.set(n, 0);
		if (!outDegree.has(n)) outDegree.set(n, 0);
	}

	return { nodes, adj, inDegree, outDegree, edges };
}

function findSCC(g: ParsedDigraph): number[][] {
	let index = 0;
	const indices = new Map<number, number>();
	const lowlink = new Map<number, number>();
	const onStack = new Set<number>();
	const stack: number[] = [];
	const sccs: number[][] = [];

	function strongConnect(u: number) {
		indices.set(u, index);
		lowlink.set(u, index);
		index++;
		stack.push(u);
		onStack.add(u);

		const neighbors = g.adj.get(u) ?? [];
		for (const v of neighbors) {
			if (!indices.has(v)) {
				strongConnect(v);
				const uLow = lowlink.get(u) ?? 0;
				const vLow = lowlink.get(v) ?? 0;
				lowlink.set(u, Math.min(uLow, vLow));
			} else if (onStack.has(v)) {
				const uLow = lowlink.get(u) ?? 0;
				const vIdx = indices.get(v) ?? 0;
				lowlink.set(u, Math.min(uLow, vIdx));
			}
		}

		if (lowlink.get(u) === indices.get(u)) {
			const scc: number[] = [];
			while (true) {
				const w = stack.pop();
				if (w === undefined) break;
				onStack.delete(w);
				scc.push(w);
				if (w === u) break;
			}
			sccs.push(scc.sort((a, b) => a - b));
		}
	}

	for (const node of g.nodes) {
		if (!indices.has(node)) {
			strongConnect(node);
		}
	}

	return sccs.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
}

function topologicalSort(g: ParsedDigraph): {
	sorted: number[];
	hasCycle: boolean;
} {
	const inDeg = new Map<number, number>(g.inDegree);
	const queue: number[] = [];

	for (const [node, deg] of inDeg.entries()) {
		if (deg === 0) queue.push(node);
	}

	const sorted: number[] = [];

	while (queue.length > 0) {
		const u = queue.shift();
		if (u === undefined) break;
		sorted.push(u);

		const neighbors = g.adj.get(u) ?? [];
		for (const v of neighbors) {
			const currentDeg = (inDeg.get(v) ?? 0) - 1;
			inDeg.set(v, currentDeg);
			if (currentDeg === 0) queue.push(v);
		}
	}

	const hasCycle = sorted.length !== g.nodes.length;
	return { sorted, hasCycle };
}

function findFeedbackArcSet(g: ParsedDigraph): {
	feedbackEdges: [number, number][];
	remainingAcyclicEdges: [number, number][];
} {
	// Eades-Lin-Smyth (1993) heuristic for Feedback Arc Set
	const activeNodes = new Set<number>(g.nodes);
	const inDeg = new Map<number, number>(g.inDegree);
	const outDeg = new Map<number, number>(g.outDegree);
	const adj = new Map<number, Set<number>>();

	for (const [u, neighbors] of g.adj.entries()) {
		adj.set(u, new Set(neighbors));
	}

	const s1: number[] = [];
	const s2: number[] = [];

	while (activeNodes.size > 0) {
		// 1. Remove sinks
		let sinkFound = true;
		while (sinkFound) {
			sinkFound = false;
			for (const node of activeNodes) {
				if ((outDeg.get(node) ?? 0) === 0) {
					s2.unshift(node);
					activeNodes.delete(node);
					sinkFound = true;
					// Update in-degrees of neighbors
					for (const u of activeNodes) {
						if (adj.get(u)?.has(node)) {
							adj.get(u)?.delete(node);
							outDeg.set(u, (outDeg.get(u) ?? 1) - 1);
						}
					}
					break;
				}
			}
		}

		// 2. Remove sources
		let sourceFound = true;
		while (sourceFound) {
			sourceFound = false;
			for (const node of activeNodes) {
				if ((inDeg.get(node) ?? 0) === 0) {
					s1.push(node);
					activeNodes.delete(node);
					sourceFound = true;
					// Update out-degrees of targets
					const targets = adj.get(node) ?? new Set();
					for (const v of targets) {
						inDeg.set(v, (inDeg.get(v) ?? 1) - 1);
					}
					break;
				}
			}
		}

		// 3. Select vertex with max (outDeg - inDeg)
		if (activeNodes.size > 0) {
			let maxVal = -Infinity;
			let maxNode = -1;

			for (const node of activeNodes) {
				const diff = (outDeg.get(node) ?? 0) - (inDeg.get(node) ?? 0);
				if (diff > maxVal) {
					maxVal = diff;
					maxNode = node;
				}
			}

			if (maxNode !== -1) {
				s1.push(maxNode);
				activeNodes.delete(maxNode);
				// Update degrees
				const targets = adj.get(maxNode) ?? new Set();
				for (const v of targets) {
					inDeg.set(v, (inDeg.get(v) ?? 1) - 1);
				}
				for (const u of activeNodes) {
					if (adj.get(u)?.has(maxNode)) {
						adj.get(u)?.delete(maxNode);
						outDeg.set(u, (outDeg.get(u) ?? 1) - 1);
					}
				}
			}
		}
	}

	const order = [...s1, ...s2];
	const pos = new Map<number, number>();
	order.forEach((node, idx) => {
		pos.set(node, idx);
	});

	const feedbackEdges: [number, number][] = [];
	const remainingAcyclicEdges: [number, number][] = [];

	for (const [u, v] of g.edges) {
		const posU = pos.get(u) ?? 0;
		const posV = pos.get(v) ?? 0;
		if (posU > posV) {
			feedbackEdges.push([u, v]);
		} else {
			remainingAcyclicEdges.push([u, v]);
		}
	}

	return { feedbackEdges, remainingAcyclicEdges };
}

function calculatePageRank(
	g: ParsedDigraph,
	damping = 0.85,
	maxIter = 100,
): Record<number, number> {
	const N = g.nodes.length;
	if (N === 0) return {};

	let rank = new Map<number, number>();
	const initialRank = 1 / N;
	for (const node of g.nodes) rank.set(node, initialRank);

	for (let iter = 0; iter < maxIter; iter++) {
		const nextRank = new Map<number, number>();
		let sinkSum = 0;

		for (const node of g.nodes) {
			const outDeg = g.outDegree.get(node) ?? 0;
			if (outDeg === 0) {
				sinkSum += rank.get(node) ?? 0;
			}
		}

		for (const target of g.nodes) {
			let incomingRankSum = 0;
			for (const source of g.nodes) {
				const neighbors = g.adj.get(source) ?? [];
				if (neighbors.includes(target)) {
					const outDeg = g.outDegree.get(source) ?? 1;
					incomingRankSum += (rank.get(source) ?? 0) / outDeg;
				}
			}

			const r = (1 - damping) / N + damping * (incomingRankSum + sinkSum / N);
			nextRank.set(target, r);
		}

		rank = nextRank;
	}

	const res: Record<number, number> = {};
	for (const [node, r] of rank.entries()) {
		res[node] = Number(r.toFixed(6));
	}
	return res;
}

export function execute(input: Input): string {
	const g = parseDigraph(input.edges);

	switch (input.action) {
		case "scc": {
			const sccs = findSCC(g);
			return JSON.stringify(
				{
					nodeCount: g.nodes.length,
					edgeCount: g.edges.length,
					sccCount: sccs.length,
					stronglyConnectedComponents: sccs,
				},
				null,
				2,
			);
		}
		case "topological_sort": {
			const { sorted, hasCycle } = topologicalSort(g);
			return JSON.stringify(
				{
					hasCycle,
					topologicalOrder: hasCycle ? [] : sorted,
					status: hasCycle
						? "Graph contains cycles (DAG required for topological sort)"
						: "Success",
				},
				null,
				2,
			);
		}
		case "fas": {
			const { feedbackEdges, remainingAcyclicEdges } = findFeedbackArcSet(g);
			return JSON.stringify(
				{
					feedbackArcSetCount: feedbackEdges.length,
					feedbackEdges,
					remainingAcyclicEdgeCount: remainingAcyclicEdges.length,
				},
				null,
				2,
			);
		}
		case "pagerank": {
			const ranks = calculatePageRank(
				g,
				input.damping ?? 0.85,
				input.iterations ?? 100,
			);
			return JSON.stringify(
				{
					damping: input.damping ?? 0.85,
					pageRanks: ranks,
				},
				null,
				2,
			);
		}
	}
}

export const tool: ToolDefinition = {
	name: "digraph",
	description:
		"Directed graph algorithms: Strongly Connected Components (Tarjan), Topological Sorting (Kahn), Feedback Arc Set (FAS - Eades-Lin-Smyth), and PageRank vector calculation",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
