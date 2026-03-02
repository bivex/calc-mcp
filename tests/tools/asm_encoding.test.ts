import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_encoding.js";

describe("asm_encoding", () => {
	describe("modrm_encode", () => {
		test("mod=3 reg=0 rm=1 → 0xC1", () => {
			const r = JSON.parse(
				execute({ action: "modrm_encode", mod: 3, reg: 0, rm: 1 }),
			);
			expect(r.byte).toBe(0xc1);
			expect(r.hex).toBe("0xC1");
		});

		test("mod=0 reg=1 rm=2 → 0x0A", () => {
			const r = JSON.parse(
				execute({ action: "modrm_encode", mod: 0, reg: 1, rm: 2 }),
			);
			expect(r.byte).toBe(0x0a);
		});

		test("includes binary field", () => {
			const r = JSON.parse(
				execute({ action: "modrm_encode", mod: 3, reg: 0, rm: 0 }),
			);
			expect(r.binary).toBe("0b11000000");
		});
	});

	describe("modrm_decode", () => {
		test("0xC1 → mod=3 reg=0 rm=1", () => {
			const r = JSON.parse(execute({ action: "modrm_decode", byte: 0xc1 }));
			expect(r.mod).toBe(3);
			expect(r.reg).toBe(0);
			expect(r.rm).toBe(1);
		});

		test("SIB required when mod!=3 and rm=4", () => {
			const r = JSON.parse(execute({ action: "modrm_decode", byte: 0x04 })); // mod=0 reg=0 rm=4
			expect(r.sibRequired).toBe(true);
		});

		test("throws if no byte", () => {
			expect(() => execute({ action: "modrm_decode" })).toThrow(/byte/);
		});

		test("round-trip encode/decode", () => {
			const enc = JSON.parse(
				execute({ action: "modrm_encode", mod: 2, reg: 3, rm: 5 }),
			);
			const dec = JSON.parse(
				execute({ action: "modrm_decode", byte: enc.byte }),
			);
			expect(dec.mod).toBe(2);
			expect(dec.reg).toBe(3);
			expect(dec.rm).toBe(5);
		});
	});

	describe("sib_encode", () => {
		test("scale=4 index=1 base=0 → correct byte", () => {
			const r = JSON.parse(
				execute({ action: "sib_encode", scale: 4, index: 1, base: 0 }),
			);
			// scale=4 → scaleField=2 (0b10), index=1, base=0 → byte = 0b10_001_000 = 0x88
			expect(r.byte).toBe(0x88);
		});

		test("scale=1 index=4 (none) base=5", () => {
			const r = JSON.parse(
				execute({ action: "sib_encode", scale: 1, index: 4, base: 5 }),
			);
			expect(r.description).toContain("EBP");
		});
	});

	describe("sib_decode", () => {
		test("0x88 → scale=4 index=1 base=0", () => {
			const r = JSON.parse(execute({ action: "sib_decode", byte: 0x88 }));
			expect(r.scale).toBe(4);
			expect(r.index).toBe(1);
			expect(r.base).toBe(0);
		});

		test("round-trip", () => {
			const enc = JSON.parse(
				execute({ action: "sib_encode", scale: 2, index: 3, base: 6 }),
			);
			const dec = JSON.parse(execute({ action: "sib_decode", byte: enc.byte }));
			expect(dec.scale).toBe(2);
			expect(dec.index).toBe(3);
			expect(dec.base).toBe(6);
		});
	});

	describe("imm_encode / little_endian", () => {
		test("0x1234 as 16-bit → [34 12]", () => {
			const r = JSON.parse(
				execute({ action: "imm_encode", value: "0x1234", bits: 16 }),
			);
			expect(r.bytes).toEqual([0x34, 0x12]);
			expect(r.byteArray).toBe("34 12");
		});

		test("0xDEADBEEF as 32-bit → 4 bytes LE", () => {
			const r = JSON.parse(
				execute({ action: "little_endian", value: "0xDEADBEEF", bits: 32 }),
			);
			expect(r.bytes).toEqual([0xef, 0xbe, 0xad, 0xde]);
		});

		test("single byte", () => {
			const r = JSON.parse(
				execute({ action: "imm_encode", value: "0xFF", bits: 8 }),
			);
			expect(r.bytes).toEqual([0xff]);
		});
	});

	describe("disp_encode", () => {
		test("8-bit displacement 0x10", () => {
			const r = JSON.parse(
				execute({ action: "disp_encode", value: "0x10", bits: 8 }),
			);
			expect(r.bytes).toEqual([0x10]);
		});

		test("32-bit displacement 0x1234", () => {
			const r = JSON.parse(
				execute({ action: "disp_encode", value: "0x1234", bits: 32 }),
			);
			expect(r.bytes).toEqual([0x34, 0x12, 0x00, 0x00]);
		});

		test("throws for 16-bit (not supported)", () => {
			expect(() =>
				execute({ action: "disp_encode", value: "1", bits: 16 }),
			).toThrow(/8-bit.*32-bit|32-bit.*8-bit/i);
		});
	});

	describe("big_endian", () => {
		test("0x1234 as 16-bit big-endian → [12 34]", () => {
			const r = JSON.parse(
				execute({ action: "big_endian", value: "0x1234", bits: 16 }),
			);
			expect(r.bytes).toEqual([0x12, 0x34]);
		});
	});
});
