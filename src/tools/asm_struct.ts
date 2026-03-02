import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const TYPE_SIZES: Record<string, number> = {
	byte: 1,
	BYTE: 1,
	word: 2,
	WORD: 2,
	dword: 4,
	DWORD: 4,
	int: 4,
	UINT: 4,
	LONG: 4,
	qword: 8,
	QWORD: 8,
	// Pointers (32/64-bit context)
	ptr32: 4,
	PTR32: 4,
	ptr64: 8,
	PTR64: 8,
	// Floating point
	real4: 4,
	REAL4: 4,
	float: 4,
	real8: 8,
	REAL8: 8,
	double: 8,
	real10: 10,
	REAL10: 10,
};

const fieldSchema = z.object({
	name: z.string().describe("Field name"),
	type: z
		.string()
		.optional()
		.describe("MASM data type (byte, word, dword, qword, real4, real8, etc.)"),
	size: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe("Custom size in bytes (overrides type)"),
	count: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe("Array count (default: 1)"),
});

const schema = {
	action: z
		.enum(["struct_layout", "field_offset", "struct_size"])
		.describe("Action: struct_layout | field_offset | struct_size"),
	fields: z
		.array(fieldSchema)
		.optional()
		.describe("Array of struct fields: {name, type?, size?, count?}"),
	align: z
		.number()
		.refine((v) => [1, 2, 4, 8, 16].includes(v), {
			message: "align must be 1, 2, 4, 8, or 16",
		})
		.optional()
		.describe(
			"Struct alignment (default: natural alignment — max field size, max 8)",
		),
	fieldName: z
		.string()
		.optional()
		.describe("Field name for field_offset action"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

interface FieldResult {
	name: string;
	type: string;
	elementSize: number;
	count: number;
	totalSize: number;
	offset: number;
	paddingBefore: number;
	alignment: number;
}

function resolveSize(field: z.infer<typeof fieldSchema>): number {
	if (field.size !== undefined) return field.size;
	if (field.type) {
		const s = TYPE_SIZES[field.type];
		if (s === undefined)
			throw new Error(
				`Unknown type: ${field.type}. Use byte/word/dword/qword or provide size.`,
			);
		return s;
	}
	throw new Error(`Field "${field.name}" must have either type or size`);
}

function computeLayout(
	fields: z.infer<typeof fieldSchema>[],
	userAlign?: number,
): { fields: FieldResult[]; totalSize: number; alignment: number } {
	if (fields.length === 0)
		return { fields: [], totalSize: 0, alignment: userAlign ?? 1 };

	// Compute natural alignment (max field element size, capped at 8)
	const maxFieldSize = Math.min(
		8,
		Math.max(...fields.map((f) => resolveSize(f))),
	);
	const structAlign = userAlign ?? maxFieldSize;

	let offset = 0;
	const result: FieldResult[] = [];

	for (const f of fields) {
		const elemSize = resolveSize(f);
		const count = f.count ?? 1;
		const fieldAlign = Math.min(elemSize, structAlign);
		// Add padding to satisfy alignment
		const remainder = offset % fieldAlign;
		const paddingBefore = remainder === 0 ? 0 : fieldAlign - remainder;
		offset += paddingBefore;
		result.push({
			name: f.name,
			type: f.type ?? `custom(${elemSize})`,
			elementSize: elemSize,
			count,
			totalSize: elemSize * count,
			offset,
			paddingBefore,
			alignment: fieldAlign,
		});
		offset += elemSize * count;
	}

	// Tail padding to make struct size a multiple of alignment
	const tail = offset % structAlign;
	const tailPadding = tail === 0 ? 0 : structAlign - tail;
	const totalSize = offset + tailPadding;

	return { fields: result, totalSize, alignment: structAlign };
}

export function execute(input: Input): string {
	if (!input.fields || input.fields.length === 0)
		throw new Error("fields is required and must be non-empty");

	const {
		fields: layout,
		totalSize,
		alignment,
	} = computeLayout(input.fields, input.align);

	switch (input.action) {
		case "struct_layout":
			return JSON.stringify(
				{
					alignment,
					totalSize,
					fields: layout.map((f) => ({
						name: f.name,
						type: f.type,
						elementSize: f.elementSize,
						count: f.count,
						totalSize: f.totalSize,
						offset: f.offset,
						offsetHex: `0x${f.offset.toString(16).toUpperCase()}`,
						paddingBefore: f.paddingBefore,
						alignment: f.alignment,
					})),
				},
				null,
				2,
			);
		case "field_offset": {
			if (!input.fieldName)
				throw new Error("fieldName is required for field_offset");
			const f = layout.find((x) => x.name === input.fieldName);
			if (!f) throw new Error(`Field "${input.fieldName}" not found in struct`);
			return JSON.stringify({
				fieldName: f.name,
				offset: f.offset,
				offsetHex: `0x${f.offset.toString(16).toUpperCase()}`,
				type: f.type,
				totalSize: f.totalSize,
			});
		}
		case "struct_size":
			return JSON.stringify({
				totalSize,
				totalSizeHex: `0x${totalSize.toString(16).toUpperCase()}`,
				alignment,
				fieldCount: layout.length,
			});
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_struct",
	description:
		"MASM struct layout calculator: compute field offsets, padding, and total struct size with configurable alignment. Supports byte/word/dword/qword/real4/real8 types and array fields.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
