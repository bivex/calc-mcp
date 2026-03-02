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
			"add",
			"sub",
			"and",
			"or",
			"xor",
			"shl",
			"shr",
			"sar",
			"mul",
			"imul",
		])
		.describe("x86 operation to simulate"),
	a: z
		.union([z.string(), z.number()])
		.describe("First operand (decimal, 0x hex, or 0b binary string)"),
	b: z
		.union([z.string(), z.number()])
		.describe("Second operand or shift count"),
	bits: z
		.number()
		.refine((v): v is Bits => (VALID_BITS as readonly number[]).includes(v), {
			message: "bits must be 8, 16, 32, or 64",
		})
		.describe("Operand bit width: 8, 16, 32, or 64"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function parseValue(v: string | number): bigint {
	const s = String(v).trim().toLowerCase().replace(/_/g, "");
	if (s.startsWith("-")) return -parseValue(s.slice(1));
	if (s.startsWith("0x")) return BigInt(`0x${s.slice(2)}`);
	if (s.startsWith("0b")) return BigInt(`0b${s.slice(2)}`);
	return BigInt(s);
}

function mask(bits: Bits): bigint {
	return (1n << BigInt(bits)) - 1n;
}

function signBit(bits: Bits): bigint {
	return 1n << BigInt(bits - 1);
}

/** Parity flag: 1 if even number of set bits in lowest byte of result */
function computePF(result: bigint): boolean {
	let byte = Number(result & 0xffn);
	byte ^= byte >> 4;
	byte ^= byte >> 2;
	byte ^= byte >> 1;
	return (byte & 1) === 0;
}

/** Auxiliary Carry Flag: carry from bit 3 to bit 4 */
function computeAF(a: bigint, b: bigint, result: bigint): boolean {
	return ((a ^ b ^ result) & 0x10n) !== 0n;
}

interface Flags {
	CF: boolean;
	ZF: boolean;
	SF: boolean;
	OF: boolean;
	PF: boolean;
	AF: boolean;
}

function computeFlags(
	operation: Input["operation"],
	a: bigint,
	b: bigint,
	bits: Bits,
): { result: bigint; flags: Flags } {
	const m = mask(bits);
	const sb = signBit(bits);
	const aMasked = a & m;
	const bMasked = b & m;

	let result: bigint;
	let CF = false;
	let OF = false;

	switch (operation) {
		case "add": {
			const full = aMasked + bMasked;
			result = full & m;
			CF = full > m;
			// Overflow: same sign inputs, different sign output
			const aSign = (aMasked & sb) !== 0n;
			const bSign = (bMasked & sb) !== 0n;
			const rSign = (result & sb) !== 0n;
			OF = aSign === bSign && rSign !== aSign;
			break;
		}
		case "sub": {
			const full = aMasked - bMasked;
			result = full & m;
			CF = aMasked < bMasked;
			// Overflow: different sign inputs, result sign differs from a
			const aSign = (aMasked & sb) !== 0n;
			const bSign = (bMasked & sb) !== 0n;
			const rSign = (result & sb) !== 0n;
			OF = aSign !== bSign && rSign !== aSign;
			break;
		}
		case "and":
			result = aMasked & bMasked;
			CF = false;
			OF = false;
			break;
		case "or":
			result = aMasked | bMasked;
			CF = false;
			OF = false;
			break;
		case "xor":
			result = aMasked ^ bMasked;
			CF = false;
			OF = false;
			break;
		case "shl": {
			const count = Number(b % BigInt(bits + 1));
			if (count === 0) {
				result = aMasked;
				CF = false;
				OF = false;
			} else {
				result = (aMasked << BigInt(count)) & m;
				CF = ((aMasked >> BigInt(bits - count)) & 1n) !== 0n;
				OF = count === 1 ? CF !== ((result & sb) !== 0n) : false;
			}
			break;
		}
		case "shr": {
			const count = Number(b % BigInt(bits + 1));
			if (count === 0) {
				result = aMasked;
				CF = false;
				OF = false;
			} else {
				CF = ((aMasked >> BigInt(count - 1)) & 1n) !== 0n;
				result = aMasked >> BigInt(count);
				OF = count === 1 ? (aMasked & sb) !== 0n : false;
			}
			break;
		}
		case "sar": {
			const count = Number(b % BigInt(bits + 1));
			// Treat aMasked as signed
			const aSign = (aMasked & sb) !== 0n;
			if (count === 0) {
				result = aMasked;
				CF = false;
				OF = false;
			} else {
				CF = ((aMasked >> BigInt(count - 1)) & 1n) !== 0n;
				if (aSign) {
					// arithmetic: fill with sign bit
					result = (aMasked >> BigInt(count)) | (m - (m >> BigInt(count)));
					result &= m;
				} else {
					result = aMasked >> BigInt(count);
				}
				OF = false; // SAR count=1: OF=0
			}
			break;
		}
		case "mul": {
			// Unsigned multiply; CF/OF set if upper half != 0
			const full = aMasked * bMasked;
			result = full & m;
			const upper = full >> BigInt(bits);
			CF = upper !== 0n;
			OF = CF;
			break;
		}
		case "imul": {
			// Signed multiply
			const aSign = (aMasked & sb) !== 0n;
			const bSign = (bMasked & sb) !== 0n;
			const aSigned = aSign ? aMasked - (m + 1n) : aMasked;
			const bSigned = bSign ? bMasked - (m + 1n) : bMasked;
			const full = aSigned * bSigned;
			result = full & m;
			// Check if result fits in signed range
			const rSign = (result & sb) !== 0n;
			const rSigned = rSign ? result - (m + 1n) : result;
			CF = rSigned !== full;
			OF = CF;
			break;
		}
		default:
			throw new Error(`Unknown operation: ${operation}`);
	}

	const ZF = result === 0n;
	const SF = (result & sb) !== 0n;
	const PF = computePF(result);
	const AF =
		operation === "add" || operation === "sub"
			? computeAF(aMasked, bMasked, result)
			: false;

	return { result, flags: { CF, ZF, SF, OF, PF, AF } };
}

export function execute(input: Input): string {
	const { operation, bits } = input;
	const m = mask(bits);
	const a = parseValue(input.a);
	const b = parseValue(input.b);

	const { result, flags } = computeFlags(operation, a, b, bits);

	return JSON.stringify({
		operation,
		a: (a & m).toString(),
		b: (b & m).toString(),
		bits,
		result: result.toString(),
		resultHex: `0x${result
			.toString(16)
			.toUpperCase()
			.padStart(bits / 4, "0")}`,
		flags: {
			CF: flags.CF,
			ZF: flags.ZF,
			SF: flags.SF,
			OF: flags.OF,
			PF: flags.PF,
			AF: flags.AF,
		},
		flagsDescription: {
			CF: "Carry Flag — unsigned overflow or borrow",
			ZF: "Zero Flag — result is zero",
			SF: "Sign Flag — result is negative (MSB set)",
			OF: "Overflow Flag — signed overflow",
			PF: "Parity Flag — even number of set bits in low byte",
			AF: "Auxiliary Carry Flag — carry from bit 3 (BCD)",
		},
	});
}

export const tool: ToolDefinition = {
	name: "asm_flags",
	description:
		"Compute x86 CPU flag results (CF, ZF, SF, OF, PF, AF) after arithmetic or logical operations: add, sub, and, or, xor, shl, shr, sar, mul, imul. Useful for predicting conditional jump behavior in MASM.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
