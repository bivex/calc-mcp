import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_macho";

describe("asm_macho", () => {
	describe("mangle_symbol", () => {
		test("main → _main", () => {
			const r = JSON.parse(execute({ action: "mangle_symbol", value: "main" }));
			expect(r.mangled).toBe("_main");
		});
		test("already prefixed stays the same", () => {
			const r = JSON.parse(
				execute({ action: "mangle_symbol", value: "_printf" }),
			);
			expect(r.mangled).toBe("_printf");
		});
		test("includes .globl directive", () => {
			const r = JSON.parse(
				execute({ action: "mangle_symbol", value: "start" }),
			);
			expect(r.gasDirective).toBe(".globl _start");
		});
		test("empty throws", () => {
			expect(() => execute({ action: "mangle_symbol", value: "" })).toThrow();
		});
	});

	describe("demangle_symbol", () => {
		test("_main → main", () => {
			const r = JSON.parse(
				execute({ action: "demangle_symbol", value: "_main" }),
			);
			expect(r.demangled).toBe("main");
			expect(r.hadPrefix).toBe(true);
		});
		test("no prefix stays the same", () => {
			const r = JSON.parse(
				execute({ action: "demangle_symbol", value: "func" }),
			);
			expect(r.demangled).toBe("func");
			expect(r.hadPrefix).toBe(false);
		});
	});

	describe("syscall_info", () => {
		test("write syscall", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "write" }));
			expect(r.nr).toBe(4);
			expect(r.rax).toBe("0x2000004");
		});
		test("read syscall", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "read" }));
			expect(r.nr).toBe(3);
			expect(r.rax).toBe("0x2000003");
		});
		test("exit syscall args in rdi", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "exit" }));
			expect(r.argsWithRegisters[0].register).toBe("rdi");
		});
		test("4th arg uses r10 not rcx", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "mmap" }));
			const argRegs = r.argRegisters;
			expect(argRegs[3]).toBe("r10");
		});
		test("includes GAS example", () => {
			const r = JSON.parse(execute({ action: "syscall_info", value: "write" }));
			expect(r.gasExample[0]).toBe("mov $0x2000004, %rax");
			expect(r.gasExample[1]).toBe("syscall");
		});
		test("unknown syscall throws", () => {
			expect(() =>
				execute({ action: "syscall_info", value: "nonexistent" }),
			).toThrow();
		});
		test("no value returns all syscalls", () => {
			const r = JSON.parse(execute({ action: "syscall_info" }));
			expect(Array.isArray(r.syscalls)).toBe(true);
			expect(r.syscalls.length).toBeGreaterThan(10);
		});
	});

	describe("section_info", () => {
		test(".text → __TEXT segment", () => {
			const r = JSON.parse(execute({ action: "section_info", value: ".text" }));
			expect(r.macosSegment).toBe("__TEXT");
			expect(r.access).toBe("r-x");
		});
		test(".data → __DATA segment", () => {
			const r = JSON.parse(execute({ action: "section_info", value: ".data" }));
			expect(r.macosSegment).toBe("__DATA");
		});
		test(".bss → zero fill", () => {
			const r = JSON.parse(execute({ action: "section_info", value: ".bss" }));
			expect(r.flags).toContain("ZEROFILL");
		});
		test("without dot prefix works", () => {
			const r = JSON.parse(execute({ action: "section_info", value: "text" }));
			expect(r.name).toBe(".text");
		});
		test("unknown section throws", () => {
			expect(() =>
				execute({ action: "section_info", value: ".unknown" }),
			).toThrow();
		});
		test("no value returns all sections", () => {
			const r = JSON.parse(execute({ action: "section_info" }));
			expect(r.sections[".text"]).toBeDefined();
		});
	});

	describe("calling_convention", () => {
		test("returns integer arg registers", () => {
			const r = JSON.parse(execute({ action: "calling_convention" }));
			expect(r.integerArgRegisters[0]).toBe("rdi");
			expect(r.integerArgRegisters[5]).toBe("r9");
		});
		test("callee-saved includes rbx", () => {
			const r = JSON.parse(execute({ action: "calling_convention" }));
			expect(r.calleeSaved).toContain("rbx");
			expect(r.calleeSaved).toContain("r12");
		});
		test("with value=3 returns arg mapping", () => {
			const r = JSON.parse(
				execute({ action: "calling_convention", value: "3" }),
			);
			expect(r.argsForFunction[0].register).toBe("rdi");
			expect(r.argsForFunction[1].register).toBe("rsi");
			expect(r.argsForFunction[2].register).toBe("rdx");
		});
		test("7th arg goes to stack", () => {
			const r = JSON.parse(
				execute({ action: "calling_convention", value: "7" }),
			);
			expect(r.argsForFunction[6].location).toBe("stack");
		});
	});

	describe("stack_alignment", () => {
		test("aligned stack", () => {
			const r = JSON.parse(
				execute({ action: "stack_alignment", stackDepth: 16 }),
			);
			expect(r.isAligned).toBe(true);
			expect(r.bytesNeededToPad).toBe(0);
		});
		test("unaligned needs padding", () => {
			const r = JSON.parse(
				execute({ action: "stack_alignment", stackDepth: 8 }),
			);
			expect(r.isAligned).toBe(false);
			expect(r.bytesNeededToPad).toBe(8);
		});
		test("0 depth is aligned", () => {
			const r = JSON.parse(
				execute({ action: "stack_alignment", stackDepth: 0 }),
			);
			expect(r.isAligned).toBe(true);
		});
		test("value parameter works too", () => {
			const r = JSON.parse(execute({ action: "stack_alignment", value: "24" }));
			expect(r.stackDepth).toBe(24);
		});
		test("no input throws", () => {
			expect(() => execute({ action: "stack_alignment" })).toThrow();
		});
	});
});
