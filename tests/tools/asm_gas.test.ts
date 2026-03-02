import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_gas";

describe("asm_gas", () => {
	describe("parse_immediate", () => {
		test("$42 → 42", () => {
			const r = JSON.parse(
				execute({ action: "parse_immediate", value: "$42" }),
			);
			expect(r.value).toBe(42);
			expect(r.gasHex).toBe("$0x2A");
		});
		test("$0xFF → 255", () => {
			const r = JSON.parse(
				execute({ action: "parse_immediate", value: "$0xFF" }),
			);
			expect(r.value).toBe(255);
		});
		test("$-1 → -1", () => {
			const r = JSON.parse(
				execute({ action: "parse_immediate", value: "$-1" }),
			);
			expect(r.value).toBe(-1);
		});
		test("missing $ throws", () => {
			expect(() => execute({ action: "parse_immediate", value: "42" })).toThrow(
				/\$/,
			);
		});
	});

	describe("parse_register", () => {
		test("%eax → eax", () => {
			const r = JSON.parse(
				execute({ action: "parse_register", value: "%eax" }),
			);
			expect(r.name).toBe("eax");
			expect(r.intelFormat).toBe("eax");
		});
		test("%RBP case insensitive", () => {
			const r = JSON.parse(
				execute({ action: "parse_register", value: "%RBP" }),
			);
			expect(r.name).toBe("rbp");
		});
		test("missing % throws", () => {
			expect(() => execute({ action: "parse_register", value: "eax" })).toThrow(
				/%/,
			);
		});
	});

	describe("parse_memory", () => {
		test("8(%ebp) → disp=8 base=ebp", () => {
			const r = JSON.parse(
				execute({ action: "parse_memory", value: "8(%ebp)" }),
			);
			expect(r.displacement).toBe(8);
			expect(r.base).toBe("ebp");
			expect(r.index).toBeNull();
		});
		test("-4(%rbp) → negative disp", () => {
			const r = JSON.parse(
				execute({ action: "parse_memory", value: "-4(%rbp)" }),
			);
			expect(r.displacement).toBe(-4);
			expect(r.base).toBe("rbp");
		});
		test("(%eax,%ebx,4) → index+scale", () => {
			const r = JSON.parse(
				execute({ action: "parse_memory", value: "(%eax,%ebx,4)" }),
			);
			expect(r.base).toBe("eax");
			expect(r.index).toBe("ebx");
			expect(r.scale).toBe(4);
			expect(r.displacement).toBe(0);
		});
		test("intel syntax generated", () => {
			const r = JSON.parse(
				execute({ action: "parse_memory", value: "8(%ebp)" }),
			);
			expect(r.intelSyntax).toBe("[ebp+8]");
		});
		test("invalid format throws", () => {
			expect(() => execute({ action: "parse_memory", value: "eax" })).toThrow();
		});
	});

	describe("format_immediate", () => {
		test("255 → $0xFF", () => {
			const r = JSON.parse(execute({ action: "format_immediate", value: 255 }));
			expect(r.gasImmediate).toBe("$0xFF");
		});
		test("0 → $0x0", () => {
			const r = JSON.parse(execute({ action: "format_immediate", value: 0 }));
			expect(r.gasImmediate).toBe("$0x0");
		});
	});

	describe("format_register", () => {
		test("eax → %eax", () => {
			const r = JSON.parse(
				execute({ action: "format_register", value: "eax" }),
			);
			expect(r.gasFormat).toBe("%eax");
			expect(r.intelFormat).toBe("eax");
		});
		test("strips existing % prefix", () => {
			const r = JSON.parse(
				execute({ action: "format_register", value: "%rsp" }),
			);
			expect(r.gasFormat).toBe("%rsp");
		});
	});

	describe("format_memory", () => {
		test("base only", () => {
			const r = JSON.parse(execute({ action: "format_memory", base: "rsp" }));
			expect(r.gasFormat).toBe("(%rsp)");
			expect(r.intelSyntax).toBe("[rsp]");
		});
		test("base + offset", () => {
			const r = JSON.parse(
				execute({ action: "format_memory", base: "rbp", offset: -8 }),
			);
			expect(r.gasFormat).toBe("-8(%rbp)");
			expect(r.intelSyntax).toBe("[rbp-8]");
		});
		test("base + index + scale + offset", () => {
			const r = JSON.parse(
				execute({
					action: "format_memory",
					base: "eax",
					index: "ebx",
					scale: 4,
					offset: 8,
				}),
			);
			expect(r.gasFormat).toBe("8(%eax,%ebx,4)");
			expect(r.intelSyntax).toBe("[eax+ebx*4+8]");
		});
		test("missing base throws", () => {
			expect(() => execute({ action: "format_memory" })).toThrow(/base/);
		});
	});

	describe("suffix_for_size", () => {
		test("8 → b", () => {
			const r = JSON.parse(execute({ action: "suffix_for_size", value: 8 }));
			expect(r.suffix).toBe("b");
		});
		test("16 → w", () => {
			const r = JSON.parse(execute({ action: "suffix_for_size", value: 16 }));
			expect(r.suffix).toBe("w");
		});
		test("32 → l", () => {
			const r = JSON.parse(execute({ action: "suffix_for_size", value: 32 }));
			expect(r.suffix).toBe("l");
			expect(r.example).toBe("movl");
		});
		test("64 → q", () => {
			const r = JSON.parse(execute({ action: "suffix_for_size", value: 64 }));
			expect(r.suffix).toBe("q");
		});
		test("invalid size throws", () => {
			expect(() => execute({ action: "suffix_for_size", value: 48 })).toThrow();
		});
	});

	describe("size_for_suffix", () => {
		test("b → 8", () => {
			const r = JSON.parse(execute({ action: "size_for_suffix", value: "b" }));
			expect(r.bits).toBe(8);
		});
		test("l → 32", () => {
			const r = JSON.parse(execute({ action: "size_for_suffix", value: "l" }));
			expect(r.bits).toBe(32);
		});
		test("q → 64", () => {
			const r = JSON.parse(execute({ action: "size_for_suffix", value: "q" }));
			expect(r.bits).toBe(64);
		});
		test("unknown suffix throws", () => {
			expect(() =>
				execute({ action: "size_for_suffix", value: "z" }),
			).toThrow();
		});
	});

	describe("swap_operands", () => {
		test("AT&T src,dst ↔ Intel dst,src", () => {
			const r = JSON.parse(
				execute({ action: "swap_operands", src: "%eax", dst: "%ebx" }),
			);
			expect(r.att.formatted).toBe("%eax, %ebx");
			expect(r.intel.formatted).toBe("%ebx, %eax");
		});
		test("missing both throws", () => {
			expect(() => execute({ action: "swap_operands" })).toThrow();
		});
	});
});
