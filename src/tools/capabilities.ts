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
			toolsCount: 45,
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
				q_calculus: {
					features: [
						"q_bracket",
						"q_factorial",
						"q_binomial",
						"q_pochhammer",
						"jackson_q_derivative",
					],
				},
				digraph: {
					features: [
						"strongly_connected_components_tarjan",
						"topological_sort_kahn",
						"feedback_arc_set_FAS",
						"pagerank_vector",
					],
				},
				number_theory: {
					features: [
						"divisors_list_and_sigma_k",
						"mobius_function",
						"gauss_circle_lattice_points",
						"fractional_part_sums",
					],
				},
				sequences: {
					features: [
						"fibonacci",
						"lucas",
						"jacobsthal",
						"pell",
						"catalan",
						"stirling1_stirling2",
						"bell_numbers",
						"euler_integer_partitions_p(n)",
					],
				},
				coding_theory: {
					features: [
						"hamming_distance",
						"parity_check_matrix_H",
						"self_orthogonality_check",
						"syndrome_decoding",
					],
				},
				logic: {
					features: [
						"truth_table_generation",
						"canonical_SDNF_SKNF",
						"tautology_contradiction_check",
						"boolean_evaluation",
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
		"Discover server capabilities, tool counts, batch features, q-calculus, directed graphs, number theory, integer sequences, coding theory, boolean logic, graph topological indices, financial, geometric, and regression models",
	schema,
	handler: async (args: Record<string, unknown>) => {
		inputSchema.parse(args);
		return executeCapabilities();
	},
};
