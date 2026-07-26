import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	text1: z.string().describe("First text"),
	text2: z.string().describe("Second text"),
	action: z
		.enum(["diff", "distance"])
		.optional()
		.describe("diff: line diff (default), distance: Levenshtein distance"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function lcs(a: string[], b: string[]): [boolean[], boolean[]] {
	const m = a.length;
	const n = b.length;
	const w = n + 1;
	const dp = new Array<number>((m + 1) * w).fill(0);

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i * w + j] = (dp[(i - 1) * w + (j - 1)] ?? 0) + 1;
			} else {
				dp[i * w + j] = Math.max(
					dp[(i - 1) * w + j] ?? 0,
					dp[i * w + (j - 1)] ?? 0,
				);
			}
		}
	}

	const inLcsA: boolean[] = Array(m).fill(false);
	const inLcsB: boolean[] = Array(n).fill(false);
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			inLcsA[i - 1] = true;
			inLcsB[j - 1] = true;
			i--;
			j--;
		} else if ((dp[(i - 1) * w + j] ?? 0) >= (dp[i * w + (j - 1)] ?? 0)) {
			i--;
		} else {
			j--;
		}
	}
	return [inLcsA, inLcsB];
}

function lineDiff(text1: string, text2: string): string {
	const lines1 = text1.split("\n");
	const lines2 = text2.split("\n");
	const [inLcs1, inLcs2] = lcs(lines1, lines2);

	const output: string[] = [];
	let i = 0;
	let j = 0;

	while (i < lines1.length || j < lines2.length) {
		if (i < lines1.length && !inLcs1[i]) {
			output.push(`- ${lines1[i]}`);
			i++;
		} else if (j < lines2.length && !inLcs2[j]) {
			output.push(`+ ${lines2[j]}`);
			j++;
		} else {
			if (i < lines1.length) {
				output.push(`  ${lines1[i]}`);
			}
			i++;
			j++;
		}
	}

	return output.join("\n");
}

function levenshteinDistance(s: string, t: string): number {
	const m = s.length;
	const n = t.length;
	if (m === 0) return n;
	if (n === 0) return m;

	let prev = new Int32Array(n + 1);
	let curr = new Int32Array(n + 1);

	for (let j = 0; j <= n; j++) prev[j] = j;

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		const sChar = s.charCodeAt(i - 1);
		for (let j = 1; j <= n; j++) {
			const cost = sChar === t.charCodeAt(j - 1) ? 0 : 1;
			const pJ = prev[j];
			const cJPrev = curr[j - 1];
			const pJPrev = prev[j - 1];
			if (pJ !== undefined && cJPrev !== undefined && pJPrev !== undefined) {
				curr[j] = Math.min(pJ + 1, cJPrev + 1, pJPrev + cost);
			}
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}

	const res = prev[n];
	return res ?? 0;
}

export function execute(input: Input): string {
	const action = input.action ?? "diff";

	if (action === "distance") {
		const distance = levenshteinDistance(input.text1, input.text2);
		return JSON.stringify({
			distance,
			text1Length: input.text1.length,
			text2Length: input.text2.length,
		});
	}

	return lineDiff(input.text1, input.text2);
}

export const tool: ToolDefinition = {
	name: "diff",
	description: "Compare two texts: line-by-line diff or Levenshtein distance",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
