/**
 * Copyright (c) 2026 Bivex
 *
 * Author: Bivex
 * Available for contact via email: support@b-b.top
 * For up-to-date contact information:
 * https://github.com/bivex
 *
 * Created: 2026-03-02 19:11
 * Last Updated: 2026-03-02 19:11
 *
 * Licensed under the MIT License.
 * Commercial licensing available upon request.
 */

import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum([
			"parse_immediate",
			"parse_register",
			"parse_memory",
			"format_immediate",
			"format_register",
			"format_memory",
			"suffix_for_size",
			"size_for_suffix",
			"swap_operands",
		])
		.describe(
			"Action: parse_immediate ($42→value), parse_register (%eax→name), parse_memory (8(%ebp)→components), format_immediate (42→$0x2A), format_register (eax→%eax), format_memory (base+index+scale+offset→GAS string), suffix_for_size (32→l), size_for_suffix (l→32), swap_operands (AT&T src,dst ↔ Intel dst,src)",
		),
	value: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Input value (string or number)"),
	base: z
		.string()
		.optional()
		.describe("Base register name (with or without %) for format_memory"),
	index: z
		.string()
		.optional()
		.describe("Index register name (with or without %) for format_memory"),
	scale: z
		.number()
		.int()
		.optional()
		.describe("Scale factor 1/2/4/8 for format_memory index"),
	offset: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Displacement offset for format_memory"),
	src: z.string().optional().describe("Source operand for swap_operands"),
	dst: z.string().optional().describe("Destination operand for swap_operands"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function stripPercent(r: string): string {
	return r.toLowerCase().replace(/^%/, "");
}

function parseBigInt(s: string): bigint {
	const trimmed = s.trim();
	if (trimmed.startsWith("-")) return -parseBigInt(trimmed.slice(1));
	if (trimmed.startsWith("0x") || trimmed.startsWith("0X"))
		return BigInt(trimmed);
	if (trimmed.startsWith("0b") || trimmed.startsWith("0B"))
		return BigInt(trimmed);
	return BigInt(trimmed);
}

export function execute(input: Input): string {
	switch (input.action) {
		case "parse_immediate": {
			const raw = String(input.value ?? "").trim();
			if (!raw.startsWith("$"))
				throw new Error(`GAS immediate must start with '$', got: ${raw}`);
			const inner = raw.slice(1);
			const n = parseBigInt(inner);
			const absHex =
				n < 0n
					? `-0x${(-n).toString(16).toUpperCase()}`
					: `0x${n.toString(16).toUpperCase()}`;
			return JSON.stringify({
				input: raw,
				value: Number(n),
				valueHex: absHex,
				valueBin: n < 0n ? `-0b${(-n).toString(2)}` : `0b${n.toString(2)}`,
				gasDecimal: `$${n.toString()}`,
				gasHex: `$${absHex}`,
			});
		}
		case "parse_register": {
			const raw = String(input.value ?? "").trim();
			if (!raw.startsWith("%"))
				throw new Error(`GAS register must start with '%', got: ${raw}`);
			const name = raw.slice(1).toLowerCase();
			return JSON.stringify({
				input: raw,
				name,
				gasFormat: `%${name}`,
				intelFormat: name,
			});
		}
		case "parse_memory": {
			// AT&T memory: disp(base, index, scale)
			// examples: 8(%ebp)  (%eax,%ebx,4)  -4(%rbp)  (%rsp)  symbol(%rip)
			const raw = String(input.value ?? "").trim();
			const match = raw.match(
				/^(-?(?:0x[0-9a-fA-F]+|[0-9]*))\((%[a-zA-Z0-9]+)(?:,(%[a-zA-Z0-9]+)(?:,([0-9]+))?)?\)$/,
			);
			if (!match)
				throw new Error(
					`Cannot parse GAS memory operand: ${raw}. Expected: disp(%base,%index,scale)`,
				);
			const [, dispStr, baseReg, indexReg, scaleStr] = match;
			const disp = dispStr && dispStr !== "" ? Number(dispStr) : 0;
			const base = String(baseReg).slice(1).toLowerCase();
			const index = indexReg ? indexReg.slice(1).toLowerCase() : null;
			const scale = scaleStr ? Number(scaleStr) : index ? 1 : null;
			// Build Intel [base + index*scale + disp]
			const parts: string[] = [base];
			if (index) parts.push(scale === 1 ? index : `${index}*${scale}`);
			if (disp > 0) parts.push(`+${disp}`);
			else if (disp < 0) parts.push(String(disp));
			return JSON.stringify({
				input: raw,
				displacement: disp,
				base,
				index,
				scale,
				intelSyntax: `[${parts.join("")}]`,
			});
		}
		case "format_immediate": {
			const n = parseBigInt(String(input.value ?? "0"));
			const absHex =
				n < 0n
					? `-0x${(-n).toString(16).toUpperCase()}`
					: `0x${n.toString(16).toUpperCase()}`;
			return JSON.stringify({
				value: Number(n),
				gasImmediate: `$${absHex}`,
				gasDecimal: `$${n.toString()}`,
				intelImmediate: absHex,
			});
		}
		case "format_register": {
			const name = stripPercent(String(input.value ?? ""));
			return JSON.stringify({
				intelFormat: name,
				gasFormat: `%${name}`,
			});
		}
		case "format_memory": {
			if (!input.base)
				throw new Error("base register is required for format_memory");
			const base = stripPercent(String(input.base));
			const index = input.index ? stripPercent(String(input.index)) : null;
			const scale = input.scale ?? 1;
			const disp = input.offset !== undefined ? Number(input.offset) : 0;
			// GAS: disp(%base,%index,scale)
			const dispStr = disp !== 0 ? String(disp) : "";
			const innerParts = [`%${base}`];
			if (index) {
				innerParts.push(`%${index}`);
				innerParts.push(String(scale));
			}
			const gasFormat = `${dispStr}(${innerParts.join(",")})`;
			// Intel: [base+index*scale+disp]
			let intel = base;
			if (index) intel += `+${scale === 1 ? index : `${index}*${scale}`}`;
			if (disp > 0) intel += `+${disp}`;
			else if (disp < 0) intel += String(disp);
			return JSON.stringify({
				gasFormat,
				intelSyntax: `[${intel}]`,
				displacement: disp,
				base,
				index,
				scale: index ? scale : null,
			});
		}
		case "suffix_for_size": {
			const bits = Number(input.value);
			const map: Record<
				number,
				{ suffix: string; desc: string; masm: string }
			> = {
				8: { suffix: "b", desc: "byte", masm: "BYTE PTR" },
				16: { suffix: "w", desc: "word", masm: "WORD PTR" },
				32: { suffix: "l", desc: "long (dword)", masm: "DWORD PTR" },
				64: { suffix: "q", desc: "quad (qword)", masm: "QWORD PTR" },
				128: { suffix: "x", desc: "xmmword", masm: "XMMWORD PTR" },
			};
			const entry = map[bits];
			if (!entry)
				throw new Error(
					`No GAS suffix for ${bits} bits. Valid sizes: 8, 16, 32, 64, 128`,
				);
			return JSON.stringify({
				bits,
				bytes: bits / 8,
				suffix: entry.suffix,
				description: entry.desc,
				example: `mov${entry.suffix}`,
				masmEquivalent: entry.masm,
			});
		}
		case "size_for_suffix": {
			const suffix = String(input.value ?? "")
				.toLowerCase()
				.trim();
			const map: Record<string, { bits: number; desc: string }> = {
				b: { bits: 8, desc: "byte" },
				w: { bits: 16, desc: "word" },
				l: { bits: 32, desc: "long (dword)" },
				q: { bits: 64, desc: "quad (qword)" },
				x: { bits: 128, desc: "xmmword" },
				s: { bits: 32, desc: "single-precision float" },
				t: { bits: 80, desc: "ten-byte (x87 extended)" },
			};
			const entry = map[suffix];
			if (!entry)
				throw new Error(
					`Unknown GAS suffix '${suffix}'. Valid: b, w, l, q, x, s, t`,
				);
			return JSON.stringify({
				suffix,
				bits: entry.bits,
				bytes: entry.bits / 8,
				description: entry.desc,
			});
		}
		case "swap_operands": {
			const src = String(input.src ?? "");
			const dst = String(input.dst ?? "");
			if (!src && !dst) throw new Error("Provide src and dst operands");
			return JSON.stringify({
				att: { order: "src, dst", src, dst, formatted: `${src}, ${dst}` },
				intel: { order: "dst, src", dst, src, formatted: `${dst}, ${src}` },
				note: "AT&T/GAS: source first. Intel/MASM/NASM: destination first.",
			});
		}
		default:
			throw new Error(
				`Unknown action: ${(input as { action: string }).action}`,
			);
	}
}

export const tool: ToolDefinition = {
	name: "asm_gas",
	description:
		"GAS/AT&T assembly syntax helpers: parse and format immediates ($42), registers (%eax), memory operands (8(%ebp,%ecx,4)), instruction size suffixes (b/w/l/q), and convert operand order between AT&T (src,dst) and Intel (dst,src) syntax.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
