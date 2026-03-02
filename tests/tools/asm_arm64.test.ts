/**
 * Copyright (c) 2026 Bivex
 *
 * Author: Bivex
 * Available for contact via email: support@b-b.top
 * For up-to-date contact information:
 * https://github.com/bivex
 *
 * Created: 2026-03-02 19:28
 * Last Updated: 2026-03-02 19:28
 *
 * Licensed under the MIT License.
 * Commercial licensing available upon request.
 */

import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_arm64";

describe("asm_arm64", () => {
	describe("reg_info", () => {
		test("x0 is argument/result, 64-bit, caller-saved", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "x0" }));
			expect(r.bits).toBe(64);
			expect(r.role).toBe("argument/result");
			expect(r.calleeSaved).toBe(false);
			expect(r.callerSaved).toBe(true);
		});
		test("w0 resolves to same info as x0 (alias)", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "w0" }));
			expect(r.canonical).toBe("x0");
			expect(r.bits).toBe(64);
		});
		test("x19 is callee-saved", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "x19" }));
			expect(r.calleeSaved).toBe(true);
		});
		test("x29 is frame-pointer (callee-saved)", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "x29" }));
			expect(r.role).toBe("frame-pointer");
			expect(r.calleeSaved).toBe(true);
		});
		test("fp alias resolves to x29", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "fp" }));
			expect(r.canonical).toBe("x29");
		});
		test("x30 is link-register", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "x30" }));
			expect(r.role).toBe("link-register");
		});
		test("lr alias resolves to x30", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "lr" }));
			expect(r.canonical).toBe("x30");
		});
		test("sp is stack-pointer", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "sp" }));
			expect(r.role).toBe("stack-pointer");
		});
		test("xzr is zero-register", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "xzr" }));
			expect(r.role).toBe("zero-register");
		});
		test("x18 is platform-reserved", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "x18" }));
			expect(r.role).toBe("platform-reserved");
		});
		test("v0 is simd-fp 128-bit", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "v0" }));
			expect(r.bits).toBe(128);
			expect(r.role).toBe("simd-fp");
		});
		test("d8 alias resolves to v8 (callee-saved lower 64b)", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "d8" }));
			expect(r.canonical).toBe("v8");
			expect(r.calleeSaved).toBe(true);
		});
		test("s0 resolves to v0 (caller-saved)", () => {
			const r = JSON.parse(execute({ action: "reg_info", value: "s0" }));
			expect(r.canonical).toBe("v0");
			expect(r.calleeSaved).toBe(false);
		});
		test("unknown register throws", () => {
			expect(() => execute({ action: "reg_info", value: "eax" })).toThrow();
		});
		test("missing value throws", () => {
			expect(() => execute({ action: "reg_info" })).toThrow();
		});
	});

	describe("reg_parts", () => {
		test("x0 → w0 (64/32 pair)", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "x0" }));
			expect(r.x64).toBe("x0");
			expect(r.w32).toBe("w0");
		});
		test("w7 → x7", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "w7" }));
			expect(r.x64).toBe("x7");
			expect(r.w32).toBe("w7");
		});
		test("sp → wsp", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "sp" }));
			expect(r.x64).toBe("sp");
			expect(r.w32).toBe("wsp");
		});
		test("xzr → wzr", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "xzr" }));
			expect(r.x64).toBe("xzr");
			expect(r.w32).toBe("wzr");
		});
		test("lr → x30", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "lr" }));
			expect(r.canonical).toBe("x30");
		});
		test("v0 → all SIMD widths", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "v0" }));
			expect(r.q128).toBe("q0");
			expect(r.d64).toBe("d0");
			expect(r.s32).toBe("s0");
			expect(r.h16).toBe("h0");
			expect(r.b8).toBe("b0");
		});
		test("d15 → v15 SIMD parts", () => {
			const r = JSON.parse(execute({ action: "reg_parts", value: "d15" }));
			expect(r.v128).toBe("v15");
			expect(r.calleeSaved).toContain("d15");
		});
	});

	describe("calling_convention", () => {
		test("integer args start with x0", () => {
			const r = JSON.parse(execute({ action: "calling_convention" }));
			expect(r.integerArgs[0]).toBe("x0");
			expect(r.integerArgs[7]).toBe("x7");
		});
		test("float args start with v0", () => {
			const r = JSON.parse(execute({ action: "calling_convention" }));
			expect(r.floatArgs[0]).toBe("v0");
		});
		test("x19 is callee-saved", () => {
			const r = JSON.parse(execute({ action: "calling_convention" }));
			expect(r.calleeSaved.some((s: string) => s.startsWith("x19"))).toBe(true);
		});
		test("with argCount=3 returns per-arg mapping", () => {
			const r = JSON.parse(
				execute({ action: "calling_convention", argCount: 3 }),
			);
			expect(r.argsForFunction[0].integerRegister).toBe("x0");
			expect(r.argsForFunction[2].integerRegister).toBe("x2");
		});
		test("9th arg goes to stack", () => {
			const r = JSON.parse(
				execute({ action: "calling_convention", argCount: 9 }),
			);
			expect(r.argsForFunction[8].location).toBe("stack");
		});
	});

	describe("syscall_info", () => {
		test("write syscall x16=0x2000004", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "write" }));
			expect(r.nr).toBe(4);
			expect(r.x16).toBe("0x2000004");
		});
		test("exit syscall first arg in x0", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "exit" }));
			expect(r.argsWithRegisters[0].register).toBe("x0");
		});
		test("asm example uses svc #0x80", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "write" }));
			expect(r.asmExample.some((l: string) => l === "svc #0x80")).toBe(true);
		});
		test("asm example includes error check b.cs", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "read" }));
			expect(r.asmExample.some((l: string) => l.startsWith("b.cs"))).toBe(true);
		});
		test("unknown syscall throws", () => {
			expect(() =>
				execute({ action: "syscall_info", value: "bogus" }),
			).toThrow();
		});
		test("no value returns list with abi info", () => {
			const r = JSON.parse(execute({ action: "syscall_info" }));
			expect(r.abi.syscallRegister).toBe("x16");
			expect(r.abi.instruction).toBe("svc #0x80");
			expect(r.syscalls.length).toBeGreaterThan(5);
		});
	});

	describe("condition_code", () => {
		test("eq → Z=1", () => {
			const r = JSON.parse(execute({ action: "condition_code", value: "eq" }));
			expect(r.flags).toBe("Z=1");
			expect(r.opposite).toBe("NE");
		});
		test("ge → N=V (signed >=)", () => {
			const r = JSON.parse(execute({ action: "condition_code", value: "ge" }));
			expect(r.flags).toBe("N=V");
		});
		test("hi → unsigned higher", () => {
			const r = JSON.parse(execute({ action: "condition_code", value: "hi" }));
			expect(r.flags).toBe("C=1 && Z=0");
		});
		test("includes branch example", () => {
			const r = JSON.parse(execute({ action: "condition_code", value: "ne" }));
			expect(r.examples.branch).toBe("b.ne target");
		});
		test("case-insensitive", () => {
			const r = JSON.parse(execute({ action: "condition_code", value: "EQ" }));
			expect(r.code).toBe("EQ");
		});
		test("unknown code throws", () => {
			expect(() =>
				execute({ action: "condition_code", value: "xy" }),
			).toThrow();
		});
		test("no value returns all codes", () => {
			const r = JSON.parse(execute({ action: "condition_code" }));
			expect(r.conditionCodes.eq).toBeDefined();
		});
	});

	describe("addressing_mode", () => {
		test("[x0] – base only", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0]" }),
			);
			expect(r.mode).toBe("base");
			expect(r.base).toBe("x0");
			expect(r.offset).toBe(0);
		});
		test("[x0, #8] – base+offset", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0, #8]" }),
			);
			expect(r.mode).toBe("base+offset");
			expect(r.offset).toBe(8);
		});
		test("[-4 offset via #-4]", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[sp, #-16]" }),
			);
			expect(r.offset).toBe(-16);
			expect(r.base).toBe("sp");
		});
		test("[x0, #8]! – pre-index", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0, #8]!" }),
			);
			expect(r.mode).toBe("pre-index");
			expect(r.offset).toBe(8);
		});
		test("[x0], #8 – post-index", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0], #8" }),
			);
			expect(r.mode).toBe("post-index");
			expect(r.offset).toBe(8);
			expect(r.effectiveAddress).toBe("[x0]");
		});
		test("[x0, x1] – base+reg", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0, x1]" }),
			);
			expect(r.mode).toBe("base+reg");
			expect(r.index).toBe("x1");
		});
		test("[x0, x1, lsl #2] – base+reg+shift", () => {
			const r = JSON.parse(
				execute({ action: "addressing_mode", value: "[x0, x1, lsl #2]" }),
			);
			expect(r.mode).toBe("base+reg+lsl");
			expect(r.extendAmount).toBe(2);
		});
		test("invalid expression throws", () => {
			expect(() =>
				execute({ action: "addressing_mode", value: "x0" }),
			).toThrow();
		});
		test("missing value throws", () => {
			expect(() => execute({ action: "addressing_mode" })).toThrow();
		});
	});
});
