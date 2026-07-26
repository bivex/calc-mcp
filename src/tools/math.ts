import {
	absDependencies,
	acosDependencies,
	acoshDependencies,
	addDependencies,
	asinDependencies,
	asinhDependencies,
	atan2Dependencies,
	atanDependencies,
	atanhDependencies,
	type BigNumber,
	bignumberDependencies,
	cbrtDependencies,
	ceilDependencies,
	combinationsDependencies,
	complexDependencies,
	cosDependencies,
	coshDependencies,
	create,
	derivativeDependencies,
	detDependencies,
	divideDependencies,
	eDependencies,
	eigsDependencies,
	equalDependencies,
	erfDependencies,
	evaluateDependencies,
	expDependencies,
	factorialDependencies,
	fixDependencies,
	floorDependencies,
	formatDependencies,
	gammaDependencies,
	gcdDependencies,
	invDependencies,
	largerDependencies,
	lcmDependencies,
	log2Dependencies,
	log10Dependencies,
	logDependencies,
	matrixDependencies,
	maxDependencies,
	minDependencies,
	modDependencies,
	multiplyDependencies,
	nthRootDependencies,
	permutationsDependencies,
	piDependencies,
	powDependencies,
	roundDependencies,
	signDependencies,
	simplifyDependencies,
	sinDependencies,
	sinhDependencies,
	smallerDependencies,
	sqrtDependencies,
	subtractDependencies,
	sumDependencies,
	tanDependencies,
	tanhDependencies,
} from "mathjs";
import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { assertExists } from "../utils.js";

// Create mathjs instance with selective dependency imports
const math = create(
	{
		evaluateDependencies,
		bignumberDependencies,
		formatDependencies,
		derivativeDependencies,
		simplifyDependencies,
		detDependencies,
		invDependencies,
		eigsDependencies,
		complexDependencies,
		gammaDependencies,
		erfDependencies,
		absDependencies,
		addDependencies,
		cbrtDependencies,
		ceilDependencies,
		divideDependencies,
		fixDependencies,
		floorDependencies,
		modDependencies,
		multiplyDependencies,
		powDependencies,
		roundDependencies,
		signDependencies,
		sqrtDependencies,
		subtractDependencies,
		acosDependencies,
		acoshDependencies,
		asinDependencies,
		asinhDependencies,
		atanDependencies,
		atan2Dependencies,
		atanhDependencies,
		cosDependencies,
		coshDependencies,
		sinDependencies,
		sinhDependencies,
		tanDependencies,
		tanhDependencies,
		expDependencies,
		log10Dependencies,
		log2Dependencies,
		logDependencies,
		combinationsDependencies,
		factorialDependencies,
		permutationsDependencies,
		equalDependencies,
		largerDependencies,
		maxDependencies,
		minDependencies,
		smallerDependencies,
		sumDependencies,
		gcdDependencies,
		lcmDependencies,
		nthRootDependencies,
		eDependencies,
		piDependencies,
		matrixDependencies,
	},
	{
		number: "BigNumber",
		precision: 64,
	},
);

const DANGEROUS_PATTERNS = [
	/\bimport\b/,
	/\bcreateUnit\b/,
	/\beval\b/,
	/\bFunction\b/,
];

const schema = {
	expression: z
		.string()
		.optional()
		.describe(
			"Math expression to evaluate, differentiate, simplify, or compute matrix operation",
		),
	variable: z
		.string()
		.optional()
		.describe("Variable name for symbolic derivative (default: 'x')"),
	action: z
		.enum([
			"eval",
			"derivative",
			"simplify",
			"statistics",
			"det",
			"inv",
			"eigs",
		])
		.optional()
		.describe(
			"Action: eval (default), derivative, simplify, statistics, det, inv, or eigs",
		),
	values: z
		.array(z.number())
		.optional()
		.describe("Array of numbers for statistics"),
	matrix: z
		.array(z.array(z.number()))
		.optional()
		.describe("2D matrix for det, inv, or eigs actions"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function computeStatistics(values: number[]): string {
	if (values.length === 0) throw new Error("values array is empty");

	const bn = values.map((v) => math.bignumber(v));
	const sorted = [...bn].sort((a, b) => a.comparedTo(b));
	const sum = sorted.reduce<BigNumber>(
		(a, b) => math.add(a, b) as BigNumber,
		math.bignumber(0),
	);
	const mean = math.divide(sum, values.length) as BigNumber;
	const variance = math.divide(
		bn.reduce<BigNumber>(
			(acc, v) =>
				math.add(acc, math.pow(math.subtract(v, mean), 2)) as BigNumber,
			math.bignumber(0),
		),
		values.length,
	) as BigNumber;
	const stddev = math.sqrt(variance);

	const mid = Math.floor(sorted.length / 2);
	const sortedMid = sorted[mid];
	const sortedMidPrev = sorted[mid - 1];
	const median =
		sorted.length % 2 === 0 && sortedMidPrev && sortedMid
			? (math.divide(math.add(sortedMidPrev, sortedMid), 2) as BigNumber)
			: sortedMid;

	const fmt = (v: unknown) => Number(math.format(v, { precision: 14 }));

	const firstValue = assertExists(sorted[0], "statistics calculation");
	const lastValue = assertExists(
		sorted[sorted.length - 1],
		"statistics calculation",
	);

	return JSON.stringify(
		{
			count: values.length,
			sum: fmt(sum),
			mean: fmt(mean),
			median: fmt(median),
			min: fmt(firstValue),
			max: fmt(lastValue),
			variance: fmt(variance),
			stddev: fmt(stddev),
		},
		null,
		2,
	);
}

function checkSafety(expr: string) {
	for (const pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(expr)) {
			throw new Error(`Unsafe expression detected: ${pattern.source}`);
		}
	}
}

export function execute(input: Input): string {
	const action = input.action ?? "eval";

	if (action === "statistics") {
		if (!input.values) throw new Error("values is required for statistics");
		return computeStatistics(input.values);
	}

	if (action === "derivative") {
		if (!input.expression)
			throw new Error("expression is required for derivative");
		checkSafety(input.expression);
		const variable = input.variable ?? "x";
		const der = math.derivative(input.expression, variable);
		return der.toString();
	}

	if (action === "simplify") {
		if (!input.expression)
			throw new Error("expression is required for simplify");
		checkSafety(input.expression);
		const simp = math.simplify(input.expression);
		return simp.toString();
	}

	if (action === "det") {
		const m =
			input.matrix ??
			(input.expression ? math.evaluate(input.expression) : null);
		if (!m) throw new Error("matrix array or expression is required for det");
		const determinant = math.det(m);
		return typeof determinant === "number" || typeof determinant === "object"
			? math.format(determinant, { precision: 14 })
			: String(determinant);
	}

	if (action === "inv") {
		const m =
			input.matrix ??
			(input.expression ? math.evaluate(input.expression) : null);
		if (!m) throw new Error("matrix array or expression is required for inv");
		const inverse = math.inv(m);
		return JSON.stringify(inverse, null, 2);
	}

	if (action === "eigs") {
		const m =
			input.matrix ??
			(input.expression ? math.evaluate(input.expression) : null);
		if (!m) throw new Error("matrix array or expression is required for eigs");
		const eigen = math.eigs(m);
		return JSON.stringify(eigen, null, 2);
	}

	// eval
	if (!input.expression) throw new Error("expression is required for eval");
	checkSafety(input.expression);

	const result = math.evaluate(input.expression);
	if (result?.isInteger?.()) {
		return result.toFixed(0);
	}
	return math.format(result, { precision: 14 });
}

export const tool: ToolDefinition = {
	name: "math",
	description:
		"High precision math calculator: evaluate expressions, symbolic derivatives, simplification, complex numbers, matrices (det, inv, eigs), and statistics",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
