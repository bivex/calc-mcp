import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_registers.js";

describe("asm_registers", () => {
	describe("reg_info", () => {
		test("rax info", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "rax" }));
			expect(r.size).toBe(64);
			expect(r.bytes).toBe(8);
			expect(r.family).toBe("rax");
			expect(r.encoding).toBe(0);
			expect(r.type).toBe("gpr");
		});

		test("eax info", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "eax" }));
			expect(r.size).toBe(32);
			expect(r.family).toBe("rax");
		});

		test("al info", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "al" }));
			expect(r.size).toBe(8);
			expect(r.highByte).toBe(false);
		});

		test("ah is high byte", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "ah" }));
			expect(r.highByte).toBe(true);
		});

		test("xmm0 info", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "xmm0" }));
			expect(r.size).toBe(128);
			expect(r.type).toBe("xmm");
		});

		test("cs segment register", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "cs" }));
			expect(r.type).toBe("segment");
			expect(r.size).toBe(16);
		});

		test("r8 requires REX", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "r8" }));
			expect(r.requiresREX).toBe(true);
			expect(r.encoding).toBe(8);
		});

		test("throws unknown register", () => {
			expect(() => execute({ action: "reg_info", register: "zax" })).toThrow(
				/Unknown register/,
			);
		});

		test("case insensitive", () => {
			const r = JSON.parse(execute({ action: "reg_info", register: "EAX" }));
			expect(r.name).toBe("eax");
		});
	});

	describe("reg_parts", () => {
		test("rax parts include all views", () => {
			const r = JSON.parse(execute({ action: "reg_parts", register: "rax" }));
			expect(r.parts).toContain("eax");
			expect(r.parts).toContain("ax");
			expect(r.parts).toContain("al");
			expect(r.parts).toContain("ah");
		});

		test("al parts", () => {
			const r = JSON.parse(execute({ action: "reg_parts", register: "al" }));
			expect(r.parts).toContain("al");
		});
	});

	describe("reg_aliases", () => {
		test("ax aliases include 64-bit", () => {
			const r = JSON.parse(execute({ action: "reg_aliases", register: "ax" }));
			expect(r.aliases).toContain("rax");
			expect(r.aliases).toContain("eax");
			expect(r.aliases).toContain("ax");
			expect(r.aliases).toContain("al");
		});
	});

	describe("reg_size", () => {
		test("rsp size", () => {
			const r = JSON.parse(execute({ action: "reg_size", register: "rsp" }));
			expect(r.size).toBe(64);
			expect(r.bytes).toBe(8);
		});

		test("spl size", () => {
			const r = JSON.parse(execute({ action: "reg_size", register: "spl" }));
			expect(r.size).toBe(8);
		});

		test("ymm0 size", () => {
			const r = JSON.parse(execute({ action: "reg_size", register: "ymm0" }));
			expect(r.size).toBe(256);
		});
	});
});
