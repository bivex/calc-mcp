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

import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_flags.js";

describe("asm_flags", () => {
	describe("add", () => {
		test("0 + 0 = ZF set", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0", b: "0", bits: 8 }),
			);
			expect(r.flags.ZF).toBe(true);
			expect(r.flags.CF).toBe(false);
			expect(r.flags.SF).toBe(false);
		});

		test("0xFF + 0x01 = unsigned overflow (CF set)", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0xFF", b: "0x01", bits: 8 }),
			);
			expect(r.result).toBe("0");
			expect(r.flags.CF).toBe(true);
			expect(r.flags.ZF).toBe(true);
		});

		test("0x7F + 0x01 = signed overflow (OF set)", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0x7F", b: "0x01", bits: 8 }),
			);
			expect(r.flags.OF).toBe(true);
			expect(r.flags.SF).toBe(true);
			expect(r.flags.CF).toBe(false);
		});

		test("1 + 1 = SF clear", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "1", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("2");
			expect(r.flags.SF).toBe(false);
		});

		test("AF set on nibble carry", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0x0F", b: "0x01", bits: 8 }),
			);
			expect(r.flags.AF).toBe(true);
		});
	});

	describe("sub", () => {
		test("5 - 5 = ZF", () => {
			const r = JSON.parse(
				execute({ operation: "sub", a: "5", b: "5", bits: 8 }),
			);
			expect(r.flags.ZF).toBe(true);
			expect(r.flags.CF).toBe(false);
		});

		test("0 - 1 = CF (borrow)", () => {
			const r = JSON.parse(
				execute({ operation: "sub", a: "0", b: "1", bits: 8 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.result).toBe("255"); // -1 unsigned
		});

		test("0x80 - 0x01 = OF (signed overflow)", () => {
			// -128 - 1 = -129 overflows signed byte
			const r = JSON.parse(
				execute({ operation: "sub", a: "0x80", b: "0x01", bits: 8 }),
			);
			expect(r.flags.OF).toBe(true);
		});
	});

	describe("and", () => {
		test("CF and OF always cleared", () => {
			const r = JSON.parse(
				execute({ operation: "and", a: "0xFF", b: "0x01", bits: 8 }),
			);
			expect(r.flags.CF).toBe(false);
			expect(r.flags.OF).toBe(false);
		});

		test("AND to zero sets ZF", () => {
			const r = JSON.parse(
				execute({ operation: "and", a: "0xF0", b: "0x0F", bits: 8 }),
			);
			expect(r.flags.ZF).toBe(true);
		});
	});

	describe("or / xor", () => {
		test("OR CF and OF cleared", () => {
			const r = JSON.parse(
				execute({ operation: "or", a: "0x01", b: "0x02", bits: 8 }),
			);
			expect(r.flags.CF).toBe(false);
			expect(r.flags.OF).toBe(false);
		});

		test("XOR with itself = ZF", () => {
			const r = JSON.parse(
				execute({ operation: "xor", a: "0xAB", b: "0xAB", bits: 8 }),
			);
			expect(r.flags.ZF).toBe(true);
			expect(r.flags.CF).toBe(false);
		});
	});

	describe("shl", () => {
		test("SHL shifts out MSB sets CF", () => {
			const r = JSON.parse(
				execute({ operation: "shl", a: "0x80", b: "1", bits: 8 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.result).toBe("0");
			expect(r.flags.ZF).toBe(true);
		});

		test("SHL by 0 clears CF", () => {
			const r = JSON.parse(
				execute({ operation: "shl", a: "0x80", b: "0", bits: 8 }),
			);
			expect(r.flags.CF).toBe(false);
		});
	});

	describe("shr", () => {
		test("SHR shifts out LSB sets CF", () => {
			const r = JSON.parse(
				execute({ operation: "shr", a: "0x01", b: "1", bits: 8 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.result).toBe("0");
		});

		test("SHR MSB cleared: OF set if MSB was set", () => {
			const r = JSON.parse(
				execute({ operation: "shr", a: "0x80", b: "1", bits: 8 }),
			);
			expect(r.flags.OF).toBe(true);
		});
	});

	describe("sar", () => {
		test("SAR preserves sign bit", () => {
			const r = JSON.parse(
				execute({ operation: "sar", a: "0x80", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("192"); // 0xC0
			expect(r.flags.SF).toBe(true);
		});

		test("SAR positive shifts normally", () => {
			const r = JSON.parse(
				execute({ operation: "sar", a: "0x40", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("32");
		});
	});

	describe("mul", () => {
		test("2 * 3 = 6, CF and OF clear", () => {
			const r = JSON.parse(
				execute({ operation: "mul", a: "2", b: "3", bits: 8 }),
			);
			expect(r.result).toBe("6");
			expect(r.flags.CF).toBe(false);
			expect(r.flags.OF).toBe(false);
		});

		test("overflow sets CF and OF", () => {
			const r = JSON.parse(
				execute({ operation: "mul", a: "0xFF", b: "0xFF", bits: 8 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.flags.OF).toBe(true);
		});
	});

	describe("imul", () => {
		test("2 * -1 = no overflow in 8-bit", () => {
			// 2 * 0xFF (= -1 signed) = -2, fits in signed byte
			const r = JSON.parse(
				execute({ operation: "imul", a: "2", b: "0xFF", bits: 8 }),
			);
			expect(r.flags.CF).toBe(false);
			expect(r.flags.OF).toBe(false);
		});

		test("overflow sets CF and OF", () => {
			const r = JSON.parse(
				execute({ operation: "imul", a: "0x7F", b: "0x7F", bits: 8 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.flags.OF).toBe(true);
		});
	});

	describe("parity flag", () => {
		test("0x01 has odd parity → PF false", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0", b: "1", bits: 8 }),
			);
			expect(r.flags.PF).toBe(false);
		});

		test("0x03 has even parity (2 bits) → PF true", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0", b: "3", bits: 8 }),
			);
			expect(r.flags.PF).toBe(true);
		});
	});

	describe("output structure", () => {
		test("includes flagsDescription", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "1", b: "1", bits: 8 }),
			);
			expect(r.flagsDescription).toBeDefined();
			expect(r.flagsDescription.CF).toContain("Carry");
		});

		test("32-bit add", () => {
			const r = JSON.parse(
				execute({ operation: "add", a: "0xFFFFFFFF", b: "1", bits: 32 }),
			);
			expect(r.flags.CF).toBe(true);
			expect(r.result).toBe("0");
		});
	});
});
