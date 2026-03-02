import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum([
			"modrm_encode",
			"modrm_decode",
			"sib_encode",
			"sib_decode",
			"imm_encode",
			"disp_encode",
			"little_endian",
			"big_endian",
		])
		.describe(
			"Action: modrm_encode/decode | sib_encode/decode | imm_encode | disp_encode | little_endian | big_endian",
		),
	// ModRM fields
	mod: z
		.number()
		.int()
		.min(0)
		.max(3)
		.optional()
		.describe("ModRM mod field (0–3)"),
	reg: z
		.number()
		.int()
		.min(0)
		.max(7)
		.optional()
		.describe("ModRM reg field (0–7)"),
	rm: z
		.number()
		.int()
		.min(0)
		.max(7)
		.optional()
		.describe("ModRM r/m field (0–7)"),
	byte: z
		.number()
		.int()
		.min(0)
		.max(255)
		.optional()
		.describe("Raw byte value for decode operations"),
	// SIB fields
	scale: z
		.number()
		.refine((v) => [1, 2, 4, 8].includes(v), {
			message: "scale must be 1, 2, 4, or 8",
		})
		.optional()
		.describe("SIB scale factor (1, 2, 4, or 8)"),
	index: z
		.number()
		.int()
		.min(0)
		.max(7)
		.optional()
		.describe("SIB index register (0–7)"),
	base: z
		.number()
		.int()
		.min(0)
		.max(7)
		.optional()
		.describe("SIB base register (0–7)"),
	// Encoding fields
	value: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Value for imm_encode, disp_encode, little_endian, big_endian"),
	bits: z
		.number()
		.refine((v) => [8, 16, 32, 64].includes(v), {
			message: "bits must be 8, 16, 32, or 64",
		})
		.optional()
		.describe("Bit width (8, 16, 32, or 64)"),
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

function toByteArray(value: bigint, byteCount: number): number[] {
	const bytes: number[] = [];
	let v = value;
	for (let i = 0; i < byteCount; i++) {
		bytes.push(Number(v & 0xffn));
		v >>= 8n;
	}
	return bytes;
}

function formatBytes(bytes: number[]): string {
	return bytes
		.map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
		.join(" ");
}

const MOD_NAMES: Record<number, string> = {
	0: "no displacement (indirect)",
	1: "8-bit displacement",
	2: "32-bit displacement",
	3: "register direct",
};

const REG_NAMES_32: Record<number, string> = {
	0: "EAX/AL",
	1: "ECX/CL",
	2: "EDX/DL",
	3: "EBX/BL",
	4: "ESP/AH",
	5: "EBP/CH",
	6: "ESI/DH",
	7: "EDI/BH",
};

const RM_NAMES: Record<number, Record<number, string>> = {
	0: {
		0: "[EAX]",
		1: "[ECX]",
		2: "[EDX]",
		3: "[EBX]",
		4: "[SIB]",
		5: "[disp32]",
		6: "[ESI]",
		7: "[EDI]",
	},
	1: {
		0: "[EAX+disp8]",
		1: "[ECX+disp8]",
		2: "[EDX+disp8]",
		3: "[EBX+disp8]",
		4: "[SIB+disp8]",
		5: "[EBP+disp8]",
		6: "[ESI+disp8]",
		7: "[EDI+disp8]",
	},
	2: {
		0: "[EAX+disp32]",
		1: "[ECX+disp32]",
		2: "[EDX+disp32]",
		3: "[EBX+disp32]",
		4: "[SIB+disp32]",
		5: "[EBP+disp32]",
		6: "[ESI+disp32]",
		7: "[EDI+disp32]",
	},
	3: {
		0: "reg",
		1: "reg",
		2: "reg",
		3: "reg",
		4: "reg",
		5: "reg",
		6: "reg",
		7: "reg",
	},
};

const SIB_SCALE: Record<number, number> = { 0: 1, 1: 2, 2: 4, 3: 8 };
const SIB_INDEX_NAMES: Record<number, string> = {
	0: "EAX",
	1: "ECX",
	2: "EDX",
	3: "EBX",
	4: "none",
	5: "EBP",
	6: "ESI",
	7: "EDI",
};
const SIB_BASE_NAMES: Record<number, string> = {
	0: "EAX",
	1: "ECX",
	2: "EDX",
	3: "EBX",
	4: "ESP",
	5: "EBP/disp32",
	6: "ESI",
	7: "EDI",
};

export function execute(input: Input): string {
	switch (input.action) {
		case "modrm_encode": {
			const mod = input.mod ?? 0;
			const reg = input.reg ?? 0;
			const rm = input.rm ?? 0;
			const byte = ((mod & 3) << 6) | ((reg & 7) << 3) | (rm & 7);
			return JSON.stringify({
				mod,
				reg,
				rm,
				byte,
				hex: `0x${byte.toString(16).toUpperCase().padStart(2, "0")}`,
				binary: `0b${byte.toString(2).padStart(8, "0")}`,
				description: `mod=${mod}(${MOD_NAMES[mod]}) reg=${reg}(${REG_NAMES_32[reg]}) rm=${rm}(${RM_NAMES[mod]?.[rm] ?? "reg"})`,
			});
		}
		case "modrm_decode": {
			if (input.byte === undefined)
				throw new Error("byte is required for modrm_decode");
			const b = input.byte;
			const mod = (b >> 6) & 3;
			const reg = (b >> 3) & 7;
			const rm = b & 7;
			return JSON.stringify({
				byte: b,
				hex: `0x${b.toString(16).toUpperCase().padStart(2, "0")}`,
				binary: `0b${b.toString(2).padStart(8, "0")}`,
				mod,
				reg,
				rm,
				modDescription: MOD_NAMES[mod],
				regDescription: REG_NAMES_32[reg],
				rmDescription: RM_NAMES[mod]?.[rm] ?? "reg",
				sibRequired: mod !== 3 && rm === 4,
				dispSize:
					mod === 1
						? "8-bit"
						: mod === 2
							? "32-bit"
							: mod === 0 && rm === 5
								? "32-bit (disp32 only)"
								: "none",
			});
		}
		case "sib_encode": {
			const scaleVal = input.scale ?? 1;
			const scaleField = [1, 2, 4, 8].indexOf(scaleVal);
			const index = input.index ?? 0;
			const base = input.base ?? 0;
			const byte = ((scaleField & 3) << 6) | ((index & 7) << 3) | (base & 7);
			return JSON.stringify({
				scale: scaleVal,
				scaleField,
				index,
				base,
				byte,
				hex: `0x${byte.toString(16).toUpperCase().padStart(2, "0")}`,
				binary: `0b${byte.toString(2).padStart(8, "0")}`,
				description: `[${SIB_INDEX_NAMES[index] !== "none" ? `${SIB_INDEX_NAMES[index]}*${scaleVal}+` : ""}${SIB_BASE_NAMES[base]}]`,
			});
		}
		case "sib_decode": {
			if (input.byte === undefined)
				throw new Error("byte is required for sib_decode");
			const b = input.byte;
			const scaleField = (b >> 6) & 3;
			const index = (b >> 3) & 7;
			const base = b & 7;
			const scaleVal = SIB_SCALE[scaleField] ?? 1;
			const indexName = SIB_INDEX_NAMES[index] ?? "?";
			const baseName = SIB_BASE_NAMES[base] ?? "?";
			return JSON.stringify({
				byte: b,
				hex: `0x${b.toString(16).toUpperCase().padStart(2, "0")}`,
				binary: `0b${b.toString(2).padStart(8, "0")}`,
				scaleField,
				scale: scaleVal,
				index,
				indexRegister: indexName,
				base,
				baseRegister: baseName,
				description:
					indexName !== "none"
						? `[${indexName}*${scaleVal}+${baseName}]`
						: `[${baseName}]`,
			});
		}
		case "imm_encode":
		case "little_endian": {
			if (input.value === undefined) throw new Error("value is required");
			if (!input.bits) throw new Error("bits is required");
			const byteCount = input.bits / 8;
			const mask = (1n << BigInt(input.bits)) - 1n;
			const v = parseValue(input.value) & mask;
			const bytes = toByteArray(v, byteCount);
			return JSON.stringify({
				value: v.toString(),
				hex: `0x${v
					.toString(16)
					.toUpperCase()
					.padStart(input.bits / 4, "0")}`,
				bits: input.bits,
				bytes,
				byteArray: formatBytes(bytes),
				encoding: "little-endian (low byte first)",
			});
		}
		case "disp_encode": {
			if (input.value === undefined) throw new Error("value is required");
			if (!input.bits) throw new Error("bits is required (8 or 32)");
			if (input.bits !== 8 && input.bits !== 32)
				throw new Error(
					"disp_encode only supports 8-bit and 32-bit displacements",
				);
			const byteCount = input.bits / 8;
			const mask = (1n << BigInt(input.bits)) - 1n;
			const v = parseValue(input.value) & mask;
			const signBit = 1n << BigInt(input.bits - 1);
			const signed = v >= signBit ? v - (1n << BigInt(input.bits)) : v;
			const bytes = toByteArray(v, byteCount);
			return JSON.stringify({
				value: v.toString(),
				signedValue: signed.toString(),
				bits: input.bits,
				bytes,
				byteArray: formatBytes(bytes),
				encoding: "little-endian (low byte first)",
			});
		}
		case "big_endian": {
			if (input.value === undefined) throw new Error("value is required");
			if (!input.bits) throw new Error("bits is required");
			const byteCount = input.bits / 8;
			const mask = (1n << BigInt(input.bits)) - 1n;
			const v = parseValue(input.value) & mask;
			const bytes = toByteArray(v, byteCount).reverse();
			return JSON.stringify({
				value: v.toString(),
				hex: `0x${v
					.toString(16)
					.toUpperCase()
					.padStart(input.bits / 4, "0")}`,
				bits: input.bits,
				bytes,
				byteArray: formatBytes(bytes),
				encoding: "big-endian (high byte first)",
			});
		}
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_encoding",
	description:
		"x86 binary encoding helpers for MASM/assembly: ModRM byte encode/decode, SIB byte encode/decode, immediate and displacement encoding (little-endian byte arrays), and endian conversion.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
