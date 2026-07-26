/**
 * Copyright (c) 2026 Bivex
 *
 * Author: Bivex
 * Available for contact via email: support@b-b.top
 * For up-to-date contact information:
 * https://github.com/bivex
 *
 * Created: 2026-03-02 19:12
 * Last Updated: 2026-03-02 19:12
 *
 * Licensed under the MIT License.
 * Commercial licensing available upon request.
 */

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";

import { tool as asmArm64Tool } from "./tools/asm_arm64.js";
import { tool as asmBitwiseTool } from "./tools/asm_bitwise.js";
import { tool as asmEncodingTool } from "./tools/asm_encoding.js";
import { tool as asmFlagsTool } from "./tools/asm_flags.js";
import { tool as asmFloatTool } from "./tools/asm_float.js";
import { tool as asmGasTool } from "./tools/asm_gas.js";
import { tool as asmMachoTool } from "./tools/asm_macho.js";
import { tool as asmMemoryTool } from "./tools/asm_memory.js";
import { tool as asmNumbersTool } from "./tools/asm_numbers.js";
import { tool as asmRegistersTool } from "./tools/asm_registers.js";
import { tool as asmStackTool } from "./tools/asm_stack.js";
import { tool as asmStructTool } from "./tools/asm_struct.js";
import { tool as baseTool } from "./tools/base.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

import { sanitizeErrorMessage } from "./sanitization.js";
import { tool as base64Tool } from "./tools/base64.js";
import { tool as batchTool, setBatchToolResolver } from "./tools/batch.js";
import { tool as capabilitiesTool } from "./tools/capabilities.js";
import { tool as charInfoTool } from "./tools/char_info.js";
import { tool as colorTool } from "./tools/color.js";
import { tool as convertTool } from "./tools/convert.js";
import { tool as countTool } from "./tools/count.js";
import { tool as cronParseTool } from "./tools/cron_parse.js";
import { tool as dateTool } from "./tools/date.js";
import { tool as datetimeTool } from "./tools/datetime.js";
import { tool as diffTool } from "./tools/diff.js";
import { tool as encodeTool } from "./tools/encode.js";
import { tool as hashTool } from "./tools/hash.js";
import { tool as ipTool } from "./tools/ip.js";
import { tool as jsonValidateTool } from "./tools/json_validate.js";
import { tool as jwtDecodeTool } from "./tools/jwt_decode.js";
import { tool as luhnTool } from "./tools/luhn.js";
import { tool as mathTool } from "./tools/math.js";
import { tool as randomTool } from "./tools/random.js";
import { tool as regexTool } from "./tools/regex.js";
import { tool as semverTool } from "./tools/semver.js";
import { tool as urlParseTool } from "./tools/url_parse.js";

export interface ToolDefinition {
	name: string;
	description: string;
	schema: z.ZodRawShape;
	handler: (args: Record<string, unknown>) => Promise<string>;
}

const tools: ToolDefinition[] = [
	capabilitiesTool,
	batchTool,
	randomTool,
	hashTool,
	base64Tool,
	encodeTool,
	datetimeTool,
	countTool,
	mathTool,
	dateTool,
	regexTool,
	baseTool,
	diffTool,
	jsonValidateTool,
	cronParseTool,
	luhnTool,
	ipTool,
	colorTool,
	convertTool,
	charInfoTool,
	jwtDecodeTool,
	urlParseTool,
	semverTool,
	asmBitwiseTool,
	asmMemoryTool,
	asmFlagsTool,
	asmEncodingTool,
	asmRegistersTool,
	asmNumbersTool,
	asmStructTool,
	asmFloatTool,
	asmStackTool,
	asmGasTool,
	asmMachoTool,
	asmArm64Tool,
];

const toolsMap = new Map<string, ToolDefinition>(tools.map((t) => [t.name, t]));

setBatchToolResolver((name) => toolsMap.get(name));

const server = new McpServer({
	name: "calc-mcp",
	version,
});

for (const tool of tools) {
	server.tool(
		tool.name,
		tool.description,
		tool.schema,
		async (args: Record<string, unknown>) => {
			const start = performance.now();
			const useEnvelope = args._envelope === true;
			const requestId = randomUUID();

			try {
				const rawResult = await tool.handler(args);
				const duration = Number((performance.now() - start).toFixed(3));

				if (useEnvelope) {
					let parsed: unknown = rawResult;
					try {
						parsed = JSON.parse(rawResult);
					} catch {
						// Keep string
					}
					const envelope = {
						success: true,
						result: parsed,
						metadata: {
							execution_ms: duration,
							tool: tool.name,
							version,
							request_id: requestId,
							cached: false,
							warnings: [],
						},
					};
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify(envelope, null, 2),
							},
						],
					};
				}

				return {
					content: [{ type: "text" as const, text: rawResult }],
				};
			} catch (error) {
				const duration = Number((performance.now() - start).toFixed(3));
				const message = sanitizeErrorMessage(tool.name, error, args);

				if (useEnvelope) {
					const envelope = {
						success: false,
						error: message,
						metadata: {
							execution_ms: duration,
							tool: tool.name,
							version,
							request_id: requestId,
							cached: false,
							warnings: [],
						},
					};
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify(envelope, null, 2),
							},
						],
						isError: true,
					};
				}

				return {
					content: [{ type: "text" as const, text: `Error: ${message}` }],
					isError: true,
				};
			}
		},
	);
}

async function main() {
	if (process.argv.includes("--version") || process.argv.includes("-v")) {
		console.log(version);
		process.exit(0);
	}
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
