import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/asm_struct.js";

describe("asm_struct", () => {
	describe("struct_layout", () => {
		test("simple byte+dword with natural align", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					fields: [
						{ name: "a", type: "byte" },
						{ name: "b", type: "dword" },
					],
				}),
			);
			// 'a' at offset 0, padding 3, 'b' at offset 4
			const a = r.fields.find((f: { name: string }) => f.name === "a");
			const b = r.fields.find((f: { name: string }) => f.name === "b");
			expect(a.offset).toBe(0);
			expect(b.offset).toBe(4);
			expect(b.paddingBefore).toBe(3);
			expect(r.totalSize).toBe(8);
		});

		test("all dwords, no padding", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					fields: [
						{ name: "x", type: "dword" },
						{ name: "y", type: "dword" },
					],
				}),
			);
			expect(r.fields[0].offset).toBe(0);
			expect(r.fields[1].offset).toBe(4);
			expect(r.fields[0].paddingBefore).toBe(0);
			expect(r.totalSize).toBe(8);
		});

		test("align=1 forces no padding", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					align: 1,
					fields: [
						{ name: "a", type: "byte" },
						{ name: "b", type: "dword" },
					],
				}),
			);
			expect(r.fields[1].offset).toBe(1);
			expect(r.fields[1].paddingBefore).toBe(0);
		});

		test("array field with count", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					fields: [{ name: "buf", type: "byte", count: 4 }],
				}),
			);
			expect(r.fields[0].totalSize).toBe(4);
			expect(r.totalSize).toBe(4);
		});

		test("word+dword alignment", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					fields: [
						{ name: "a", type: "word" },
						{ name: "b", type: "dword" },
					],
				}),
			);
			// word at 0, padding 2, dword at 4
			expect(r.fields[1].offset).toBe(4);
		});

		test("custom size via size field", () => {
			const r = JSON.parse(
				execute({
					action: "struct_layout",
					align: 1,
					fields: [{ name: "custom", size: 3 }],
				}),
			);
			expect(r.fields[0].elementSize).toBe(3);
		});

		test("throws if no fields", () => {
			expect(() => execute({ action: "struct_layout", fields: [] })).toThrow(
				/fields/,
			);
		});
	});

	describe("field_offset", () => {
		test("get offset of b", () => {
			const r = JSON.parse(
				execute({
					action: "field_offset",
					fieldName: "b",
					fields: [
						{ name: "a", type: "byte" },
						{ name: "b", type: "dword" },
					],
				}),
			);
			expect(r.offset).toBe(4);
			expect(r.offsetHex).toBe("0x4");
		});

		test("throws if field not found", () => {
			expect(() =>
				execute({
					action: "field_offset",
					fieldName: "z",
					fields: [{ name: "a", type: "byte" }],
				}),
			).toThrow(/not found/);
		});

		test("throws if no fieldName", () => {
			expect(() =>
				execute({
					action: "field_offset",
					fields: [{ name: "a", type: "byte" }],
				}),
			).toThrow(/fieldName/);
		});
	});

	describe("struct_size", () => {
		test("total size matches layout", () => {
			const r = JSON.parse(
				execute({
					action: "struct_size",
					fields: [
						{ name: "a", type: "byte" },
						{ name: "b", type: "dword" },
					],
				}),
			);
			expect(r.totalSize).toBe(8);
			expect(r.totalSizeHex).toBe("0x8");
		});
	});
});
