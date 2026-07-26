import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/finance.js";

describe("finance tool", () => {
	test("calculates annuity loan payments", () => {
		const result = JSON.parse(
			execute({
				action: "loan",
				principal: 100000,
				rate: 10,
				years: 1,
				type: "annuity",
			}),
		);
		expect(result.monthlyPayment).toBe(8791.59);
		expect(result.totalPayment).toBe(105499.06);
	});

	test("calculates NPV", () => {
		const result = JSON.parse(
			execute({
				action: "npv",
				rate: 10,
				cashflows: [-1000, 300, 400, 500],
			}),
		);
		expect(result.npv).toBeCloseTo(-21.04, 1);
	});

	test("calculates IRR", () => {
		const result = JSON.parse(
			execute({
				action: "irr",
				cashflows: [-1000, 400, 400, 400],
			}),
		);
		expect(result.irrPercent).toBeCloseTo(9.7, 0);
	});

	test("calculates CAGR", () => {
		const result = JSON.parse(
			execute({
				action: "cagr",
				startValue: 100,
				endValue: 200,
				years: 5,
			}),
		);
		expect(result.cagrPercent).toBeCloseTo(14.87, 1);
	});

	test("calculates compound interest", () => {
		const result = JSON.parse(
			execute({
				action: "compound_interest",
				principal: 1000,
				rate: 5,
				years: 10,
				compoundingFrequency: "monthly",
			}),
		);
		expect(result.futureValue).toBe(1647.01);
	});
});
