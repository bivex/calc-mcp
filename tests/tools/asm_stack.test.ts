import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_stack.js";

describe("asm_stack", () => {
	describe("push", () => {
		test("32-bit push decrements SP by 4", () => {
			const r = JSON.parse(
				execute({ action: "push", wordSize: 4, stackPointer: "0x1000" }),
			);
			expect(r.stackPointerAfter).toBe("4092"); // 0x1000 - 4
			expect(r.delta).toBe("-4");
		});

		test("64-bit push decrements by 8", () => {
			const r = JSON.parse(
				execute({ action: "push", wordSize: 8, stackPointer: "0x1000" }),
			);
			expect(r.stackPointerAfter).toBe("4088"); // 0x1000 - 8
		});

		test("16-bit push decrements by 2", () => {
			const r = JSON.parse(
				execute({ action: "push", wordSize: 2, stackPointer: "0x100" }),
			);
			expect(r.stackPointerAfter).toBe("254"); // 0x100 - 2
		});

		test("includes effect description", () => {
			const r = JSON.parse(execute({ action: "push", wordSize: 4 }));
			expect(r.effect).toBe("SP = SP - 4");
		});
	});

	describe("pop", () => {
		test("32-bit pop increments SP by 4", () => {
			const r = JSON.parse(
				execute({ action: "pop", wordSize: 4, stackPointer: "0xFFC" }),
			);
			expect(r.stackPointerAfter).toBe("4096"); // 0xFFC + 4 = 0x1000
		});

		test("64-bit pop increments by 8", () => {
			const r = JSON.parse(
				execute({ action: "pop", wordSize: 8, stackPointer: "0xFF8" }),
			);
			expect(r.stackPointerAfter).toBe("4096");
		});
	});

	describe("stack_offset", () => {
		test("3 pushes 1 pop = net -8 (32-bit)", () => {
			const r = JSON.parse(
				execute({ action: "stack_offset", wordSize: 4, pushes: 3, pops: 1 }),
			);
			expect(r.netDelta).toBe(-8);
		});

		test("0 pushes 0 pops = 0", () => {
			const r = JSON.parse(
				execute({ action: "stack_offset", wordSize: 4, pushes: 0, pops: 0 }),
			);
			expect(r.netDelta).toBe(0);
		});

		test("2 pops, 0 pushes = +8", () => {
			const r = JSON.parse(
				execute({ action: "stack_offset", wordSize: 4, pushes: 0, pops: 2 }),
			);
			expect(r.netDelta).toBe(8);
		});

		test("includes per-direction deltas", () => {
			const r = JSON.parse(
				execute({ action: "stack_offset", wordSize: 4, pushes: 2, pops: 1 }),
			);
			expect(r.spChangeFromPushes).toBe("-8");
			expect(r.spChangeFromPops).toBe("4");
		});
	});

	describe("frame_offset", () => {
		test("standard 32-bit frame with 2 args", () => {
			const r = JSON.parse(
				execute({
					action: "frame_offset",
					wordSize: 4,
					argBytes: 8,
				}),
			);
			// Return addr at [ebp+4], args start at [ebp+8]
			expect(r.returnAddress.offset).toBe(4);
			expect(r.arguments[0].offsetExpr).toBe("[ebp+8]");
			expect(r.arguments[1].offsetExpr).toBe("[ebp+12]");
		});

		test("locals are negative offsets", () => {
			const r = JSON.parse(
				execute({
					action: "frame_offset",
					wordSize: 4,
					localBytes: 8,
				}),
			);
			expect(r.locals[0].offsetExpr).toBe("[ebp-4]");
			expect(r.locals[1].offsetExpr).toBe("[ebp-8]");
		});

		test("saved EBP always at offset 0", () => {
			const r = JSON.parse(execute({ action: "frame_offset", wordSize: 4 }));
			expect(r.savedEBP.offset).toBe(0);
		});

		test("includes prologue / epilogue example", () => {
			const r = JSON.parse(
				execute({ action: "frame_offset", wordSize: 4, localBytes: 4 }),
			);
			expect(r.prologueExample).toContain("push ebp");
			expect(r.prologueExample).toContain("sub esp, 4");
			expect(r.epilogueExample).toContain("pop ebp");
		});

		test("64-bit frame return addr at ebp+8", () => {
			const r = JSON.parse(execute({ action: "frame_offset", wordSize: 8 }));
			expect(r.returnAddress.offset).toBe(8);
		});
	});
});
