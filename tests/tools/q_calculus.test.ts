import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/q_calculus.js";

describe("q_calculus tool", () => {
	test("calculates q-bracket [3]_0.5 = 1.75", () => {
		const result = JSON.parse(
			execute({
				action: "q_bracket",
				a: 3,
				q: 0.5,
			}),
		);
		expect(result.qBracket).toBe(1.75);
	});

	test("calculates q-factorial [3]_q!", () => {
		const result = JSON.parse(
			execute({
				action: "q_factorial",
				n: 3,
				q: 0.5,
			}),
		);
		// [1]*[2]*[3] = 1 * (1 + 0.5) * (1 + 0.5 + 0.25) = 1 * 1.5 * 1.75 = 2.625
		expect(result.qFactorial).toBe(2.625);
	});

	test("calculates q-binomial coefficient [4 2]_q", () => {
		const result = JSON.parse(
			execute({
				action: "q_binomial",
				n: 4,
				k: 2,
				q: 0.5,
			}),
		);
		expect(result.qBinomial).toBeGreaterThan(0);
	});

	test("calculates q-Pochhammer symbol (0.5; 0.5)_3", () => {
		// (1 - 0.5)*(1 - 0.25)*(1 - 0.125) = 0.5 * 0.75 * 0.875 = 0.328125
		const result = JSON.parse(
			execute({
				action: "q_pochhammer",
				a: 0.5,
				q: 0.5,
				n: 3,
			}),
		);
		expect(result.qPochhammer).toBe(0.328125);
	});

	test("calculates Jackson q-derivative of x^3 for q=0.5 at x=2", () => {
		// D_q(x^3) = (x^3 - (q x)^3) / ((1 - q) x) = x^2 (1 - q^3) / (1 - q) = x^2 [3]_q
		// For x=2, q=0.5: 4 * 1.75 = 7
		const result = JSON.parse(
			execute({
				action: "jackson_derivative",
				expression: "x^3",
				q: 0.5,
				x: 2,
			}),
		);
		expect(result.Dq_f).toBe(7);
	});
});
