import { describe, expect, test } from "bun:test";
import { executeGraph } from "../../src/tools/graph.js";

describe("graph tool", () => {
	test("calculates topological indices for 4-cycle graph C4", () => {
		const result = JSON.parse(
			executeGraph({
				graphType: "cycle",
				n: 4,
			}),
		);
		expect(result.graphProperties.order_n).toBe(4);
		expect(result.graphProperties.size_m).toBe(4);
		expect(result.graphProperties.isRegular).toBe(true);
		expect(result.indices.DSO_DiminishedSombor).toBeCloseTo(2.828427, 4); // 4 * sqrt(8)/4 = 4 * 0.707106
		expect(result.indices.M1_FirstZagreb).toBe(16);
		expect(result.indices.M2_SecondZagreb).toBe(16);
	});

	test("calculates topological indices for star graph S4 (K1,3)", () => {
		const result = JSON.parse(
			executeGraph({
				graphType: "star",
				n: 4,
			}),
		);
		expect(result.graphProperties.order_n).toBe(4);
		expect(result.graphProperties.size_m).toBe(3);
		expect(result.graphProperties.isRegular).toBe(false);
		expect(result.indices.Alb_Albertson).toBe(6); // 3 edges * |3-1| = 6
	});

	test("compares DSO with theoretical bounds on C4 (regular graph)", () => {
		const result = JSON.parse(
			executeGraph({
				action: "bounds",
				graphType: "cycle",
				n: 4,
			}),
		);
		expect(result.actualDSO).toBeCloseTo(2.828427, 4);
		expect(result.bounds.theorem1_upper).toBeCloseTo(2.828427, 4); // Equality holds for regular graphs
	});
});
