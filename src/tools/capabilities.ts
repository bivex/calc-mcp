import { createRequire } from "node:module";
import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {};

const inputSchema = z.object(schema);

let versionString = "1.9.0";

try {
	const require = createRequire(import.meta.url);
	const pkg = require("../package.json") as { version?: string };
	if (pkg?.version) versionString = pkg.version;
} catch {
	try {
		const require = createRequire(import.meta.url);
		const pkg = require("../../package.json") as { version?: string };
		if (pkg?.version) versionString = pkg.version;
	} catch {
		// Fallback
	}
}

export function setCapabilitiesVersion(v: string) {
	versionString = v;
}

export function executeCapabilities(): string {
	return JSON.stringify(
		{
			name: "@coo-quack/calc-mcp",
			version: versionString,
			toolsCount: 35,
			capabilities: {
				batch: {
					maxRequests: 50,
					supportsDependencies: true,
					supportsParallel: true,
					variableSubstitutionSyntax: "$<index>.result or $<index>",
				},
				envelope: {
					supported: true,
					paramName: "_envelope",
					fields: ["success", "result", "error", "metadata"],
					metadataFields: [
						"execution_ms",
						"tool",
						"version",
						"request_id",
						"warnings",
					],
				},
				math: {
					engine: "mathjs",
					numberFormat: "BigNumber",
					precisionDigits: 64,
					features: [
						"arithmetic",
						"trigonometry",
						"matrices",
						"combinatorics",
						"statistics",
						"logarithms",
					],
				},
				convert: {
					categories: [
						"length",
						"weight",
						"temperature",
						"area",
						"volume",
						"speed",
						"data",
						"time",
						"pressure",
						"energy",
						"power",
						"typography",
					],
				},
				date: {
					features: [
						"diff",
						"add",
						"weekday",
						"wareki",
						"business_days",
						"iso_week",
					],
				},
			},
		},
		null,
		2,
	);
}

export const tool: ToolDefinition = {
	name: "calc_capabilities",
	description:
		"Discover server capabilities, tool counts, batch features, and supported measurement units",
	schema,
	handler: async (args: Record<string, unknown>) => {
		inputSchema.parse(args);
		return executeCapabilities();
	},
};
