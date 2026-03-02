import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_numbers.js";

describe("asm_numbers", () => {
	describe("parse_masm_number", () => {
		test("hex suffix: 0FFh = 255", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "0FFh" }),
			);
			expect(r.decimal).toBe("255");
			expect(r.detectedBase).toBe("hex");
		});

		test("hex suffix: 1234h", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "1234h" }),
			);
			expect(r.decimal).toBe("4660");
		});

		test("binary suffix: 1010b = 10", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "1010b" }),
			);
			expect(r.decimal).toBe("10");
			expect(r.detectedBase).toBe("binary");
		});

		test("decimal suffix: 123d = 123", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "123d" }),
			);
			expect(r.decimal).toBe("123");
			expect(r.detectedBase).toBe("decimal");
		});

		test("octal suffix o: 777o = 511", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "777o" }),
			);
			expect(r.decimal).toBe("511");
			expect(r.detectedBase).toBe("octal");
		});

		test("octal suffix q: 10q = 8", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "10q" }),
			);
			expect(r.decimal).toBe("8");
		});

		test("0x prefix (C-style) works", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "0xFF" }),
			);
			expect(r.decimal).toBe("255");
		});

		test("plain decimal", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "42" }),
			);
			expect(r.decimal).toBe("42");
		});

		test("includes all format outputs", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "0FFh" }),
			);
			expect(r.masmHex).toBe("0FFh");
			expect(r.masmBin).toContain("b");
			expect(r.masmDec).toContain("d");
		});

		test("with bits=8 pads output", () => {
			const r = JSON.parse(
				execute({ action: "parse_masm_number", value: "0Fh", bits: 8 }),
			);
			expect(r.hex).toBe("0x0F");
		});

		test("throws on invalid hex digit", () => {
			expect(() =>
				execute({ action: "parse_masm_number", value: "0GGh" }),
			).toThrow(/hex/i);
		});
	});

	describe("format_masm", () => {
		test("255 → 0FFh", () => {
			const r = JSON.parse(execute({ action: "format_masm", value: "255" }));
			expect(r.masmHex).toBe("0FFh");
		});

		test("16 → 10h", () => {
			const r = JSON.parse(execute({ action: "format_masm", value: "16" }));
			expect(r.masmHex).toBe("10h");
		});

		test("0xFF input", () => {
			const r = JSON.parse(execute({ action: "format_masm", value: "0xFF" }));
			expect(r.masmHex).toBe("0FFh");
		});
	});

	describe("format_hex", () => {
		test("255 → 0xFF", () => {
			const r = JSON.parse(execute({ action: "format_hex", value: "255" }));
			expect(r.hex).toBe("0xFF");
		});

		test("255 with bits=8 padded", () => {
			const r = JSON.parse(
				execute({ action: "format_hex", value: "255", bits: 8 }),
			);
			expect(r.hex).toBe("0xFF");
		});

		test("1 with bits=16 padded", () => {
			const r = JSON.parse(
				execute({ action: "format_hex", value: "1", bits: 16 }),
			);
			expect(r.hex).toBe("0x0001");
		});
	});

	describe("format_bin", () => {
		test("10 → 0b1010", () => {
			const r = JSON.parse(execute({ action: "format_bin", value: "10" }));
			expect(r.binary).toBe("0b1010");
		});

		test("masmBin includes b suffix", () => {
			const r = JSON.parse(execute({ action: "format_bin", value: "10" }));
			expect(r.masmBin).toBe("1010b");
		});
	});

	describe("format_oct", () => {
		test("511 → 0o777", () => {
			const r = JSON.parse(execute({ action: "format_oct", value: "511" }));
			expect(r.octal).toBe("0o777");
			expect(r.masmOct).toBe("777o");
		});
	});

	describe("format_dec", () => {
		test("0xFF → 255d", () => {
			const r = JSON.parse(execute({ action: "format_dec", value: "0xFF" }));
			expect(r.masmDec).toBe("255d");
		});
	});
});
