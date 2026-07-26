import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const pointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const schema = {
	action: z
		.enum(["linear"])
		.optional()
		.describe("Regression type (default: linear)"),
	points: z
		.array(pointSchema)
		.optional()
		.describe("Array of points [{x, y}] (e.g. [{x: 1, y: 2}, {x: 2, y: 4}])"),
	xValues: z
		.array(z.number())
		.optional()
		.describe("Array of X values (alternative to points)"),
	yValues: z
		.array(z.number())
		.optional()
		.describe("Array of Y values (alternative to points)"),
	predictX: z.number().optional().describe("Optional X value to predict Y for"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

export function executeLinearRegression(input: Input): string {
	let x: number[] = [];
	let y: number[] = [];

	if (input.points && input.points.length > 0) {
		x = input.points.map((p) => p.x);
		y = input.points.map((p) => p.y);
	} else if (input.xValues && input.yValues) {
		if (input.xValues.length !== input.yValues.length) {
			throw new Error("xValues and yValues must have the same length");
		}
		x = input.xValues;
		y = input.yValues;
	} else {
		throw new Error("points array or xValues and yValues arrays are required");
	}

	const n = x.length;
	if (n < 2)
		throw new Error("At least 2 points are required for linear regression");

	const meanX = x.reduce((a, b) => a + b, 0) / n;
	const meanY = y.reduce((a, b) => a + b, 0) / n;

	let sxx = 0;
	let syy = 0;
	let sxy = 0;

	for (let i = 0; i < n; i++) {
		const xi = x[i];
		const yi = y[i];
		if (xi === undefined || yi === undefined) continue;

		const dx = xi - meanX;
		const dy = yi - meanY;
		sxx += dx * dx;
		syy += dy * dy;
		sxy += dx * dy;
	}

	if (sxx === 0) {
		throw new Error("X values must not all be identical (vertical line)");
	}

	const slope = sxy / sxx;
	const intercept = meanY - slope * meanX;

	const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
	const r2 = r * r;

	let predictedY: number | undefined;
	if (input.predictX !== undefined) {
		predictedY = slope * input.predictX + intercept;
	}

	return JSON.stringify(
		{
			equation: `y = ${slope.toFixed(4)} * x + ${intercept >= 0 ? "+" : ""}${intercept.toFixed(4)}`,
			slope: Number(slope.toFixed(6)),
			intercept: Number(intercept.toFixed(6)),
			pearsonR: Number(r.toFixed(6)),
			rSquared: Number(r2.toFixed(6)),
			sampleSize: n,
			...(input.predictX !== undefined && {
				prediction: {
					x: input.predictX,
					predictedY: Number(predictedY?.toFixed(6)),
				},
			}),
		},
		null,
		2,
	);
}

export const tool: ToolDefinition = {
	name: "regression",
	description:
		"Linear regression analysis: calculate slope, intercept, Pearson r, R^2, and predict Y for given X",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return executeLinearRegression(input);
	},
};
