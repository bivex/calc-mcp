import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_float.js";

describe("asm_float", () => {
	describe("float_to_hex", () => {
		test("1.0 → 0x3F800000", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: 1.0 }));
			expect(r.hex).toBe("0x3F800000");
		});

		test("-1.0 → 0xBF800000", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: -1.0 }));
			expect(r.hex).toBe("0xBF800000");
		});

		test("0.0 → 0x00000000", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: 0 }));
			expect(r.hex).toBe("0x00000000");
		});

		test("includes LE byte array", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: 1.0 }));
			expect(r.byteArrayLE).toEqual([0x00, 0x00, 0x80, 0x3f]);
		});

		test("includes IEEE 754 breakdown", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: 1.0 }));
			expect(r.ieee754.sign).toBe(0);
			expect(r.ieee754.exponentBiased).toBe(0);
			expect(r.ieee754.mantissaRaw).toBe(0);
		});

		test("MASM hex format", () => {
			const r = JSON.parse(execute({ action: "float_to_hex", value: 1.0 }));
			expect(r.masmHex).toBe("3F800000h");
		});
	});

	describe("double_to_hex", () => {
		test("1.0 → 0x3FF0000000000000", () => {
			const r = JSON.parse(execute({ action: "double_to_hex", value: 1.0 }));
			expect(r.hex).toBe("0x3FF0000000000000");
		});

		test("-1.0 sign bit set", () => {
			const r = JSON.parse(execute({ action: "double_to_hex", value: -1.0 }));
			expect(r.ieee754.sign).toBe(1);
		});

		test("includes LE byte array (8 bytes)", () => {
			const r = JSON.parse(execute({ action: "double_to_hex", value: 1.0 }));
			expect(r.byteArrayLE).toHaveLength(8);
		});
	});

	describe("hex_to_float", () => {
		test("0x3F800000 → 1.0", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_float", value: "0x3F800000" }),
			);
			expect(r.float).toBe(1.0);
		});

		test("0xBF800000 → -1.0", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_float", value: "0xBF800000" }),
			);
			expect(r.float).toBe(-1.0);
		});

		test("0x7F800000 → Infinity", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_float", value: "0x7F800000" }),
			);
			expect(r.floatString).toBe("+Infinity");
			expect(r.ieee754.special).toBe("+Infinity");
		});

		test("throws for value > 32 bits", () => {
			expect(() =>
				execute({ action: "hex_to_float", value: "0x100000000" }),
			).toThrow(/32-bit/);
		});
	});

	describe("hex_to_double", () => {
		test("0x3FF0000000000000 → 1.0", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_double", value: "0x3FF0000000000000" }),
			);
			expect(r.double).toBe(1.0);
		});

		test("0x0000000000000000 → 0.0", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_double", value: "0x0000000000000000" }),
			);
			expect(r.double).toBe(0.0);
		});

		test("isFinite for normal number", () => {
			const r = JSON.parse(
				execute({ action: "hex_to_double", value: "0x3FF0000000000000" }),
			);
			expect(r.isFinite).toBe(true);
			expect(r.isNaN).toBe(false);
		});
	});
});
