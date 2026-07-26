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
	compileDependencies,
	complexDependencies,
	cosDependencies,
	coshDependencies,
	create,
	crossDependencies,
	derivativeDependencies,
	detDependencies,
	divideDependencies,
	dotDependencies,
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
	lusolveDependencies,
	matrixDependencies,
	maxDependencies,
	minDependencies,
	modDependencies,
	multiplyDependencies,
	normDependencies,
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
		compileDependencies,
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
		dotDependencies,
		crossDependencies,
		normDependencies,
		lusolveDependencies,
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
			"Math expression to evaluate, differentiate, simplify, integrate, or compute matrix operation",
		),
	variable: z
		.string()
		.optional()
		.describe("Variable name for derivative or integration (default: 'x')"),
	a: z.number().optional().describe("Lower limit of integration"),
	b: z.number().optional().describe("Upper limit of integration"),
	steps: z
		.number()
		.optional()
		.describe("Number of subintervals for Simpson integration (default: 1000)"),
	action: z
		.enum([
			"eval",
			"derivative",
			"simplify",
			"integrate",
			"vector",
			"solve_linear",
			"statistics",
			"det",
			"inv",
			"eigs",
		])
		.optional()
		.describe(
			"Action: eval (default), derivative, simplify, integrate, vector, solve_linear, statistics, det, inv, or eigs",
		),
	subAction: z
		.enum(["dot", "cross", "norm"])
		.optional()
		.describe("Sub-action for vector action: dot, cross, or norm"),
	vector1: z
		.array(z.number())
		.optional()
		.describe(
			"First vector for vector action or B constants vector for solve_linear",
		),
	vector2: z
		.array(z.number())
		.optional()
		.describe("Second vector for dot or cross product"),
	values: z
		.array(z.number())
		.optional()
		.describe("Array of numbers for statistics"),
	matrix: z
		.array(z.array(z.number()))
		.optional()
		.describe(
			"2D matrix for det, inv, eigs, or A coefficients for solve_linear",
		),
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

function integrateSimpson(
	expr: string,
	variable: string,
	a: number,
	b: number,
	subintervals = 1000,
): number {
	const n = subintervals % 2 === 0 ? subintervals : subintervals + 1;
	const h = (b - a) / n;
	const compiled = math.compile(expr);

	const evalAt = (x: number): number => {
		const val = compiled.evaluate({
			[variable]: math.bignumber(Number(x.toFixed(12))),
		});
		return typeof val === "number"
			? val
			: Number(math.format(val, { precision: 14 }));
	};

	let sum = evalAt(a) + evalAt(b);
	for (let i = 1; i < n; i++) {
		const x = a + i * h;
		sum += (i % 2 === 0 ? 2 : 4) * evalAt(x);
	}
	return (h / 3) * sum;
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

	if (action === "integrate") {
		if (!input.expression)
			throw new Error("expression is required for integrate");
		if (input.a === undefined || input.b === undefined)
			throw new Error(
				"a (lower bound) and b (upper bound) are required for integrate",
			);
		checkSafety(input.expression);

		const variable = input.variable ?? "x";
		const result = integrateSimpson(
			input.expression,
			variable,
			input.a,
			input.b,
			input.steps ?? 1000,
		);

		return JSON.stringify({
			expression: input.expression,
			variable,
			a: input.a,
			b: input.b,
			integral: Number(result.toFixed(6)),
		});
	}

	if (action === "vector") {
		const subAction = input.subAction ?? "dot";
		const v1 = input.vector1;
		if (!v1 || v1.length === 0)
			throw new Error("vector1 is required for vector action");

		if (subAction === "norm") {
			const normVal = math.norm(v1);
			return JSON.stringify({
				vector: v1,
				norm:
					typeof normVal === "number" ? Number(normVal.toFixed(6)) : normVal,
			});
		}

		const v2 = input.vector2;
		if (!v2 || v2.length === 0)
			throw new Error("vector2 is required for dot or cross product");

		if (subAction === "dot") {
			const dotVal = math.dot(v1, v2);
			return JSON.stringify({
				vector1: v1,
				vector2: v2,
				dotProduct:
					typeof dotVal === "number" ? Number(dotVal.toFixed(6)) : dotVal,
			});
		}

		if (subAction === "cross") {
			const crossVal = math.cross(v1, v2);
			return JSON.stringify({
				vector1: v1,
				vector2: v2,
				crossProduct: crossVal,
			});
		}
	}

	if (action === "solve_linear") {
		const m = input.matrix;
		const b = input.vector1;
		if (!m || !b)
			throw new Error(
				"matrix (A) and vector1 (B) are required for solve_linear (A * x = b)",
			);

		const solution = math.lusolve(m, b);
		const formattedSolution = (
			Array.isArray(solution)
				? solution.map((row) => (Array.isArray(row) ? row[0] : row))
				: solution
		) as number[];

		return JSON.stringify({
			system: "A * x = b",
			matrixA: m,
			vectorB: b,
			solution: formattedSolution,
		});
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
		"High precision math calculator: evaluate expressions, symbolic derivatives, numerical integration (Simpson), vector analysis (dot, cross, norm), linear equation solver (A*x=b), complex numbers, matrices (det, inv, eigs), and statistics",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
