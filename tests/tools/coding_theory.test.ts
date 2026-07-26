import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/coding_theory.js";

describe("coding_theory tool", () => {
	test("calculates Hamming distance between binary strings", () => {
		const result = JSON.parse(
			execute({
				action: "hamming_distance",
				text1: "1011101",
				text2: "1001001",
			}),
		);
		expect(result.hammingDistance).toBe(2);
	});

	test("generates parity check matrix H from G = [I2 | P]", () => {
		const result = JSON.parse(
			execute({
				action: "parity_check",
				generatorMatrix: [
					[1, 0, 1, 1],
					[0, 1, 1, 0],
				],
			}),
		);
		expect(result.parityCheckMatrix_H).toEqual([
			[1, 1, 1, 0],
			[1, 0, 0, 1],
		]);
	});

	test("checks self-orthogonality of generator matrix G", () => {
		const result = JSON.parse(
			execute({
				action: "self_orthogonal",
				generatorMatrix: [
					[1, 1, 0, 0],
					[0, 0, 1, 1],
				],
			}),
		);
		expect(result.isSelfOrthogonal).toBe(true);
	});

	test("calculates syndrome vector s = v * H^T (mod 2)", () => {
		const result = JSON.parse(
			execute({
				action: "syndrome",
				vector1: [1, 0, 1, 1],
				parityMatrix: [
					[1, 1, 1, 0],
					[1, 0, 0, 1],
				],
			}),
		);
		expect(result.syndromeVector).toEqual([0, 0]);
		expect(result.hasError).toBe(false);
	});
});
