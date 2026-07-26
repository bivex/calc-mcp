import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["loan", "npv", "irr", "cagr", "compound_interest"])
		.describe(
			"Financial calculation action: loan, npv, irr, cagr, or compound_interest",
		),
	principal: z.number().optional().describe("Initial principal/loan amount"),
	rate: z
		.number()
		.optional()
		.describe("Annual interest rate (e.g. 0.05 for 5% or 5 for 5%)"),
	years: z.number().optional().describe("Term in years"),
	months: z
		.number()
		.optional()
		.describe("Term in months (alternative to years)"),
	type: z
		.enum(["annuity", "differentiated"])
		.optional()
		.describe("Loan payment type: annuity (default) or differentiated"),
	cashflows: z
		.array(z.number())
		.optional()
		.describe(
			"Array of cashflows for NPV or IRR (e.g. [-1000, 300, 400, 500])",
		),
	startValue: z
		.number()
		.optional()
		.describe("Start value for CAGR calculation"),
	endValue: z.number().optional().describe("End value for CAGR calculation"),
	compoundingFrequency: z
		.enum(["annually", "semi-annually", "quarterly", "monthly", "daily"])
		.optional()
		.describe("Compounding frequency for compound_interest (default: monthly)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function normalizeRate(rate: number): number {
	return rate > 1 ? rate / 100 : rate;
}

function calculateLoan(input: Input): string {
	const principal = input.principal;
	if (principal === undefined || principal <= 0)
		throw new Error("principal is required and must be positive");
	if (input.rate === undefined) throw new Error("rate is required for loan");

	const annualRate = normalizeRate(input.rate);
	const totalMonths =
		input.months ??
		(input.years !== undefined ? Math.round(input.years * 12) : 0);
	if (totalMonths <= 0)
		throw new Error("years or months term is required for loan");

	const monthlyRate = annualRate / 12;
	const type = input.type ?? "annuity";

	if (type === "annuity") {
		const monthlyPayment =
			monthlyRate === 0
				? principal / totalMonths
				: (principal * (monthlyRate * (1 + monthlyRate) ** totalMonths)) /
					((1 + monthlyRate) ** totalMonths - 1);
		const totalPayment = monthlyPayment * totalMonths;
		const totalInterest = totalPayment - principal;

		return JSON.stringify(
			{
				type: "annuity",
				principal,
				annualRatePercent: annualRate * 100,
				totalMonths,
				monthlyPayment: Number(monthlyPayment.toFixed(2)),
				totalPayment: Number(totalPayment.toFixed(2)),
				totalInterest: Number(totalInterest.toFixed(2)),
			},
			null,
			2,
		);
	}

	// Differentiated
	const principalPayment = principal / totalMonths;
	let remainingPrincipal = principal;
	let totalInterest = 0;
	const firstPayment = principalPayment + remainingPrincipal * monthlyRate;

	for (let i = 0; i < totalMonths; i++) {
		const interestPayment = remainingPrincipal * monthlyRate;
		totalInterest += interestPayment;
		remainingPrincipal -= principalPayment;
	}

	const lastPayment =
		principalPayment + (principal / totalMonths) * monthlyRate;
	const totalPayment = principal + totalInterest;

	return JSON.stringify(
		{
			type: "differentiated",
			principal,
			annualRatePercent: annualRate * 100,
			totalMonths,
			firstMonthlyPayment: Number(firstPayment.toFixed(2)),
			lastMonthlyPayment: Number(lastPayment.toFixed(2)),
			totalPayment: Number(totalPayment.toFixed(2)),
			totalInterest: Number(totalInterest.toFixed(2)),
		},
		null,
		2,
	);
}

function calculateNPV(cashflows: number[], discountRate: number): number {
	const r = normalizeRate(discountRate);
	return cashflows.reduce((acc, cf, t) => acc + cf / (1 + r) ** t, 0);
}

function calculateIRR(cashflows: number[]): number {
	if (cashflows.length < 2)
		throw new Error("At least 2 cashflows required for IRR");
	let min = -0.9999;
	let max = 10.0;
	let rate = 0.1;

	for (let i = 0; i < 100; i++) {
		const npv = calculateNPV(cashflows, rate);
		if (Math.abs(npv) < 1e-6) return rate;

		if (npv > 0) {
			min = rate;
		} else {
			max = rate;
		}
		rate = (min + max) / 2;
	}
	return rate;
}

function calculateCAGR(
	startValue: number,
	endValue: number,
	years: number,
): number {
	if (startValue <= 0 || endValue <= 0 || years <= 0) {
		throw new Error(
			"startValue, endValue, and years must be positive for CAGR",
		);
	}
	return (endValue / startValue) ** (1 / years) - 1;
}

function calculateCompoundInterest(input: Input): string {
	const principal = input.principal;
	if (principal === undefined || principal <= 0)
		throw new Error("principal is required and must be positive");
	if (input.rate === undefined) throw new Error("rate is required");
	const years = input.years ?? (input.months ? input.months / 12 : 0);
	if (years <= 0) throw new Error("years or months is required");

	const r = normalizeRate(input.rate);
	const freqMap: Record<string, number> = {
		annually: 1,
		"semi-annually": 2,
		quarterly: 4,
		monthly: 12,
		daily: 365,
	};
	const n = freqMap[input.compoundingFrequency ?? "monthly"] ?? 12;

	const futureValue = principal * (1 + r / n) ** (n * years);
	const totalInterest = futureValue - principal;

	return JSON.stringify(
		{
			principal,
			annualRatePercent: r * 100,
			years,
			compoundingFrequency: input.compoundingFrequency ?? "monthly",
			futureValue: Number(futureValue.toFixed(2)),
			totalInterest: Number(totalInterest.toFixed(2)),
		},
		null,
		2,
	);
}

export function execute(input: Input): string {
	switch (input.action) {
		case "loan":
			return calculateLoan(input);
		case "npv": {
			if (!input.cashflows)
				throw new Error("cashflows array is required for NPV");
			if (input.rate === undefined) throw new Error("rate is required for NPV");
			const npvVal = calculateNPV(input.cashflows, input.rate);
			return JSON.stringify({
				discountRatePercent: normalizeRate(input.rate) * 100,
				cashflows: input.cashflows,
				npv: Number(npvVal.toFixed(2)),
			});
		}
		case "irr": {
			if (!input.cashflows)
				throw new Error("cashflows array is required for IRR");
			const irrVal = calculateIRR(input.cashflows);
			return JSON.stringify({
				cashflows: input.cashflows,
				irrPercent: Number((irrVal * 100).toFixed(4)),
				irrDecimal: Number(irrVal.toFixed(6)),
			});
		}
		case "cagr": {
			if (input.startValue === undefined || input.endValue === undefined)
				throw new Error("startValue and endValue are required for CAGR");
			const years = input.years ?? (input.months ? input.months / 12 : 0);
			if (years <= 0) throw new Error("years is required for CAGR");
			const cagrVal = calculateCAGR(input.startValue, input.endValue, years);
			return JSON.stringify({
				startValue: input.startValue,
				endValue: input.endValue,
				years,
				cagrPercent: Number((cagrVal * 100).toFixed(4)),
			});
		}
		case "compound_interest":
			return calculateCompoundInterest(input);
	}
}

export const tool: ToolDefinition = {
	name: "finance",
	description:
		"Financial calculations: loan payments (annuity/differentiated), NPV, IRR, CAGR, and compound interest",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
