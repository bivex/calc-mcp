import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/number_theory.js";

describe("number_theory tool", () => {
	test("calculates divisors for n = 12", () => {
		const result = JSON.parse(
			execute({
				action: "divisors",
				n: 12,
			}),
		);
		expect(result.divisorCount_d).toBe(6);
		expect(result.divisors).toEqual([1, 2, 3, 4, 6, 12]);
		expect(result.sigmaK).toBe(28); // 1 + 2 + 3 + 4 + 6 + 12 = 28
	});

	test("calculates Mobius function for square-free and non-square-free numbers", () => {
		expect(JSON.parse(execute({ action: "mobius", n: 6 })).mobius).toBe(1); // 2 * 3 -> (-1)^2 = 1
		expect(JSON.parse(execute({ action: "mobius", n: 12 })).mobius).toBe(0); // 2^2 * 3 -> 0
		expect(JSON.parse(execute({ action: "mobius", n: 7 })).mobius).toBe(-1); // 7 -> (-1)^1 = -1
	});

	test("calculates Gauss circle lattice points for R = 5", () => {
		const result = JSON.parse(
			execute({
				action: "gauss_circle",
				radius: 5,
			}),
		);
		expect(result.latticePointsCount_N).toBe(81);
		expect(result.exactArea_PiR2).toBeCloseTo(78.5398, 2);
	});

	test("calculates Fibonacci fractional part sum", () => {
		const result = JSON.parse(
			execute({
				action: "fractional_sum",
				n: 5,
				sequence: "fibonacci",
			}),
		);
		expect(result.fractionalSum).toBeGreaterThan(0);
	});

	test("calculates Erdős #979 prime-power representations for n = 34", () => {
		const result = JSON.parse(
			execute({
				action: "erdos_979",
				n: 34,
				k: 2,
			}),
		);
		expect(result.representationCount_f_k).toBe(1);
		expect(result.primeTuples).toEqual([[3, 5]]); // 3^2 + 5^2 = 9 + 25 = 34
	});
});
