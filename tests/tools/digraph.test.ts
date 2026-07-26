import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/digraph.js";

describe("digraph tool", () => {
	test("finds Strongly Connected Components (SCC) using Tarjan algorithm", () => {
		// Graph with 2 SCCs: [0, 1, 2] cycle and [3]
		const result = JSON.parse(
			execute({
				action: "scc",
				edges: [
					[0, 1],
					[1, 2],
					[2, 0],
					[2, 3],
				],
			}),
		);
		expect(result.sccCount).toBe(2);
		expect(result.stronglyConnectedComponents).toEqual([[0, 1, 2], [3]]);
	});

	test("performs Topological Sort on a DAG", () => {
		const result = JSON.parse(
			execute({
				action: "topological_sort",
				edges: [
					[0, 1],
					[0, 2],
					[1, 3],
					[2, 3],
				],
			}),
		);
		expect(result.hasCycle).toBe(false);
		expect(result.topologicalOrder[0]).toBe(0);
		expect(result.topologicalOrder[3]).toBe(3);
	});

	test("calculates PageRank vector for a directed graph", () => {
		const result = JSON.parse(
			execute({
				action: "pagerank",
				edges: [
					[0, 1],
					[1, 2],
					[2, 0],
				],
			}),
		);
		expect(result.pageRanks[0]).toBeCloseTo(0.333, 2);
		expect(result.pageRanks[1]).toBeCloseTo(0.333, 2);
		expect(result.pageRanks[2]).toBeCloseTo(0.333, 2);
	});
});
