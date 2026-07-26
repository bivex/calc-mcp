import { describe, expect, test } from "bun:test";
import type { ToolDefinition } from "../../src/index.js";
import { executeBatch, setBatchToolResolver } from "../../src/tools/batch.js";
import { execute as executeConvert } from "../../src/tools/convert.js";
import { execute as executeMath } from "../../src/tools/math.js";

const dummyMathTool: ToolDefinition = {
	name: "math",
	description: "Math tool",
	schema: {},
	handler: async (args) => executeMath({ expression: String(args.expression) }),
};

const dummyConvertTool: ToolDefinition = {
	name: "convert",
	description: "Convert tool",
	schema: {},
	handler: async (args) =>
		executeConvert({
			value: Number(args.value),
			from: String(args.from),
			to: String(args.to),
		}),
};

setBatchToolResolver((name) => {
	if (name === "math") return dummyMathTool;
	if (name === "convert") return dummyConvertTool;
	return undefined;
});

describe("batch tool", () => {
	test("executes multiple tool requests in batch", async () => {
		const responseStr = await executeBatch({
			requests: [
				{ tool: "math", args: { expression: "100 * 2.5" } },
				{ tool: "convert", args: { value: 10, from: "km", to: "m" } },
			],
		});

		const res = JSON.parse(responseStr);
		expect(res.count).toBe(2);
		expect(res.results[0].success).toBe(true);
		expect(res.results[0].tool).toBe("math");
		expect(res.results[0].result).toBe(250);
		expect(typeof res.results[0].execution_ms).toBe("number");

		expect(res.results[1].success).toBe(true);
		expect(res.results[1].tool).toBe("convert");
		expect(res.results[1].result.result).toBe(10000);
	});

	test("supports step variable referencing ($0.result)", async () => {
		const responseStr = await executeBatch({
			mode: "sequential",
			requests: [
				{ tool: "math", args: { expression: "50 * 2" } },
				{ tool: "convert", args: { value: "$0.result", from: "km", to: "m" } },
			],
		});

		const res = JSON.parse(responseStr);
		expect(res.count).toBe(2);
		expect(res.results[0].result).toBe(100);
		expect(res.results[1].result.result).toBe(100000);
	});

	test("supports parallel execution mode", async () => {
		const responseStr = await executeBatch({
			mode: "parallel",
			requests: [
				{ tool: "math", args: { expression: "1 + 1" } },
				{ tool: "math", args: { expression: "2 + 2" } },
			],
		});

		const res = JSON.parse(responseStr);
		expect(res.mode).toBe("parallel");
		expect(res.count).toBe(2);
		expect(res.results[0].result).toBe(2);
		expect(res.results[1].result).toBe(4);
	});

	test("handles errors in individual batch requests gracefully", async () => {
		const responseStr = await executeBatch({
			requests: [
				{ tool: "unknown_tool", args: {} },
				{ tool: "math", args: { expression: "invalid + expression" } },
			],
		});

		const res = JSON.parse(responseStr);
		expect(res.count).toBe(2);
		expect(res.results[0].success).toBe(false);
		expect(res.results[0].error).toContain("Unknown tool");
		expect(res.results[1].success).toBe(false);
	});
});
