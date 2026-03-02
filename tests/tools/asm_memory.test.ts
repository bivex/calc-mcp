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
import { execute } from "../../src/tools/asm_memory.js";

describe("asm_memory", () => {
	describe("size_info", () => {
		test("byte info", () => {
			const r = JSON.parse(execute({ action: "size_info", dataType: "byte" }));
			expect(r.bits).toBe(8);
			expect(r.bytes).toBe(1);
			expect(r.maxUnsigned).toBe("255");
			expect(r.minSigned).toBe("-128");
			expect(r.maxSigned).toBe("127");
		});

		test("word info", () => {
			const r = JSON.parse(execute({ action: "size_info", dataType: "word" }));
			expect(r.bits).toBe(16);
			expect(r.bytes).toBe(2);
			expect(r.maxUnsigned).toBe("65535");
		});

		test("dword info", () => {
			const r = JSON.parse(execute({ action: "size_info", dataType: "dword" }));
			expect(r.bits).toBe(32);
			expect(r.maxUnsigned).toBe("4294967295");
		});

		test("qword info", () => {
			const r = JSON.parse(execute({ action: "size_info", dataType: "qword" }));
			expect(r.bits).toBe(64);
			expect(r.maxUnsigned).toBe((2n ** 64n - 1n).toString());
		});

		test("throws if no dataType", () => {
			expect(() => execute({ action: "size_info" })).toThrow(/dataType/);
		});
	});

	describe("twos_complement", () => {
		test("positive value stays same", () => {
			const r = JSON.parse(
				execute({ action: "twos_complement", dataType: "byte", value: "127" }),
			);
			expect(r.signed).toBe("127");
			expect(r.unsigned).toBe("127");
		});

		test("0xFF = -1 signed", () => {
			const r = JSON.parse(
				execute({ action: "twos_complement", dataType: "byte", value: "0xFF" }),
			);
			expect(r.signed).toBe("-1");
			expect(r.unsigned).toBe("255");
		});

		test("0x80 = -128 signed byte", () => {
			const r = JSON.parse(
				execute({ action: "twos_complement", dataType: "byte", value: "0x80" }),
			);
			expect(r.signed).toBe("-128");
		});

		test("-1 as word", () => {
			const r = JSON.parse(
				execute({
					action: "twos_complement",
					dataType: "word",
					value: "0xFFFF",
				}),
			);
			expect(r.signed).toBe("-1");
		});

		test("includes binary output", () => {
			const r = JSON.parse(
				execute({ action: "twos_complement", dataType: "byte", value: "255" }),
			);
			expect(r.binary).toBe("0b11111111");
		});
	});

	describe("sign_extend", () => {
		test("positive 8→16 no change", () => {
			const r = JSON.parse(
				execute({
					action: "sign_extend",
					value: "0x7F",
					fromBits: 8,
					toBits: 16,
				}),
			);
			expect(r.result).toBe("127");
			expect(r.signedResult).toBe("127");
		});

		test("negative 8→16 fills with 1s", () => {
			const r = JSON.parse(
				execute({
					action: "sign_extend",
					value: "0xFF",
					fromBits: 8,
					toBits: 16,
				}),
			);
			expect(r.signedResult).toBe("-1");
			expect(r.hex).toBe("0xFFFF");
		});

		test("negative 8→32", () => {
			const r = JSON.parse(
				execute({
					action: "sign_extend",
					value: "0x80",
					fromBits: 8,
					toBits: 32,
				}),
			);
			expect(r.signedResult).toBe("-128");
		});

		test("throws toBits < fromBits", () => {
			expect(() =>
				execute({ action: "sign_extend", value: "1", fromBits: 16, toBits: 8 }),
			).toThrow(/toBits/);
		});
	});

	describe("effective_address", () => {
		test("base only", () => {
			const r = JSON.parse(
				execute({ action: "effective_address", base: "0x1000" }),
			);
			expect(r.effectiveAddress).toBe("4096");
		});

		test("base + displacement", () => {
			const r = JSON.parse(
				execute({
					action: "effective_address",
					base: "0x1000",
					displacement: "0x10",
				}),
			);
			expect(r.effectiveAddress).toBe("4112");
		});

		test("base + index*scale + disp", () => {
			const r = JSON.parse(
				execute({
					action: "effective_address",
					base: "0x1000",
					index: "4",
					scale: 4,
					displacement: "8",
				}),
			);
			expect(r.effectiveAddress).toBe("4120"); // 0x1000 + 4*4 + 8 = 4096+16+8 = 4120
		});

		test("no args = 0", () => {
			const r = JSON.parse(execute({ action: "effective_address" }));
			expect(r.effectiveAddress).toBe("0");
		});
	});

	describe("segment_offset", () => {
		test("classic 0000:0100 = 0x100", () => {
			const r = JSON.parse(
				execute({
					action: "segment_offset",
					segment: "0x0000",
					offset: "0x0100",
				}),
			);
			expect(r.linear).toBe("256");
		});

		test("FFFF:000F = 0x1000E (wrap-around)", () => {
			const r = JSON.parse(
				execute({
					action: "segment_offset",
					segment: "0xFFFF",
					offset: "0x000F",
				}),
			);
			expect(r.linear).toBe((0xffff0n + 0x000fn).toString());
		});

		test("1000:0500 = linear 0x10500", () => {
			const r = JSON.parse(
				execute({
					action: "segment_offset",
					segment: "0x1000",
					offset: "0x0500",
				}),
			);
			expect(r.linearHex).toBe("0x10500");
		});

		test("throws if segment out of range", () => {
			expect(() =>
				execute({ action: "segment_offset", segment: "0x10000", offset: "0" }),
			).toThrow(/segment/);
		});
	});

	describe("fit_check", () => {
		test("255 fits in byte unsigned", () => {
			const r = JSON.parse(
				execute({ action: "fit_check", dataType: "byte", value: "255" }),
			);
			expect(r.fitsUnsigned).toBe(true);
			expect(r.fitsSigned).toBe(false);
		});

		test("127 fits in byte both", () => {
			const r = JSON.parse(
				execute({ action: "fit_check", dataType: "byte", value: "127" }),
			);
			expect(r.fitsUnsigned).toBe(true);
			expect(r.fitsSigned).toBe(true);
		});

		test("256 does not fit in byte", () => {
			const r = JSON.parse(
				execute({ action: "fit_check", dataType: "byte", value: "256" }),
			);
			expect(r.fitsUnsigned).toBe(false);
			expect(r.fitsSigned).toBe(false);
			expect(r.fitsEither).toBe(false);
		});

		test("-128 fits signed byte not unsigned", () => {
			const r = JSON.parse(
				execute({ action: "fit_check", dataType: "byte", value: "-128" }),
			);
			expect(r.fitsSigned).toBe(true);
			expect(r.fitsUnsigned).toBe(false);
		});

		test("65535 fits in word unsigned", () => {
			const r = JSON.parse(
				execute({ action: "fit_check", dataType: "word", value: "65535" }),
			);
			expect(r.fitsUnsigned).toBe(true);
		});
	});
});
