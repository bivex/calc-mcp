import { describe, expect, test } from "bun:test";
import { executeLinearRegression } from "../../src/tools/regression.js";

describe("regression tool", () => {
	test("calculates linear regression for linear points y = 2x + 1", () => {
		const result = JSON.parse(
			executeLinearRegression({
				points: [
					{ x: 1, y: 3 },
					{ x: 2, y: 5 },
					{ x: 3, y: 7 },
					{ x: 4, y: 9 },
				],
				predictX: 5,
			}),
		);
		expect(result.slope).toBe(2);
		expect(result.intercept).toBe(1);
		expect(result.pearsonR).toBe(1);
		expect(result.rSquared).toBe(1);
		expect(result.prediction.predictedY).toBe(11);
	});
});
