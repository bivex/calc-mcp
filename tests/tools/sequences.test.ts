import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/sequences.js";

describe("sequences tool", () => {
	test("calculates Fibonacci sequence F10 = 55", () => {
		const result = JSON.parse(
			execute({
				sequence: "fibonacci",
				n: 10,
			}),
		);
		expect(result.value).toBe("55");
	});

	test("calculates Lucas sequence L5 = 11", () => {
		const result = JSON.parse(
			execute({
				sequence: "lucas",
				n: 5,
			}),
		);
		expect(result.value).toBe("11");
	});

	test("calculates Jacobsthal sequence J5 = 11", () => {
		const result = JSON.parse(
			execute({
				sequence: "jacobsthal",
				n: 5,
			}),
		);
		expect(result.value).toBe("11");
	});

	test("calculates Catalan number C4 = 14", () => {
		const result = JSON.parse(
			execute({
				sequence: "catalan",
				n: 4,
			}),
		);
		expect(result.value).toBe("14");
	});

	test("calculates Stirling 2nd kind S(5, 2) = 15", () => {
		const result = JSON.parse(
			execute({
				sequence: "stirling2",
				n: 5,
				k: 2,
			}),
		);
		expect(result.value).toBe("15");
	});

	test("calculates Bell number B4 = 15", () => {
		const result = JSON.parse(
			execute({
				sequence: "bell",
				n: 4,
			}),
		);
		expect(result.value).toBe("15");
	});

	test("calculates Integer Partition count p(5) = 7", () => {
		const result = JSON.parse(
			execute({
				sequence: "partitions",
				n: 5,
			}),
		);
		expect(result.value).toBe("7");
	});
});
