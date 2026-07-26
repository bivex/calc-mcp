import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	expression: z
		.string()
		.describe(
			"Boolean logic expression, e.g. '(A AND B) OR NOT C', 'A && B || !C', 'A -> B'",
		),
	action: z
		.enum(["truth_table", "canonical", "evaluate"])
		.optional()
		.describe(
			"Action: truth_table (default), canonical (SDNF/SKNF), or evaluate",
		),
	values: z
		.record(z.boolean())
		.optional()
		.describe(
			"Variable truth values map for evaluate action, e.g. { A: true, B: false }",
		),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

const RESERVED_WORDS = new Set([
	"AND",
	"OR",
	"NOT",
	"XOR",
	"IMPLIES",
	"EQUIV",
	"TRUE",
	"FALSE",
	"1",
	"0",
]);

function extractVariables(expr: string): string[] {
	const tokens = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
	const vars = new Set<string>();
	for (const tok of tokens) {
		const upper = tok.toUpperCase();
		if (!RESERVED_WORDS.has(upper)) {
			vars.add(tok);
		}
	}
	return Array.from(vars).sort();
}

function normalizeExpression(expr: string): string {
	let normalized = expr;

	// Replace implication and equivalence operators
	normalized = normalized.replace(/<->|<=>|\bEQUIV\b/gi, " == ");
	normalized = normalized.replace(/->|=>|\bIMPLIES\b/gi, " <= ");

	// Replace word operators
	normalized = normalized.replace(/\bAND\b/gi, " && ");
	normalized = normalized.replace(/\bOR\b/gi, " || ");
	normalized = normalized.replace(/\bNOT\b/gi, " ! ");
	normalized = normalized.replace(/\bXOR\b/gi, " ^ ");

	// Replace bitwise operators if used
	normalized = normalized.replace(/([^&])&([^&])/g, "$1 && $2");
	normalized = normalized.replace(/([^|])\|([^|])/g, "$1 || $2");
	normalized = normalized.replace(/~/g, " ! ");

	return normalized;
}

function evaluateLogic(
	expr: string,
	vars: string[],
	assignment: Record<string, boolean>,
): boolean {
	const normalized = normalizeExpression(expr);
	const keys = Object.keys(assignment);
	const vals = Object.values(assignment);

	// Evaluate using Function constructor in a restricted scope
	try {
		const fn = new Function(...keys, `return Boolean(${normalized});`);
		return Boolean(fn(...vals));
	} catch (err) {
		throw new Error(
			`Failed to evaluate boolean expression: ${(err as Error).message}`,
		);
	}
}

export function execute(input: Input): string {
	const expr = input.expression;
	if (!expr || expr.trim() === "") throw new Error("expression is required");

	const vars = extractVariables(expr);

	if (input.action === "evaluate") {
		const assignments = input.values ?? {};
		const result = evaluateLogic(expr, vars, assignments);
		return JSON.stringify({
			expression: expr,
			assignments,
			result,
		});
	}

	if (vars.length === 0) {
		throw new Error("No variables found in expression");
	}
	if (vars.length > 10) {
		throw new Error(
			"Too many variables (maximum 10 variables allowed for truth table)",
		);
	}

	const numRows = 1 << vars.length;
	const tableRows: Array<{ inputs: Record<string, boolean>; output: boolean }> =
		[];

	let trueCount = 0;
	let falseCount = 0;

	const minterms: string[] = [];
	const maxterms: string[] = [];

	for (let i = 0; i < numRows; i++) {
		const assignment: Record<string, boolean> = {};
		for (let j = 0; j < vars.length; j++) {
			const varName = vars[j];
			if (!varName) continue;
			// MSB first for standard truth table ordering (0 0 0 -> 1 1 1)
			const bit = Boolean((i >> (vars.length - 1 - j)) & 1);
			assignment[varName] = bit;
		}

		const res = evaluateLogic(expr, vars, assignment);
		tableRows.push({ inputs: assignment, output: res });

		if (res) {
			trueCount++;
			// Build SDNF minterm
			const mintermParts = vars.map((v) => (assignment[v] ? v : `NOT ${v}`));
			minterms.push(`(${mintermParts.join(" AND ")})`);
		} else {
			falseCount++;
			// Build SKNF maxterm
			const maxtermParts = vars.map((v) => (assignment[v] ? `NOT ${v}` : v));
			maxterms.push(`(${maxtermParts.join(" OR ")})`);
		}
	}

	const isTautology = falseCount === 0;
	const isContradiction = trueCount === 0;
	const sdnf = minterms.length > 0 ? minterms.join(" OR ") : "FALSE";
	const sknf = maxterms.length > 0 ? maxterms.join(" AND ") : "TRUE";

	if (input.action === "canonical") {
		return JSON.stringify(
			{
				expression: expr,
				variables: vars,
				isTautology,
				isContradiction,
				SDNF_DisjunctiveNormalForm: sdnf,
				SKNF_ConjunctiveNormalForm: sknf,
			},
			null,
			2,
		);
	}

	return JSON.stringify(
		{
			expression: expr,
			variables: vars,
			rowCount: numRows,
			isTautology,
			isContradiction,
			SDNF: sdnf,
			SKNF: sknf,
			truthTable: tableRows,
		},
		null,
		2,
	);
}

export const tool: ToolDefinition = {
	name: "logic",
	description:
		"Boolean logic calculator: generate truth tables, canonical normal forms (SDNF/SKNF), tautology/contradiction checks, and expression evaluations",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
