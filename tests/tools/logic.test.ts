import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/logic.js";

describe("logic tool", () => {
	test("generates truth table for (A AND B) OR NOT C", () => {
		const result = JSON.parse(
			execute({
				expression: "(A AND B) OR NOT C",
			}),
		);
		expect(result.variables).toEqual(["A", "B", "C"]);
		expect(result.rowCount).toBe(8);
		expect(result.isTautology).toBe(false);
		expect(result.isContradiction).toBe(false);
	});

	test("detects tautology A OR NOT A", () => {
		const result = JSON.parse(
			execute({
				expression: "A OR NOT A",
			}),
		);
		expect(result.isTautology).toBe(true);
		expect(result.isContradiction).toBe(false);
	});

	test("generates canonical SDNF and SKNF", () => {
		const result = JSON.parse(
			execute({
				action: "canonical",
				expression: "A -> B",
			}),
		);
		expect(result.SDNF_DisjunctiveNormalForm).toContain("OR");
		expect(result.SKNF_ConjunctiveNormalForm).toContain("NOT A OR B");
	});

	test("evaluates expression for specific assignment", () => {
		const result = JSON.parse(
			execute({
				action: "evaluate",
				expression: "A AND B",
				values: { A: true, B: false },
			}),
		);
		expect(result.result).toBe(false);
	});

	test("generates DIMACS CNF format for SAT solver", () => {
		const result = JSON.parse(
			execute({
				action: "cnf_dimacs",
				expression: "A -> B",
			}),
		);
		expect(result.variableCount).toBe(2);
		expect(result.dimacsCnfFormat).toContain("p cnf 2 1");
	});
});
