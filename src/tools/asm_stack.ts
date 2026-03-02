import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const schema = {
	action: z
		.enum(["push", "pop", "stack_offset", "frame_offset"])
		.describe("Action: push | pop | stack_offset | frame_offset"),
	wordSize: z
		.number()
		.refine((v) => [2, 4, 8].includes(v), {
			message: "wordSize must be 2 (16-bit), 4 (32-bit), or 8 (64-bit)",
		})
		.optional()
		.describe(
			"Stack word size in bytes: 2 (16-bit), 4 (32-bit/default), or 8 (64-bit)",
		),
	stackPointer: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Current stack pointer value (for push/pop simulation)"),
	pushes: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Number of push operations for stack_offset"),
	pops: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Number of pop operations for stack_offset"),
	// For frame_offset: describe the frame layout
	frameBase: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Base register value (e.g. EBP value) for frame_offset"),
	argBytes: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Bytes of arguments pushed before call for frame_offset"),
	localBytes: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Bytes of local variables (sub esp, N) for frame_offset"),
	savedRegs: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Number of saved registers pushed in prologue for frame_offset"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function parseValue(v: string | number): bigint {
	const s = String(v).trim().toLowerCase().replace(/_/g, "");
	if (s.startsWith("-")) return -parseValue(s.slice(1));
	if (s.startsWith("0x")) return BigInt(`0x${s.slice(2)}`);
	if (s.startsWith("0b")) return BigInt(`0b${s.slice(2)}`);
	return BigInt(s);
}

export function execute(input: Input): string {
	const wordSize = input.wordSize ?? 4;
	const ws = BigInt(wordSize);

	switch (input.action) {
		case "push": {
			const sp =
				input.stackPointer !== undefined ? parseValue(input.stackPointer) : 0n;
			const newSp = sp - ws;
			return JSON.stringify({
				action: "push",
				wordSize,
				stackPointerBefore: sp.toString(),
				stackPointerAfter: newSp.toString(),
				stackPointerAfterHex: `0x${(newSp < 0n ? newSp + (1n << 64n) : newSp).toString(16).toUpperCase()}`,
				delta: (-wordSize).toString(),
				effect: `SP = SP - ${wordSize}`,
			});
		}
		case "pop": {
			const sp =
				input.stackPointer !== undefined ? parseValue(input.stackPointer) : 0n;
			const newSp = sp + ws;
			return JSON.stringify({
				action: "pop",
				wordSize,
				stackPointerBefore: sp.toString(),
				stackPointerAfter: newSp.toString(),
				stackPointerAfterHex: `0x${newSp.toString(16).toUpperCase()}`,
				delta: wordSize.toString(),
				effect: `SP = SP + ${wordSize}`,
			});
		}
		case "stack_offset": {
			const pushes = input.pushes ?? 0;
			const pops = input.pops ?? 0;
			const net = (pops - pushes) * wordSize;
			return JSON.stringify({
				wordSize,
				pushes,
				pops,
				netDelta: net,
				netDeltaDescription:
					net >= 0
						? `SP + ${net} (stack shrinks / grows up)`
						: `SP - ${Math.abs(net)} (stack grows down)`,
				spChangeFromPushes: (-pushes * wordSize).toString(),
				spChangeFromPops: (pops * wordSize).toString(),
			});
		}
		case "frame_offset": {
			const ws32 = wordSize;
			// Standard x86 frame layout (32-bit example):
			//   [ebp + 4*(n+1)] = arg n (first arg at [ebp+8])
			//   [ebp + 0]       = saved EBP
			//   [ebp + 4]       = return address
			//   [ebp - 4]       = first local
			const argBytes = input.argBytes ?? 0;
			const localBytes = input.localBytes ?? 0;
			const savedRegs = input.savedRegs ?? 0;
			const retAddrSize = ws32;

			// Compute argument offsets from EBP
			const args: Array<{ index: number; offset: number; offsetExpr: string }> =
				[];
			for (let i = 0; i < Math.ceil(argBytes / ws32); i++) {
				const off = retAddrSize + ws32 + i * ws32; // skip ret addr + saved EBP
				args.push({ index: i, offset: off, offsetExpr: `[ebp+${off}]` });
			}

			// Compute local variable offsets from EBP
			const locals: Array<{
				index: number;
				offset: number;
				offsetExpr: string;
			}> = [];
			for (let i = 0; i < Math.ceil(localBytes / ws32); i++) {
				const off = -((i + 1) * ws32);
				locals.push({ index: i, offset: off, offsetExpr: `[ebp${off}]` });
			}

			// Total frame size
			const frameSize = ws32 /* saved EBP */ + savedRegs * ws32 + localBytes;

			return JSON.stringify({
				wordSize: ws32,
				savedEBP: { offset: 0, expr: "[ebp+0]" },
				returnAddress: { offset: retAddrSize, expr: `[ebp+${retAddrSize}]` },
				arguments: args,
				locals,
				savedRegistersCount: savedRegs,
				savedRegistersBytes: savedRegs * ws32,
				localBytes,
				frameSize,
				frameSizeHex: `0x${frameSize.toString(16).toUpperCase()}`,
				prologueExample: [
					`push ebp`,
					`mov ebp, esp`,
					...(localBytes > 0 ? [`sub esp, ${localBytes}`] : []),
				].join("\n"),
				epilogueExample: ["mov esp, ebp", "pop ebp", "ret"].join("\n"),
			});
		}
		default:
			throw new Error(`Unknown action: ${input.action}`);
	}
}

export const tool: ToolDefinition = {
	name: "asm_stack",
	description:
		"x86 stack and call frame calculations for MASM: simulate push/pop SP movement, compute net stack delta, and generate a complete call frame layout showing argument and local variable offsets from EBP/RBP ([ebp+8], [ebp-4], etc.).",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
