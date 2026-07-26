import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const requestSchema = z.object({
	tool: z.string().describe("Name of the tool to execute"),
	args: z.record(z.unknown()).describe("Arguments to pass to the tool"),
});

const schema = {
	mode: z
		.enum(["sequential", "parallel"])
		.optional()
		.describe(
			"Execution mode: sequential (default, supports variable references like $0.result) or parallel",
		),
	requests: z
		.array(requestSchema)
		.min(1)
		.max(50)
		.describe("List of tool execution requests (1 to 50 requests)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

export interface BatchResultItem {
	tool: string;
	success: boolean;
	result?: unknown;
	error?: string;
	execution_ms: number;
}

let toolResolver: ((name: string) => ToolDefinition | undefined) | null = null;

export function setBatchToolResolver(
	resolver: (name: string) => ToolDefinition | undefined,
) {
	toolResolver = resolver;
}

function getByPath(obj: unknown, path: string): unknown {
	let current = obj;
	for (const key of path.split(".")) {
		if (
			current &&
			typeof current === "object" &&
			key in (current as Record<string, unknown>)
		) {
			current = (current as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return current;
}

function resolveVariables(
	argValue: unknown,
	previousResults: BatchResultItem[],
): unknown {
	if (typeof argValue === "string") {
		const match = argValue.match(/^\$(\d+)(?:\.(.+))?$/);
		if (match) {
			const index = Number.parseInt(match[1], 10);
			const path = match[2];
			const prev = previousResults[index];
			if (prev?.success) {
				if (!path) return prev.result;
				if (path === "result") {
					if (
						prev.result &&
						typeof prev.result === "object" &&
						"result" in prev.result
					) {
						return (prev.result as Record<string, unknown>).result;
					}
					return prev.result;
				}
				const resolved = getByPath(prev.result, path);
				if (resolved !== undefined) return resolved;
			}
		}
	} else if (Array.isArray(argValue)) {
		return argValue.map((item) => resolveVariables(item, previousResults));
	} else if (typeof argValue === "object" && argValue !== null) {
		const obj: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(argValue)) {
			obj[k] = resolveVariables(v, previousResults);
		}
		return obj;
	}
	return argValue;
}

async function runSingleRequest(
	reqToolName: string,
	reqArgs: Record<string, unknown>,
): Promise<BatchResultItem> {
	if (!toolResolver) {
		return {
			tool: reqToolName,
			success: false,
			error: "Tool resolver not initialized",
			execution_ms: 0,
		};
	}

	const targetTool = toolResolver(reqToolName);
	if (!targetTool) {
		return {
			tool: reqToolName,
			success: false,
			error: `Unknown tool: '${reqToolName}'`,
			execution_ms: 0,
		};
	}

	const start = performance.now();
	try {
		const rawResult = await targetTool.handler(reqArgs);
		const duration = Number((performance.now() - start).toFixed(3));

		let parsed: unknown = rawResult;
		try {
			parsed = JSON.parse(rawResult);
		} catch {
			// Keep as string if not JSON
		}

		return {
			tool: reqToolName,
			success: true,
			result: parsed,
			execution_ms: duration,
		};
	} catch (err: unknown) {
		const duration = Number((performance.now() - start).toFixed(3));
		const errorMessage = err instanceof Error ? err.message : String(err);
		return {
			tool: reqToolName,
			success: false,
			error: errorMessage,
			execution_ms: duration,
		};
	}
}

export async function executeBatch(input: Input): Promise<string> {
	const mode = input.mode ?? "sequential";

	if (mode === "parallel") {
		const promises = input.requests.map((req) =>
			runSingleRequest(req.tool, req.args),
		);
		const results = await Promise.all(promises);
		return JSON.stringify(
			{
				mode,
				count: results.length,
				results,
			},
			null,
			2,
		);
	}

	// Sequential mode with step dependency resolution
	const results: BatchResultItem[] = [];

	for (const req of input.requests) {
		const resolvedArgs = resolveVariables(req.args, results) as Record<
			string,
			unknown
		>;
		const itemResult = await runSingleRequest(req.tool, resolvedArgs);
		results.push(itemResult);
	}

	return JSON.stringify(
		{
			mode,
			count: results.length,
			results,
		},
		null,
		2,
	);
}

export const tool: ToolDefinition = {
	name: "batch",
	description:
		"Execute multiple MCP tool calls in batch (sequential with step variable referencing $0.result or parallel mode)",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return executeBatch(input);
	},
};
