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

const DATA_TYPES = {
	byte: { bits: 8 as Bits, bytes: 1 },
	word: { bits: 16 as Bits, bytes: 2 },
	dword: { bits: 32 as Bits, bytes: 4 },
	qword: { bits: 64 as Bits, bytes: 8 },
} as const;

const schema = {
	action: z
		.enum([
			"size_info",
			"twos_complement",
			"sign_extend",
			"effective_address",
			"segment_offset",
			"fit_check",
		])
		.describe(
			"Action: size_info | twos_complement | sign_extend | effective_address | segment_offset | fit_check",
		),
	dataType: z
		.enum(["byte", "word", "dword", "qword"])
		.optional()
		.describe("Data type for size_info, twos_complement, fit_check"),
	value: z
		.union([z.string(), z.number()])
		.optional()
		.describe(
			"Value for twos_complement, sign_extend, fit_check (decimal, 0x hex, or 0b binary)",
		),
	fromBits: z
		.number()
		.refine((v): v is Bits => (VALID_BITS as readonly number[]).includes(v), {
			message: "fromBits must be 8, 16, 32, or 64",
		})
		.optional()
		.describe("Source bit width for sign_extend"),
	toBits: z
		.number()
		.refine((v): v is Bits => (VALID_BITS as readonly number[]).includes(v), {
			message: "toBits must be 8, 16, 32, or 64",
		})
		.optional()
		.describe("Target bit width for sign_extend"),
	base: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Base register value for effective_address"),
	index: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Index register value for effective_address"),
	scale: z
		.number()
		.refine((v) => [1, 2, 4, 8].includes(v), {
			message: "scale must be 1, 2, 4, or 8",
		})
		.optional()
		.describe("Scale factor for effective_address (1, 2, 4, or 8)"),
	displacement: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Displacement for effective_address"),
	segment: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Segment value (0–0xFFFF) for segment_offset"),
	offset: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Offset value (0–0xFFFF) for segment_offset"),
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

function toHex(v: bigint, bits: Bits): string {
	return `0x${(v & mask(bits))
		.toString(16)
		.toUpperCase()
		.padStart(bits / 4, "0")}`;
}

function sizeInfo(dataType: keyof typeof DATA_TYPES): string {
	const { bits, bytes } = DATA_TYPES[dataType];
	const maxUnsigned = mask(bits);
	const maxSigned = (1n << BigInt(bits - 1)) - 1n;
	const minSigned = -(1n << BigInt(bits - 1));
	return JSON.stringify({
		dataType,
		bits,
		bytes,
		minSigned: minSigned.toString(),
		maxSigned: maxSigned.toString(),
		minUnsigned: "0",
		maxUnsigned: maxUnsigned.toString(),
		maxUnsignedHex: toHex(maxUnsigned, bits),
	});
}

function twosComplement(value: bigint, bits: Bits): string {
	const m = mask(bits);
	const raw = value & m;
	const signBit = 1n << BigInt(bits - 1);
	const signed = raw >= signBit ? raw - (1n << BigInt(bits)) : raw;
	return JSON.stringify({
		input: value.toString(),
		bits,
		unsigned: raw.toString(),
		signed: signed.toString(),
		hex: toHex(raw, bits),
		binary: `0b${raw.toString(2).padStart(bits, "0")}`,
	});
}

function signExtend(value: bigint, fromBits: Bits, toBits: Bits): string {
	if (toBits < fromBits)
		throw new Error(`toBits (${toBits}) must be >= fromBits (${fromBits})`);
	const fromMask = mask(fromBits);
	const raw = value & fromMask;
	const signBit = 1n << BigInt(fromBits - 1);
	let extended: bigint;
	if (raw & signBit) {
		// negative: fill upper bits with 1s
		extended = raw | (~fromMask & mask(toBits));
	} else {
		extended = raw;
	}
	const toMask = mask(toBits);
	const result = extended & toMask;
	const signedBit = 1n << BigInt(toBits - 1);
	const signed = result >= signedBit ? result - (1n << BigInt(toBits)) : result;
	return JSON.stringify({
		input: value.toString(),
		fromBits,
		toBits,
		result: result.toString(),
		signedResult: signed.toString(),
		hex: toHex(result, toBits),
	});
}

function effectiveAddress(
	base?: string | number,
	index?: string | number,
	scale?: number,
	displacement?: string | number,
): string {
	const b = base !== undefined ? parseValue(base) : 0n;
	const i = index !== undefined ? parseValue(index) : 0n;
	const s = scale !== undefined ? BigInt(scale) : 1n;
	const d = displacement !== undefined ? parseValue(displacement) : 0n;
	const addr = b + i * s + d;
	return JSON.stringify({
		base: base !== undefined ? b.toString() : undefined,
		index: index !== undefined ? i.toString() : undefined,
		scale: scale !== undefined ? Number(s) : undefined,
		displacement: displacement !== undefined ? d.toString() : undefined,
		effectiveAddress: addr.toString(),
		hex: `0x${addr.toString(16).toUpperCase()}`,
	});
}

function segmentOffset(segment: bigint, offset: bigint): string {
	if (segment > 0xffffn || segment < 0n)
		throw new Error("segment must be 0–0xFFFF");
	if (offset > 0xffffn || offset < 0n)
		throw new Error("offset must be 0–0xFFFF");
	const linear = (segment << 4n) + offset;
	return JSON.stringify({
		segment: `0x${segment.toString(16).toUpperCase().padStart(4, "0")}`,
		offset: `0x${offset.toString(16).toUpperCase().padStart(4, "0")}`,
		linear: linear.toString(),
		linearHex: `0x${linear.toString(16).toUpperCase().padStart(5, "0")}`,
		notation: `${segment.toString(16).toUpperCase().padStart(4, "0")}:${offset.toString(16).toUpperCase().padStart(4, "0")}`,
	});
}

function fitCheck(value: bigint, dataType: keyof typeof DATA_TYPES): string {
	const { bits } = DATA_TYPES[dataType];
	const maxUnsigned = mask(bits);
	const maxSigned = (1n << BigInt(bits - 1)) - 1n;
	const minSigned = -(1n << BigInt(bits - 1));
	const fitsUnsigned = value >= 0n && value <= maxUnsigned;
	const fitsSigned = value >= minSigned && value <= maxSigned;
	return JSON.stringify({
		value: value.toString(),
		dataType,
		bits,
		fitsUnsigned,
		fitsSigned,
		fitsEither: fitsUnsigned || fitsSigned,
		unsignedRange: { min: "0", max: maxUnsigned.toString() },
		signedRange: { min: minSigned.toString(), max: maxSigned.toString() },
	});
}

export function execute(input: Input): string {
	switch (input.action) {
		case "size_info": {
			if (!input.dataType)
				throw new Error("dataType is required for size_info");
			return sizeInfo(input.dataType);
		}
		case "twos_complement": {
			if (input.value === undefined)
				throw new Error("value is required for twos_complement");
			if (!input.dataType)
				throw new Error("dataType is required for twos_complement");
			const bits = DATA_TYPES[input.dataType].bits;
			return twosComplement(parseValue(input.value), bits);
		}
		case "sign_extend": {
			if (input.value === undefined)
				throw new Error("value is required for sign_extend");
			if (!input.fromBits)
				throw new Error("fromBits is required for sign_extend");
			if (!input.toBits) throw new Error("toBits is required for sign_extend");
			return signExtend(parseValue(input.value), input.fromBits, input.toBits);
		}
		case "effective_address": {
			return effectiveAddress(
				input.base,
				input.index,
				input.scale,
				input.displacement,
			);
		}
		case "segment_offset": {
			if (input.segment === undefined)
				throw new Error("segment is required for segment_offset");
			if (input.offset === undefined)
				throw new Error("offset is required for segment_offset");
			return segmentOffset(parseValue(input.segment), parseValue(input.offset));
		}
		case "fit_check": {
			if (input.value === undefined)
				throw new Error("value is required for fit_check");
			if (!input.dataType)
				throw new Error("dataType is required for fit_check");
			return fitCheck(parseValue(input.value), input.dataType);
		}
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_memory",
	description:
		"MASM/x86 memory and data-type calculations: data type size info (byte/word/dword/qword), two's complement encoding, sign extension, effective address (base+index*scale+disp), segment:offset real-mode addressing, and immediate value fit checking.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
