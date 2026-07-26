import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/math.js";

describe("math", () => {
	test("evaluates basic expression", () => {
		expect(execute({ expression: "2 + 3" })).toBe("5");
	});

	test("evaluates complex expression", () => {
		expect(execute({ expression: "sqrt(16) + 2^3" })).toBe("12");
	});

	test("evaluates trigonometric functions", () => {
		const result = Number(execute({ expression: "sin(pi/2)" }));
		expect(result).toBeCloseTo(1);
	});

	test("symbolic derivative", () => {
		const result = execute({
			action: "derivative",
			expression: "x^3 + 2*x",
			variable: "x",
		});
		expect(result).toBe("3 * x ^ 2 + 2");
	});

	test("symbolic expression simplification", () => {
		const result = execute({
			action: "simplify",
			expression: "2 * x + 3 * x",
		});
		expect(result).toBe("5 * x");
	});

	test("numerical integration (Simpson rule)", () => {
		const result = JSON.parse(
			execute({
				action: "integrate",
				expression: "x^2",
				variable: "x",
				a: 0,
				b: 3,
			}),
		);
		expect(result.integral).toBe(9);
	});

	test("vector dot product", () => {
		const result = JSON.parse(
			execute({
				action: "vector",
				subAction: "dot",
				vector1: [1, 2, 3],
				vector2: [4, 5, 6],
			}),
		);
		expect(result.dotProduct).toBe(32);
	});

	test("vector cross product", () => {
		const result = JSON.parse(
			execute({
				action: "vector",
				subAction: "cross",
				vector1: [1, 0, 0],
				vector2: [0, 1, 0],
			}),
		);
		expect(result.crossProduct).toEqual([0, 0, 1]);
	});

	test("vector norm", () => {
		const result = JSON.parse(
			execute({
				action: "vector",
				subAction: "norm",
				vector1: [3, 4],
			}),
		);
		expect(result.norm).toBe(5);
	});

	test("linear system solver (A * x = b)", () => {
		const result = JSON.parse(
			execute({
				action: "solve_linear",
				matrix: [
					[2, 1],
					[1, -1],
				],
				vector1: [5, 1],
			}),
		);
		expect(result.solution).toEqual([2, 1]);
	});

	test("matrix determinant action", () => {
		const result = execute({
			action: "det",
			matrix: [
				[1, 2],
				[3, 4],
			],
		});
		expect(Number(result)).toBeCloseTo(-2);
	});

	test("matrix inverse action", () => {
		const result = JSON.parse(
			execute({
				action: "inv",
				matrix: [
					[1, 2],
					[3, 4],
				],
			}),
		);
		expect(result[0][0]).toBeCloseTo(-2);
		expect(result[0][1]).toBeCloseTo(1);
		expect(result[1][0]).toBeCloseTo(1.5);
		expect(result[1][1]).toBeCloseTo(-0.5);
	});

	test("matrix eigenvalues action", () => {
		const result = JSON.parse(
			execute({
				action: "eigs",
				matrix: [
					[1, 2],
					[2, 1],
				],
			}),
		);
		expect(result.values).toEqual([-1, 3]);
	});

	test("computes statistics", () => {
		const result = JSON.parse(
			execute({ action: "statistics", values: [1, 2, 3, 4, 5] }),
		);
		expect(result.mean).toBe(3);
		expect(result.median).toBe(3);
		expect(result.sum).toBe(15);
		expect(result.min).toBe(1);
		expect(result.max).toBe(5);
		expect(result.count).toBe(5);
	});

	test("computes statistics with even count", () => {
		const result = JSON.parse(
			execute({ action: "statistics", values: [1, 2, 3, 4] }),
		);
		expect(result.median).toBe(2.5);
	});

	test("throws on empty values", () => {
		expect(() => execute({ action: "statistics", values: [] })).toThrow();
	});

	test("evaluates matrix expression", () => {
		const result = execute({ expression: "det([1, 2; 3, 4])" });
		expect(Number(result)).toBeCloseTo(-2);
	});

	test("0.1 + 0.2 returns exactly 0.3 (BigNumber precision)", () => {
		expect(execute({ expression: "0.1 + 0.2" })).toBe("0.3");
	});

	test("0.1 * 0.1 returns exactly 0.01", () => {
		expect(execute({ expression: "0.1 * 0.1" })).toBe("0.01");
	});

	test("large integer 2^53 + 1 is exact", () => {
		expect(execute({ expression: "2^53 + 1" })).toBe("9007199254740993");
	});

	test("statistics with decimal values has no floating-point drift", () => {
		const result = JSON.parse(
			execute({ action: "statistics", values: [0.1, 0.2, 0.3] }),
		);
		expect(result.sum).toBe(0.6);
		expect(result.mean).toBe(0.2);
	});

	test("rejects dangerous import function", () => {
		expect(() => execute({ expression: "import('fs')" })).toThrow();
	});

	test("rejects dangerous createUnit function", () => {
		expect(() => execute({ expression: "createUnit('foo')" })).toThrow();
	});

	test("bracket notation is not valid mathjs syntax", () => {
		expect(() => execute({ expression: "['import']" })).toThrow();
	});

	test("window object is not accessible in mathjs", () => {
		expect(() => execute({ expression: "window['import']" })).toThrow();
	});
});
