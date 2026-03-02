import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["float_to_hex", "double_to_hex", "hex_to_float", "hex_to_double"])
		.describe(
			"Action: float_to_hex | double_to_hex | hex_to_float | hex_to_double",
		),
	value: z
		.union([z.string(), z.number()])
		.describe(
			"For float/double_to_hex: decimal number (e.g. 1.0, -3.14, 1e10). For hex_to_*: 4-byte hex for float (0x3F800000) or 8-byte for double (0x3FF0000000000000).",
		),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function parseHex(s: string): bigint {
	const clean = s.trim().toLowerCase().replace(/^0x/, "").replace(/\s+/g, "");
	return BigInt(`0x${clean}`);
}

function float32Breakdown(bits: number): object {
	const sign = (bits >>> 31) & 1;
	const exp = (bits >>> 23) & 0xff;
	const mantissa = bits & 0x7fffff;
	const biasedExp = exp - 127;
	const isNanBits = exp === 0xff && mantissa !== 0;
	const isInf = exp === 0xff && mantissa === 0;
	const isDenorm = exp === 0;
	return {
		sign,
		signDescription: sign === 0 ? "positive" : "negative",
		exponentRaw: exp,
		exponentBiased: biasedExp,
		mantissaRaw: mantissa,
		mantissaHex: `0x${mantissa.toString(16).toUpperCase().padStart(6, "0")}`,
		special: isNanBits
			? "NaN"
			: isInf
				? sign
					? "-Infinity"
					: "+Infinity"
				: isDenorm
					? "denormal"
					: "normal",
	};
}

function float64Breakdown(hi: number, lo: number): object {
	const sign = (hi >>> 31) & 1;
	const exp = (hi >>> 20) & 0x7ff;
	const mantissaHi = hi & 0xfffff;
	const biasedExp = exp - 1023;
	const isNanBits = exp === 0x7ff && (mantissaHi !== 0 || lo !== 0);
	const isInf = exp === 0x7ff && mantissaHi === 0 && lo === 0;
	const isDenorm = exp === 0;
	return {
		sign,
		signDescription: sign === 0 ? "positive" : "negative",
		exponentRaw: exp,
		exponentBiased: biasedExp,
		mantissaHiRaw: mantissaHi,
		mantissaLoRaw: lo >>> 0,
		special: isNanBits
			? "NaN"
			: isInf
				? sign
					? "-Infinity"
					: "+Infinity"
				: isDenorm
					? "denormal"
					: "normal",
	};
}

export function execute(input: Input): string {
	const buf = new ArrayBuffer(8);
	const view = new DataView(buf);

	switch (input.action) {
		case "float_to_hex": {
			const v = Number(input.value);
			view.setFloat32(0, v, false); // big-endian write
			const bits = view.getUint32(0, false);
			const leBuf = new ArrayBuffer(4);
			const leView = new DataView(leBuf);
			leView.setUint32(0, bits, true);
			const bytes: number[] = [];
			for (let i = 0; i < 4; i++) bytes.push(leView.getUint8(i));
			return JSON.stringify({
				input: v,
				bits32: bits,
				hex: `0x${bits.toString(16).toUpperCase().padStart(8, "0")}`,
				byteArrayLE: bytes,
				byteArrayLEHex: bytes
					.map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
					.join(" "),
				masmHex: `${bits.toString(16).toUpperCase().padStart(8, "0")}h`,
				ieee754: float32Breakdown(bits),
			});
		}
		case "double_to_hex": {
			const v = Number(input.value);
			view.setFloat64(0, v, false);
			const hi = view.getUint32(0, false);
			const lo = view.getUint32(4, false);
			const bits64 = (BigInt(hi) << 32n) | BigInt(lo >>> 0);
			const leBuf = new ArrayBuffer(8);
			const leView = new DataView(leBuf);
			leView.setBigUint64(0, bits64, true);
			const bytes: number[] = [];
			for (let i = 0; i < 8; i++) bytes.push(leView.getUint8(i));
			return JSON.stringify({
				input: v,
				hex: `0x${bits64.toString(16).toUpperCase().padStart(16, "0")}`,
				byteArrayLE: bytes,
				byteArrayLEHex: bytes
					.map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
					.join(" "),
				masmHex: `${bits64.toString(16).toUpperCase().padStart(16, "0")}h`,
				ieee754: float64Breakdown(hi, lo),
			});
		}
		case "hex_to_float": {
			const bits = parseHex(String(input.value));
			if (bits > 0xffffffffn)
				throw new Error(
					"hex_to_float requires a 32-bit value (max 0xFFFFFFFF)",
				);
			view.setUint32(0, Number(bits), false);
			const v = view.getFloat32(0, false);
			const floatStr = Number.isFinite(v)
				? v
				: Number.isNaN(v)
					? "NaN"
					: v > 0
						? "+Infinity"
						: "-Infinity";
			return JSON.stringify({
				input: `0x${bits.toString(16).toUpperCase().padStart(8, "0")}`,
				float: Number.isFinite(v) ? v : null,
				floatString: String(floatStr),
				isFinite: Number.isFinite(v),
				isNaN: Number.isNaN(v),
				ieee754: float32Breakdown(Number(bits)),
			});
		}
		case "hex_to_double": {
			const bits = parseHex(String(input.value));
			if (bits > 0xffffffffffffffffn)
				throw new Error("hex_to_double requires a 64-bit value");
			const hi = Number(bits >> 32n);
			const lo = Number(bits & 0xffffffffn);
			view.setUint32(0, hi, false);
			view.setUint32(4, lo, false);
			const v = view.getFloat64(0, false);
			return JSON.stringify({
				input: `0x${bits.toString(16).toUpperCase().padStart(16, "0")}`,
				double: Number.isFinite(v) ? v : null,
				doubleString: String(v),
				isFinite: Number.isFinite(v),
				isNaN: Number.isNaN(v),
				ieee754: float64Breakdown(hi, lo),
			});
		}
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_float",
	description:
		"IEEE 754 float/double encoding for x87/SSE/MASM: convert decimal numbers to 32-bit float or 64-bit double hex representation (and back), with full sign/exponent/mantissa breakdown.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
