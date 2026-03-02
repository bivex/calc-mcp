/**
 * Copyright (c) 2026 Bivex
 *
 * Author: Bivex
 * Available for contact via email: support@b-b.top
 * For up-to-date contact information:
 * https://github.com/bivex
 *
 * Created: 2026-03-02 18:45
 * Last Updated: 2026-03-02 18:45
 *
 * Licensed under the MIT License.
 * Commercial licensing available upon request.
 */

import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const VALID_BITS = [8, 16, 32, 64] as const;
type Bits = (typeof VALID_BITS)[number];

const schema = {
	operation: z
		.enum([
			"and",
			"or",
			"xor",
			"not",
			"shl",
			"shr",
			"rol",
			"ror",
			"extract",
			"insert",
		])
		.describe("Bitwise operation to perform"),
	a: z
		.union([z.string(), z.number()])
		.describe("First operand (decimal, 0x hex, or 0b binary string)"),
	b: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Second operand or shift/rotate count (not used for 'not')"),
	bits: z
		.number()
		.refine((v): v is Bits => (VALID_BITS as readonly number[]).includes(v), {
			message: "bits must be 8, 16, 32, or 64",
		})
		.describe("Register/operand bit width: 8, 16, 32, or 64"),
	offset: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Bit offset for extract/insert (0 = LSB)"),
	length: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe("Bit field length for extract/insert"),
	value: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Value to insert for 'insert' operation"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function parseValue(v: string | number): bigint {
	const s = String(v).trim().toLowerCase().replace(/_/g, "");
	if (s.startsWith("0x")) return BigInt(`0x${s.slice(2)}`);
	if (s.startsWith("0b")) return BigInt(`0b${s.slice(2)}`);
	return BigInt(s);
}

function mask(bits: Bits): bigint {
	return (1n << BigInt(bits)) - 1n;
}

function formatResult(
	result: bigint,
	bits: Bits,
): { hex: string; binary: string; decimal: string } {
	const m = mask(bits);
	const r = result & m;
	return {
		decimal: r.toString(10),
		hex: `0x${r
			.toString(16)
			.toUpperCase()
			.padStart(bits / 4, "0")}`,
		binary: `0b${r.toString(2).padStart(bits, "0")}`,
	};
}

export function execute(input: Input): string {
	const { operation, bits } = input;
	const m = mask(bits);
	const a = parseValue(input.a) & m;

	let result: bigint;

	if (operation === "not") {
		result = ~a & m;
	} else if (operation === "extract") {
		const offset = input.offset ?? 0;
		const length = input.length;
		if (length === undefined) throw new Error("length is required for extract");
		if (offset + length > bits)
			throw new Error(
				`offset+length (${offset + length}) exceeds bit width (${bits})`,
			);
		const fieldMask = (1n << BigInt(length)) - 1n;
		result = (a >> BigInt(offset)) & fieldMask;
	} else if (operation === "insert") {
		const offset = input.offset ?? 0;
		const length = input.length;
		if (length === undefined) throw new Error("length is required for insert");
		if (input.value === undefined)
			throw new Error("value is required for insert");
		if (offset + length > bits)
			throw new Error(
				`offset+length (${offset + length}) exceeds bit width (${bits})`,
			);
		const fieldMask = (1n << BigInt(length)) - 1n;
		const v = parseValue(input.value) & fieldMask;
		result = (a & ~(fieldMask << BigInt(offset))) | (v << BigInt(offset));
	} else {
		if (input.b === undefined)
			throw new Error(`b is required for ${operation}`);
		const b = parseValue(input.b);

		switch (operation) {
			case "and":
				result = a & (b & m);
				break;
			case "or":
				result = a | (b & m);
				break;
			case "xor":
				result = a ^ (b & m);
				break;
			case "shl": {
				const shift = b & BigInt(bits - 1);
				result = (a << shift) & m;
				break;
			}
			case "shr": {
				const shift = b & BigInt(bits - 1);
				result = a >> shift;
				break;
			}
			case "rol": {
				const shift = Number(b % BigInt(bits));
				result = ((a << BigInt(shift)) | (a >> BigInt(bits - shift))) & m;
				break;
			}
			case "ror": {
				const shift = Number(b % BigInt(bits));
				result = ((a >> BigInt(shift)) | (a << BigInt(bits - shift))) & m;
				break;
			}
			default:
				throw new Error(`Unknown operation: ${operation}`);
		}
	}

	const fmt = formatResult(result, bits);
	return JSON.stringify({
		operation,
		a: formatResult(a, bits).decimal,
		...(input.b !== undefined && { b: parseValue(input.b).toString() }),
		...(input.offset !== undefined && { offset: input.offset }),
		...(input.length !== undefined && { length: input.length }),
		bits,
		result: fmt.decimal,
		hex: fmt.hex,
		binary: fmt.binary,
	});
}

export const tool: ToolDefinition = {
	name: "asm_bitwise",
	description:
		"Bitwise operations for assembly/MASM: AND, OR, XOR, NOT, SHL, SHR, ROL, ROR, and bit field extract/insert. Results are masked to the specified bit width (8/16/32/64).",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
