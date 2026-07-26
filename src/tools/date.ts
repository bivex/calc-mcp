import {
	addDays,
	addHours,
	addMinutes,
	addMonths,
	addYears,
	differenceInDays,
	differenceInHours,
	differenceInMinutes,
	differenceInMonths,
	differenceInYears,
	format,
	getISOWeek,
	getISOWeekYear,
	parseISO,
} from "date-fns";
import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["diff", "add", "weekday", "wareki", "business_days", "iso_week"])
		.describe(
			"diff: difference between dates, add: add to date, weekday, wareki, business_days: count or add business days (excl. weekends), iso_week: ISO week number and year",
		),
	date: z.string().describe("Date string (ISO8601)"),
	date2: z
		.string()
		.optional()
		.describe("Second date for diff or business_days count"),
	amount: z.number().optional().describe("Amount to add"),
	unit: z
		.enum(["days", "months", "years", "hours", "minutes"])
		.optional()
		.describe("Unit for add"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

const WEEKDAYS_JA = [
	"日曜日",
	"月曜日",
	"火曜日",
	"水曜日",
	"木曜日",
	"金曜日",
	"土曜日",
];

interface WarekiEra {
	name: string;
	startYear: number;
	startDate: Date;
}

const ERAS: WarekiEra[] = [
	{ name: "令和", startYear: 2019, startDate: new Date(2019, 4, 1) },
	{ name: "平成", startYear: 1989, startDate: new Date(1989, 0, 8) },
	{ name: "昭和", startYear: 1926, startDate: new Date(1926, 11, 25) },
	{ name: "大正", startYear: 1912, startDate: new Date(1912, 6, 30) },
	{ name: "明治", startYear: 1868, startDate: new Date(1868, 0, 25) },
];

function toWareki(date: Date): string {
	for (const era of ERAS) {
		if (date >= era.startDate) {
			const year = date.getFullYear() - era.startYear + 1;
			const yearStr = year === 1 ? "元" : String(year);
			return `${era.name}${yearStr}年${date.getMonth() + 1}月${date.getDate()}日`;
		}
	}
	throw new Error("Date is before Meiji era");
}

function isWeekend(d: Date): boolean {
	const day = d.getDay();
	return day === 0 || day === 6;
}

function countBusinessDays(start: Date, end: Date): number {
	let count = 0;
	const current = new Date(start);
	const step = start <= end ? 1 : -1;

	while (step > 0 ? current < end : current > end) {
		if (!isWeekend(current)) {
			count += step;
		}
		current.setDate(current.getDate() + step);
	}
	return count;
}

function addBusinessDays(start: Date, amount: number): Date {
	const current = new Date(start);
	let added = 0;
	const step = amount >= 0 ? 1 : -1;
	const target = Math.abs(amount);

	while (added < target) {
		current.setDate(current.getDate() + step);
		if (!isWeekend(current)) {
			added++;
		}
	}
	return current;
}

export function execute(input: Input): string {
	const d1 = parseISO(input.date);
	if (Number.isNaN(d1.getTime()))
		throw new Error(`Invalid date: ${input.date}`);

	switch (input.action) {
		case "diff": {
			if (!input.date2) throw new Error("date2 is required for diff");
			const d2 = parseISO(input.date2);
			if (Number.isNaN(d2.getTime()))
				throw new Error(`Invalid date2: ${input.date2}`);
			return JSON.stringify(
				{
					years: differenceInYears(d2, d1),
					months: differenceInMonths(d2, d1),
					days: differenceInDays(d2, d1),
					hours: differenceInHours(d2, d1),
					minutes: differenceInMinutes(d2, d1),
				},
				null,
				2,
			);
		}
		case "add": {
			if (input.amount === undefined)
				throw new Error("amount is required for add");
			const unit = input.unit ?? "days";
			let result: Date;
			switch (unit) {
				case "days":
					result = addDays(d1, input.amount);
					break;
				case "months":
					result = addMonths(d1, input.amount);
					break;
				case "years":
					result = addYears(d1, input.amount);
					break;
				case "hours":
					result = addHours(d1, input.amount);
					break;
				case "minutes":
					result = addMinutes(d1, input.amount);
					break;
			}
			return format(result, "yyyy-MM-dd'T'HH:mm:ss");
		}
		case "weekday": {
			const dayIndex = d1.getDay();
			return JSON.stringify({
				weekday: format(d1, "EEEE"),
				weekdayJa: WEEKDAYS_JA[dayIndex],
				dayOfWeek: dayIndex,
			});
		}
		case "wareki": {
			return toWareki(d1);
		}
		case "business_days": {
			if (input.date2) {
				const d2 = parseISO(input.date2);
				if (Number.isNaN(d2.getTime()))
					throw new Error(`Invalid date2: ${input.date2}`);
				return JSON.stringify({
					startDate: format(d1, "yyyy-MM-dd"),
					endDate: format(d2, "yyyy-MM-dd"),
					businessDays: countBusinessDays(d1, d2),
				});
			}
			if (input.amount !== undefined) {
				const resDate = addBusinessDays(d1, input.amount);
				return JSON.stringify({
					startDate: format(d1, "yyyy-MM-dd"),
					addedBusinessDays: input.amount,
					resultDate: format(resDate, "yyyy-MM-dd"),
				});
			}
			throw new Error("date2 or amount is required for business_days");
		}
		case "iso_week": {
			const week = getISOWeek(d1);
			const year = getISOWeekYear(d1);
			const weekFormatted = String(week).padStart(2, "0");
			return JSON.stringify({
				date: format(d1, "yyyy-MM-dd"),
				isoWeek: week,
				isoWeekYear: year,
				formatted: `${year}-W${weekFormatted}`,
			});
		}
	}
}

export const tool: ToolDefinition = {
	name: "date",
	description:
		"Date calculations: diff between dates, add to date, weekday, Japanese wareki conversion, business days calculation, and ISO week format",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
