import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum([
			"parse_masm_number",
			"format_masm",
			"format_hex",
			"format_bin",
			"format_dec",
			"format_oct",
		])
		.describe(
			"Action: parse_masm_number | format_masm | format_hex | format_bin | format_dec | format_oct",
		),
	value: z
		.union([z.string(), z.number()])
		.describe(
			"Input value. For parse_masm_number: MASM literal (0FFh, 1010b, 123d, 777o, 0x1F). For format_*: decimal or 0x/0b prefixed number.",
		),
	bits: z
		.number()
		.refine((v) => [8, 16, 32, 64].includes(v), {
			message: "bits must be 8, 16, 32, or 64",
		})
		.optional()
		.describe(
			"Bit width for output formatting (8, 16, 32, or 64). Optional — affects padding.",
		),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

/** Parse a MASM number literal to BigInt */
function parseMasmLiteral(s: string): { value: bigint; detectedBase: string } {
	const t = s.trim();
	const lower = t.toLowerCase();

	// C-style prefixes (also accepted in MASM modern mode)
	if (lower.startsWith("0x"))
		return { value: BigInt(`0x${lower.slice(2)}`), detectedBase: "hex" };
	if (lower.startsWith("0b"))
		return { value: BigInt(`0b${lower.slice(2)}`), detectedBase: "binary" };

	// MASM-style suffixes
	if (lower.endsWith("h")) {
		const digits = lower.slice(0, -1);
		if (!/^[0-9a-f]+$/.test(digits))
			throw new Error(`Invalid hex digits: ${digits}`);
		return { value: BigInt(`0x${digits}`), detectedBase: "hex" };
	}
	if (lower.endsWith("b")) {
		const digits = lower.slice(0, -1);
		if (!/^[01]+$/.test(digits))
			throw new Error(`Invalid binary digits: ${digits}`);
		return { value: BigInt(`0b${digits}`), detectedBase: "binary" };
	}
	if (lower.endsWith("d")) {
		const digits = lower.slice(0, -1);
		if (!/^[0-9]+$/.test(digits))
			throw new Error(`Invalid decimal digits: ${digits}`);
		return { value: BigInt(digits), detectedBase: "decimal" };
	}
	if (lower.endsWith("o") || lower.endsWith("q")) {
		const digits = lower.slice(0, -1);
		if (!/^[0-7]+$/.test(digits))
			throw new Error(`Invalid octal digits: ${digits}`);
		return { value: BigInt(`0o${digits}`), detectedBase: "octal" };
	}

	// Plain decimal
	if (/^[0-9]+$/.test(t)) return { value: BigInt(t), detectedBase: "decimal" };

	throw new Error(`Cannot parse MASM number literal: "${s}"`);
}

function parseValue(v: string | number): bigint {
	const s = String(v).trim().toLowerCase().replace(/_/g, "");
	if (s.startsWith("-")) return -parseValue(s.slice(1));
	if (s.startsWith("0x")) return BigInt(`0x${s.slice(2)}`);
	if (s.startsWith("0b")) return BigInt(`0b${s.slice(2)}`);
	// Try MASM
	try {
		return parseMasmLiteral(s).value;
	} catch {
		return BigInt(s);
	}
}

/** Format a value as MASM hex literal (e.g. 0FFh, 1234h) */
function toMasmHex(value: bigint, bits?: number): string {
	const hex = value.toString(16).toUpperCase();
	// MASM requires a leading digit if first char is A-F
	const padded = bits ? hex.padStart(bits / 4, "0") : hex;
	const withLeading = /^[A-F]/.test(padded) ? `0${padded}` : padded;
	return `${withLeading}h`;
}

export function execute(input: Input): string {
	const strVal = String(input.value);

	if (input.action === "parse_masm_number") {
		const { value, detectedBase } = parseMasmLiteral(strVal);
		const bits = input.bits;
		return JSON.stringify({
			input: strVal,
			detectedBase,
			decimal: value.toString(),
			hex: `0x${value
				.toString(16)
				.toUpperCase()
				.padStart(bits ? bits / 4 : 1, "0")}`,
			binary: `0b${value.toString(2).padStart(bits ?? 1, "0")}`,
			octal: `0o${value.toString(8)}`,
			masmHex: toMasmHex(value, bits),
			masmBin: `${value.toString(2)}b`,
			masmDec: `${value.toString(10)}d`,
			masmOct: `${value.toString(8)}o`,
		});
	}

	const value = parseValue(strVal);
	const bits = input.bits;

	switch (input.action) {
		case "format_masm":
			return JSON.stringify({
				input: strVal,
				decimal: value.toString(),
				masmHex: toMasmHex(value, bits),
				masmBin: `${value.toString(2)}b`,
				masmDec: `${value.toString(10)}d`,
				masmOct: `${value.toString(8)}o`,
			});
		case "format_hex": {
			const hex = value
				.toString(16)
				.toUpperCase()
				.padStart(bits ? bits / 4 : 1, "0");
			return JSON.stringify({
				input: strVal,
				decimal: value.toString(),
				hex: `0x${hex}`,
				masmHex: toMasmHex(value, bits),
			});
		}
		case "format_bin": {
			const bin = value.toString(2).padStart(bits ?? 1, "0");
			return JSON.stringify({
				input: strVal,
				decimal: value.toString(),
				binary: `0b${bin}`,
				masmBin: `${bin}b`,
			});
		}
		case "format_dec":
			return JSON.stringify({
				input: strVal,
				decimal: value.toString(),
				masmDec: `${value.toString(10)}d`,
			});
		case "format_oct": {
			const oct = value.toString(8);
			return JSON.stringify({
				input: strVal,
				decimal: value.toString(),
				octal: `0o${oct}`,
				masmOct: `${oct}o`,
			});
		}
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_numbers",
	description:
		"MASM number format parsing and conversion: parse MASM-style literals (0FFh hex, 1010b binary, 123d decimal, 777o octal) and format numbers into MASM, hex, binary, decimal, or octal representations.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
