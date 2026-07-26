import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const requestSchema = z.object({
	tool: z.string().describe("Name of the tool to execute"),
	args: z.record(z.unknown()).describe("Arguments to pass to the tool"),
});

const schema = {
	requests: z
		.array(requestSchema)
		.min(1)
		.max(50)
		.describe("List of tool execution requests (1 to 50 requests)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

export interface BatchRequestItem {
	tool: string;
	args: Record<string, unknown>;
}

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

export async function executeBatch(input: Input): Promise<string> {
	if (!toolResolver) {
		throw new Error("Tool resolver not initialized for batch execution");
	}

	const results: BatchResultItem[] = [];

	for (const req of input.requests) {
		const targetTool = toolResolver(req.tool);
		if (!targetTool) {
			results.push({
				tool: req.tool,
				success: false,
				error: `Unknown tool: '${req.tool}'`,
				execution_ms: 0,
			});
			continue;
		}

		const start = performance.now();
		try {
			const rawResult = await targetTool.handler(req.args);
			const duration = Number((performance.now() - start).toFixed(3));

			let parsed: unknown = rawResult;
			try {
				parsed = JSON.parse(rawResult);
			} catch {
				// Keep as string if not JSON
			}

			results.push({
				tool: req.tool,
				success: true,
				result: parsed,
				execution_ms: duration,
			});
		} catch (err: unknown) {
			const duration = Number((performance.now() - start).toFixed(3));
			const errorMessage = err instanceof Error ? err.message : String(err);
			results.push({
				tool: req.tool,
				success: false,
				error: errorMessage,
				execution_ms: duration,
			});
		}
	}

	return JSON.stringify(
		{
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
		"Execute multiple MCP tool calls in a single batch request to reduce round-trips",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return executeBatch(input);
	},
};
