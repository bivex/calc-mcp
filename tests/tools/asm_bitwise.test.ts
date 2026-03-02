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
import { execute } from "../../src/tools/asm_bitwise.js";

describe("asm_bitwise", () => {
	describe("and", () => {
		test("basic AND", () => {
			const r = JSON.parse(
				execute({ operation: "and", a: "0xFF", b: "0x0F", bits: 8 }),
			);
			expect(r.result).toBe("15");
			expect(r.hex).toBe("0x0F");
		});

		test("AND masks to bit width", () => {
			const r = JSON.parse(
				execute({ operation: "and", a: "0x1FF", b: "0xFF", bits: 8 }),
			);
			expect(r.result).toBe("255");
		});
	});

	describe("or", () => {
		test("basic OR", () => {
			const r = JSON.parse(
				execute({ operation: "or", a: "0xF0", b: "0x0F", bits: 8 }),
			);
			expect(r.result).toBe("255");
			expect(r.hex).toBe("0xFF");
		});
	});

	describe("xor", () => {
		test("XOR with itself = 0", () => {
			const r = JSON.parse(
				execute({ operation: "xor", a: "0xABCD", b: "0xABCD", bits: 16 }),
			);
			expect(r.result).toBe("0");
		});

		test("XOR toggle bits", () => {
			const r = JSON.parse(
				execute({ operation: "xor", a: "0xFF", b: "0x0F", bits: 8 }),
			);
			expect(r.result).toBe("240");
			expect(r.hex).toBe("0xF0");
		});
	});

	describe("not", () => {
		test("NOT 8-bit", () => {
			const r = JSON.parse(execute({ operation: "not", a: "0x00", bits: 8 }));
			expect(r.result).toBe("255");
			expect(r.hex).toBe("0xFF");
		});

		test("NOT 16-bit", () => {
			const r = JSON.parse(
				execute({ operation: "not", a: "0xFF00", bits: 16 }),
			);
			expect(r.result).toBe("255");
		});
	});

	describe("shl", () => {
		test("shift left by 4", () => {
			const r = JSON.parse(
				execute({ operation: "shl", a: "0x01", b: "4", bits: 8 }),
			);
			expect(r.result).toBe("16");
			expect(r.hex).toBe("0x10");
		});

		test("SHL masks overflow", () => {
			const r = JSON.parse(
				execute({ operation: "shl", a: "0x80", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("0");
		});
	});

	describe("shr", () => {
		test("shift right by 4", () => {
			const r = JSON.parse(
				execute({ operation: "shr", a: "0xF0", b: "4", bits: 8 }),
			);
			expect(r.result).toBe("15");
		});
	});

	describe("rol", () => {
		test("rotate left 8-bit", () => {
			// 0b10000001 ROL 1 = 0b00000011
			const r = JSON.parse(
				execute({ operation: "rol", a: "0x81", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("3");
		});

		test("rotate left full rotation = same", () => {
			const r = JSON.parse(
				execute({ operation: "rol", a: "0xAB", b: "8", bits: 8 }),
			);
			expect(r.result).toBe("171"); // 0xAB = 171
		});
	});

	describe("ror", () => {
		test("rotate right 8-bit", () => {
			// 0b00000011 ROR 1 = 0b10000001
			const r = JSON.parse(
				execute({ operation: "ror", a: "0x03", b: "1", bits: 8 }),
			);
			expect(r.result).toBe("129"); // 0x81
		});
	});

	describe("extract", () => {
		test("extract low nibble", () => {
			const r = JSON.parse(
				execute({
					operation: "extract",
					a: "0xAB",
					b: undefined,
					bits: 8,
					offset: 0,
					length: 4,
				}),
			);
			expect(r.result).toBe("11"); // 0xB
		});

		test("extract high nibble", () => {
			const r = JSON.parse(
				execute({
					operation: "extract",
					a: "0xAB",
					b: undefined,
					bits: 8,
					offset: 4,
					length: 4,
				}),
			);
			expect(r.result).toBe("10"); // 0xA
		});

		test("throws if no length", () => {
			expect(() =>
				execute({ operation: "extract", a: "0xAB", bits: 8 }),
			).toThrow(/length/);
		});
	});

	describe("insert", () => {
		test("insert low nibble", () => {
			// Insert 0xF into bits [0,4) of 0xA0
			const r = JSON.parse(
				execute({
					operation: "insert",
					a: "0xA0",
					bits: 8,
					offset: 0,
					length: 4,
					value: "0xF",
				}),
			);
			expect(r.result).toBe("175"); // 0xAF
		});

		test("insert high nibble", () => {
			// Insert 0x5 into bits [4,8) of 0x0B
			const r = JSON.parse(
				execute({
					operation: "insert",
					a: "0x0B",
					bits: 8,
					offset: 4,
					length: 4,
					value: "0x5",
				}),
			);
			expect(r.result).toBe("91"); // 0x5B
		});

		test("throws if no length", () => {
			expect(() =>
				execute({
					operation: "insert",
					a: "0xAB",
					bits: 8,
					offset: 0,
					value: "1",
				}),
			).toThrow(/length/);
		});

		test("throws if no value", () => {
			expect(() =>
				execute({
					operation: "insert",
					a: "0xAB",
					bits: 8,
					offset: 0,
					length: 4,
				}),
			).toThrow(/value/);
		});
	});

	describe("binary string input", () => {
		test("0b prefix", () => {
			const r = JSON.parse(
				execute({
					operation: "and",
					a: "0b11110000",
					b: "0b00001111",
					bits: 8,
				}),
			);
			expect(r.result).toBe("0");
		});
	});

	describe("output format", () => {
		test("includes hex and binary", () => {
			const r = JSON.parse(execute({ operation: "or", a: 255, b: 0, bits: 8 }));
			expect(r.hex).toBe("0xFF");
			expect(r.binary).toBe("0b11111111");
		});
	});

	describe("32-bit", () => {
		test("AND 32-bit values", () => {
			const r = JSON.parse(
				execute({
					operation: "and",
					a: "0xDEADBEEF",
					b: "0x0000FFFF",
					bits: 32,
				}),
			);
			expect(r.result).toBe("48879"); // 0xBEEF
		});
	});

	describe("64-bit", () => {
		test("SHL 64-bit", () => {
			const r = JSON.parse(
				execute({ operation: "shl", a: "1", b: "63", bits: 64 }),
			);
			expect(r.result).toBe((1n << 63n).toString());
		});
	});
});
