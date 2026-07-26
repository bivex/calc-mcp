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
			toolsCount: 39,
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
				graph: {
					features: [
						"13_topological_indices",
						"diminished_sombor_DSO",
						"sombor_SO",
						"zagreb_M1_M2_HM",
						"randic_R",
						"geometric_arithmetic_GA",
						"albertson_Alb",
						"irregularity_sigma_irrt",
						"harmonic_H",
						"inverse_sum_ISI",
						"forgotten_F",
						"paper_sharp_bounds_comparison",
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
						"symbolic_derivatives",
						"expression_simplification",
						"numerical_integration_simpson",
						"vector_analysis",
						"linear_equation_solver",
						"matrix_det_inv_eigs",
						"combinatorics",
						"statistics",
					],
				},
				finance: {
					features: [
						"loan_payments_annuity_differentiated",
						"npv",
						"irr",
						"cagr",
						"compound_interest",
					],
				},
				geometry: {
					features: [
						"haversine_gps_distance",
						"polygon_area_perimeter_shoelace",
						"shape_3d_volume_surface_area",
					],
				},
				regression: {
					features: [
						"linear_regression",
						"slope_intercept",
						"pearson_r",
						"r_squared",
						"predict_y",
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
		"Discover server capabilities, tool counts, batch features, graph topological indices, financial, geometric, and regression models",
	schema,
	handler: async (args: Record<string, unknown>) => {
		inputSchema.parse(args);
		return executeCapabilities();
	},
};
