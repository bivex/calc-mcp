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

import { z } from "zod";
import type { ToolDefinition } from "../index.js";

// ── Register database ────────────────────────────────────────────────────────

type RegRole =
	| "argument/result"
	| "indirect-result"
	| "temporary"
	| "ip-scratch"
	| "platform-reserved"
	| "callee-saved"
	| "frame-pointer"
	| "link-register"
	| "stack-pointer"
	| "program-counter"
	| "zero-register"
	| "simd-fp"
	| "system";

interface RegInfo {
	canonical: string;
	bits: number;
	role: RegRole;
	calleeSaved: boolean;
	aliases: string[];
	note?: string;
}

// Build the full register map
function buildRegMap(): Map<string, RegInfo> {
	const m = new Map<string, RegInfo>();

	function add(info: RegInfo) {
		for (const name of [info.canonical, ...info.aliases]) {
			m.set(name.toLowerCase(), info);
		}
	}

	// x0-x7: argument / result (caller-saved)
	for (let i = 0; i <= 7; i++) {
		add({
			canonical: `x${i}`,
			bits: 64,
			role: "argument/result",
			calleeSaved: false,
			aliases: [`w${i}`],
			note: `Arg ${i + 1} / return value. w${i} = lower 32 bits.`,
		});
	}

	// x8: indirect result register (caller-saved)
	add({
		canonical: "x8",
		bits: 64,
		role: "indirect-result",
		calleeSaved: false,
		aliases: ["w8"],
		note: "Indirect result location register (also syscall nr on Linux ARM64). w8 = lower 32 bits.",
	});

	// x9-x15: temporary / caller-saved
	for (let i = 9; i <= 15; i++) {
		add({
			canonical: `x${i}`,
			bits: 64,
			role: "temporary",
			calleeSaved: false,
			aliases: [`w${i}`],
			note: `Temporary caller-saved register. w${i} = lower 32 bits.`,
		});
	}

	// x16 (IP0), x17 (IP1): intra-procedure-call scratch
	add({
		canonical: "x16",
		bits: 64,
		role: "ip-scratch",
		calleeSaved: false,
		aliases: ["w16", "ip0"],
		note: "IP0: intra-procedure-call scratch. Used by dynamic linker / veneers.",
	});
	add({
		canonical: "x17",
		bits: 64,
		role: "ip-scratch",
		calleeSaved: false,
		aliases: ["w17", "ip1"],
		note: "IP1: intra-procedure-call scratch.",
	});

	// x18: platform register (reserved on macOS/iOS – do not use)
	add({
		canonical: "x18",
		bits: 64,
		role: "platform-reserved",
		calleeSaved: false,
		aliases: ["w18"],
		note: "Reserved by Apple platform. Must not be used in macOS/iOS code.",
	});

	// x19-x28: callee-saved
	for (let i = 19; i <= 28; i++) {
		add({
			canonical: `x${i}`,
			bits: 64,
			role: "callee-saved",
			calleeSaved: true,
			aliases: [`w${i}`],
			note: `Callee-saved. w${i} = lower 32 bits.`,
		});
	}

	// x29 (FP): frame pointer (callee-saved)
	add({
		canonical: "x29",
		bits: 64,
		role: "frame-pointer",
		calleeSaved: true,
		aliases: ["w29", "fp"],
		note: "Frame pointer (FP). Must be maintained on Apple platforms for stack unwinding.",
	});

	// x30 (LR): link register (caller-saved – but special)
	add({
		canonical: "x30",
		bits: 64,
		role: "link-register",
		calleeSaved: false,
		aliases: ["w30", "lr"],
		note: "Link register (LR). Holds return address after BL/BLR.",
	});

	// sp / wsp
	add({
		canonical: "sp",
		bits: 64,
		role: "stack-pointer",
		calleeSaved: true,
		aliases: ["wsp"],
		note: "Stack pointer. Must be 16-byte aligned at public interfaces. wsp = lower 32 bits.",
	});

	// pc
	add({
		canonical: "pc",
		bits: 64,
		role: "program-counter",
		calleeSaved: false,
		aliases: [],
		note: "Program counter. Not directly writable (use B/BL/BR).",
	});

	// xzr / wzr: zero registers
	add({
		canonical: "xzr",
		bits: 64,
		role: "zero-register",
		calleeSaved: false,
		aliases: ["wzr"],
		note: "Zero register: reads as 0, writes are discarded. wzr = 32-bit zero.",
	});

	// v0-v31: SIMD/FP (caller-saved v0-v7, callee-saved v8-v15 lower 64 bits only, v16-v31 caller-saved)
	for (let i = 0; i <= 31; i++) {
		const callee = i >= 8 && i <= 15;
		add({
			canonical: `v${i}`,
			bits: 128,
			role: "simd-fp",
			calleeSaved: callee,
			aliases: [`q${i}`, `d${i}`, `s${i}`, `h${i}`, `b${i}`],
			note: `SIMD/FP. q${i}=128b, d${i}=64b, s${i}=32b, h${i}=16b, b${i}=8b.${callee ? ` Lower 64 bits (d${i}) are callee-saved.` : ""}`,
		});
	}

	// System registers
	for (const [name, note] of [
		["nzcv", "Condition flags: N(negative) Z(zero) C(carry) V(overflow)"],
		["fpsr", "Floating-point status register"],
		["fpcr", "Floating-point control register"],
		["tpidr_el0", "Thread pointer (used for TLS on macOS)"],
		["daif", "Interrupt mask bits"],
		["currentel", "Current exception level"],
		["spsel", "Stack pointer selector"],
	] as [string, string][]) {
		add({
			canonical: name,
			bits: 64,
			role: "system",
			calleeSaved: false,
			aliases: [],
			note,
		});
	}

	return m;
}

const REG_MAP = buildRegMap();

// ── Calling convention ───────────────────────────────────────────────────────

const AAPCS64 = {
	name: "AAPCS64 (ARM 64-bit Architecture Procedure Call Standard)",
	platform: "macOS / iOS / iPadOS (Apple Silicon)",
	integerArgs: ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"],
	indirectResult: "x8",
	floatArgs: ["v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7"],
	returnInt: ["x0", "x1"],
	returnFloat: ["v0", "v1"],
	calleeSaved: [
		"x19",
		"x20",
		"x21",
		"x22",
		"x23",
		"x24",
		"x25",
		"x26",
		"x27",
		"x28",
		"x29",
		"x30 (must save if making calls)",
		"sp",
	],
	callerSaved: ["x0-x15", "x16 (IP0)", "x17 (IP1)", "v0-v7", "v16-v31"],
	stackAlignment: 16,
	notes: [
		"SP must be 16-byte aligned at all public interfaces",
		"x29 (FP) must be maintained — required by Apple for stack unwinding",
		"x18 is reserved by Apple platform — never use",
		"Lower 64 bits of v8-v15 (d8-d15) are callee-saved; upper 64 bits are not",
		"Arguments beyond 8 integers (or 8 floats) are passed on the stack",
	],
};

// ── macOS ARM64 syscalls ─────────────────────────────────────────────────────

// macOS ARM64: x16 = 0x2000000 | syscall_nr, then svc #0x80
// Args in x0-x7. Return in x0. C flag set on error.
const ARM64_SYSCALLS: Record<
	string,
	{ nr: number; args: string[]; ret: string; desc: string }
> = {
	exit: { nr: 1, args: ["int status"], ret: "void", desc: "Terminate process" },
	fork: { nr: 2, args: [], ret: "pid_t", desc: "Create child process" },
	read: {
		nr: 3,
		args: ["int fd", "void *buf", "size_t nbytes"],
		ret: "ssize_t",
		desc: "Read from file descriptor",
	},
	write: {
		nr: 4,
		args: ["int fd", "const void *buf", "size_t nbytes"],
		ret: "ssize_t",
		desc: "Write to file descriptor",
	},
	open: {
		nr: 5,
		args: ["const char *path", "int flags", "int mode"],
		ret: "int",
		desc: "Open file",
	},
	close: { nr: 6, args: ["int fd"], ret: "int", desc: "Close file descriptor" },
	getpid: { nr: 20, args: [], ret: "pid_t", desc: "Get process ID" },
	getuid: { nr: 24, args: [], ret: "uid_t", desc: "Get real user ID" },
	kill: {
		nr: 37,
		args: ["int pid", "int signum"],
		ret: "int",
		desc: "Send signal to process",
	},
	getppid: { nr: 39, args: [], ret: "pid_t", desc: "Get parent process ID" },
	pipe: { nr: 42, args: ["int *fildes"], ret: "int", desc: "Create pipe" },
	execve: {
		nr: 59,
		args: ["const char *fname", "char **argp", "char **envp"],
		ret: "int",
		desc: "Execute program",
	},
	mmap: {
		nr: 197,
		args: [
			"void *addr",
			"size_t len",
			"int prot",
			"int flags",
			"int fd",
			"off_t pos",
		],
		ret: "void *",
		desc: "Map memory",
	},
	munmap: {
		nr: 73,
		args: ["void *addr", "size_t len"],
		ret: "int",
		desc: "Unmap memory",
	},
	mprotect: {
		nr: 74,
		args: ["void *addr", "size_t len", "int prot"],
		ret: "int",
		desc: "Set memory protection",
	},
	lseek: {
		nr: 199,
		args: ["int fd", "off_t offset", "int whence"],
		ret: "off_t",
		desc: "Set file offset",
	},
	socket: {
		nr: 97,
		args: ["int domain", "int type", "int protocol"],
		ret: "int",
		desc: "Create socket",
	},
	connect: {
		nr: 98,
		args: ["int s", "const struct sockaddr *name", "socklen_t namelen"],
		ret: "int",
		desc: "Connect socket",
	},
	gettimeofday: {
		nr: 116,
		args: ["struct timeval *tp", "struct timezone *tzp"],
		ret: "int",
		desc: "Get time of day",
	},
};

// ── Condition codes ──────────────────────────────────────────────────────────

const CONDITION_CODES: Record<
	string,
	{ flags: string; desc: string; opposite: string; use: string }
> = {
	eq: {
		flags: "Z=1",
		desc: "Equal",
		opposite: "ne",
		use: "After CMP/SUB when operands are equal",
	},
	ne: {
		flags: "Z=0",
		desc: "Not equal",
		opposite: "eq",
		use: "After CMP/SUB when operands differ",
	},
	cs: {
		flags: "C=1",
		desc: "Carry set / Unsigned higher or same",
		opposite: "cc",
		use: "Unsigned ≥",
	},
	hs: {
		flags: "C=1",
		desc: "Unsigned higher or same (alias CS)",
		opposite: "lo",
		use: "Unsigned ≥",
	},
	cc: {
		flags: "C=0",
		desc: "Carry clear / Unsigned lower",
		opposite: "cs",
		use: "Unsigned <",
	},
	lo: {
		flags: "C=0",
		desc: "Unsigned lower (alias CC)",
		opposite: "hs",
		use: "Unsigned <",
	},
	mi: {
		flags: "N=1",
		desc: "Minus / negative",
		opposite: "pl",
		use: "Result is negative",
	},
	pl: {
		flags: "N=0",
		desc: "Plus / positive or zero",
		opposite: "mi",
		use: "Result is non-negative",
	},
	vs: {
		flags: "V=1",
		desc: "Overflow set",
		opposite: "vc",
		use: "Signed arithmetic overflow",
	},
	vc: {
		flags: "V=0",
		desc: "Overflow clear",
		opposite: "vs",
		use: "No signed overflow",
	},
	hi: {
		flags: "C=1 && Z=0",
		desc: "Unsigned higher",
		opposite: "ls",
		use: "Unsigned >",
	},
	ls: {
		flags: "C=0 || Z=1",
		desc: "Unsigned lower or same",
		opposite: "hi",
		use: "Unsigned ≤",
	},
	ge: {
		flags: "N=V",
		desc: "Signed greater or equal",
		opposite: "lt",
		use: "Signed ≥",
	},
	lt: {
		flags: "N≠V",
		desc: "Signed less than",
		opposite: "ge",
		use: "Signed <",
	},
	gt: {
		flags: "Z=0 && N=V",
		desc: "Signed greater than",
		opposite: "le",
		use: "Signed >",
	},
	le: {
		flags: "Z=1 || N≠V",
		desc: "Signed less or equal",
		opposite: "gt",
		use: "Signed ≤",
	},
	al: {
		flags: "always",
		desc: "Always (unconditional)",
		opposite: "nv",
		use: "Unconditional execution",
	},
	nv: {
		flags: "never",
		desc: "Never (reserved, do not use)",
		opposite: "al",
		use: "Reserved",
	},
};

// ── Addressing mode parser ───────────────────────────────────────────────────

function parseAddressingMode(expr: string): object {
	const trimmed = expr.trim();

	// Post-index: [xn], #imm
	const postMatch = trimmed.match(
		/^\[([^\]]+)\],\s*#(-?(?:0x[0-9a-fA-F]+|[0-9]+))$/,
	);
	if (postMatch) {
		const base = String(postMatch[1]).trim().toLowerCase();
		const raw2 = String(postMatch[2]);
		const offset = raw2.startsWith("0x") ? parseInt(raw2, 16) : Number(raw2);
		return {
			mode: "post-index",
			base,
			offset,
			effectiveAddress: `[${base}]`,
			baseAfter: `${base} + ${offset}`,
			description:
				"Access [base], then base += offset. Common for stack pop / sequential array.",
			example: `ldr x0, [${base}], #${offset}`,
		};
	}

	// Must be [...] or [...]!
	const preIndex = trimmed.endsWith("!");
	const clean = trimmed.replace(/!$/, "").trim();
	const bracketMatch = clean.match(/^\[([^\]]+)\]$/);
	if (!bracketMatch)
		throw new Error(
			`Cannot parse ARM64 memory operand: ${expr}. Expected [base], [base,#imm], [base,xm], [base,xm,lsl #n], [base,#imm]!, or [base],#imm`,
		);

	const inner = String(bracketMatch[1]).trim();

	// [xn] – base only
	if (/^[a-z][a-z0-9]*$/i.test(inner)) {
		const base = inner.toLowerCase();
		return {
			mode: preIndex ? "pre-index (no offset)" : "base",
			base,
			offset: 0,
			effectiveAddress: `[${base}]`,
			description: "Access memory at base register.",
		};
	}

	// [xn, #imm]  or  [xn, #imm]!
	const immMatch = inner.match(
		/^([a-z][a-z0-9]*),\s*#(-?(?:0x[0-9a-fA-F]+|[0-9]+))$/i,
	);
	if (immMatch) {
		const base = String(immMatch[1]).toLowerCase();
		const rawImm = String(immMatch[2]);
		const offset = rawImm.startsWith("0x")
			? parseInt(rawImm, 16)
			: Number(rawImm);
		return {
			mode: preIndex ? "pre-index" : "base+offset",
			base,
			offset,
			effectiveAddress: `[${base} + ${offset}]`,
			baseAfter: preIndex ? `${base} += ${offset}` : undefined,
			description: preIndex
				? "Compute base+offset, access, then writeback to base."
				: "Access base + immediate offset (no base modification).",
			example: `ldr x0, [${base}, #${offset}]${preIndex ? "!" : ""}`,
		};
	}

	// [xn, xm]  or  [xn, xm, lsl #s]  or  [xn, xm, sxtw #s]  etc.
	const regMatch = inner.match(
		/^([a-z][a-z0-9]*),\s*([a-z][a-z0-9]*)(?:,\s*(lsl|lsr|asr|ror|sxtw|sxtx|uxtw|uxtx)\s*#([0-9]+))?$/i,
	);
	if (regMatch) {
		const base = String(regMatch[1]).toLowerCase();
		const index = String(regMatch[2]).toLowerCase();
		const extType = regMatch[3]?.toLowerCase() ?? null;
		const extAmt = regMatch[4] !== undefined ? Number(regMatch[4]) : 0;
		const eaDesc = extType
			? `${base} + ${index} ${extType} #${extAmt}`
			: `${base} + ${index}`;
		return {
			mode: extType ? `base+reg+${extType}` : "base+reg",
			base,
			index,
			extendType: extType,
			extendAmount: extAmt,
			effectiveAddress: `[${eaDesc}]`,
			description: extType
				? `Effective address = ${eaDesc}. ${extType.startsWith("s") ? "Signed" : "Unsigned"} extend/shift of ${index}.`
				: `Effective address = ${base} + ${index}.`,
			example: extType
				? `ldr x0, [${base}, ${index}, ${extType} #${extAmt}]`
				: `ldr x0, [${base}, ${index}]`,
		};
	}

	throw new Error(`Cannot parse ARM64 addressing mode: ${expr}`);
}

// ── SIMD sub-register widths ─────────────────────────────────────────────────

const SIMD_WIDTHS: Record<string, number> = {
	v: 128,
	q: 128,
	d: 64,
	s: 32,
	h: 16,
	b: 8,
};

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = {
	action: z
		.enum([
			"reg_info",
			"reg_parts",
			"calling_convention",
			"syscall_info",
			"condition_code",
			"addressing_mode",
		])
		.describe(
			"Action: reg_info (register details), reg_parts (x0↔w0, v0↔q/d/s/h/b), calling_convention (AAPCS64 register roles), syscall_info (macOS ARM64 syscall – x16+svc), condition_code (EQ/NE/GE/etc flags), addressing_mode (parse [x0,#8]/[x0,x1,lsl #2]/post-index/pre-index)",
		),
	value: z
		.string()
		.optional()
		.describe(
			"Register name, syscall name, condition code, or addressing mode expression",
		),
	argCount: z
		.number()
		.int()
		.optional()
		.describe(
			"Number of function arguments (for calling_convention to show per-arg register mapping)",
		),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

// ── execute ──────────────────────────────────────────────────────────────────

export function execute(input: Input): string {
	switch (input.action) {
		case "reg_info": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) throw new Error("value (register name) is required");
			const info = REG_MAP.get(name);
			if (!info)
				throw new Error(
					`Unknown ARM64 register: '${input.value}'. Examples: x0, w0, sp, lr, fp, xzr, v0, d0, s0`,
				);
			return JSON.stringify({
				name,
				canonical: info.canonical,
				bits: info.bits,
				bytes: info.bits / 8,
				role: info.role,
				calleeSaved: info.calleeSaved,
				callerSaved:
					!info.calleeSaved &&
					info.role !== "stack-pointer" &&
					info.role !== "program-counter",
				aliases: info.aliases,
				note: info.note,
			});
		}

		case "reg_parts": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) throw new Error("value (register name) is required");
			// GPR: x0-x30 ↔ w0-w30
			const gpMatch = name.match(/^[xw]([0-9]{1,2})$/);
			if (gpMatch) {
				const n = Number(gpMatch[1]);
				if (n > 30) throw new Error(`ARM64 GPR number must be 0-30, got ${n}`);
				return JSON.stringify({
					input: name,
					x64: `x${n}`,
					w32: `w${n}`,
					relationship: `w${n} is the lower 32 bits of x${n}. Writing w${n} zero-extends into x${n}.`,
					role:
						n <= 7
							? "argument/result"
							: n <= 15
								? "temporary"
								: n <= 17
									? "ip-scratch"
									: n === 18
										? "platform-reserved"
										: n <= 28
											? "callee-saved"
											: n === 29
												? "frame-pointer (fp)"
												: "link-register (lr)",
				});
			}
			// sp / wsp
			if (name === "sp" || name === "wsp") {
				return JSON.stringify({
					input: name,
					x64: "sp",
					w32: "wsp",
					relationship: "wsp is lower 32 bits of sp.",
				});
			}
			// xzr / wzr
			if (name === "xzr" || name === "wzr") {
				return JSON.stringify({
					input: name,
					x64: "xzr",
					w32: "wzr",
					relationship:
						"wzr is the 32-bit zero register. Both always read as 0.",
				});
			}
			// lr / fp aliases
			if (name === "lr")
				return JSON.stringify({
					input: "lr",
					canonical: "x30",
					w32: "w30",
					note: "Link register = x30.",
				});
			if (name === "fp")
				return JSON.stringify({
					input: "fp",
					canonical: "x29",
					w32: "w29",
					note: "Frame pointer = x29.",
				});
			// SIMD: v0-v31 or any sub-register
			const simdMatch = name.match(/^([vqdshb])([0-9]{1,2})$/);
			if (simdMatch) {
				const n = Number(simdMatch[2]);
				if (n > 31)
					throw new Error(`ARM64 SIMD register number must be 0-31, got ${n}`);
				return JSON.stringify({
					input: name,
					v128: `v${n}`,
					q128: `q${n}`,
					d64: `d${n}`,
					s32: `s${n}`,
					h16: `h${n}`,
					b8: `b${n}`,
					relationship: `All are views into the same 128-bit SIMD register (v${n}). d${n}=low 64b, s${n}=low 32b, h${n}=low 16b, b${n}=low 8b.`,
					calleeSaved: n >= 8 && n <= 15 ? `Lower 64 bits (d${n}) only` : "No",
					widths: Object.fromEntries(
						Object.entries(SIMD_WIDTHS).map(([p, b]) => [
							`${p}${n}`,
							`${b}-bit`,
						]),
					),
				});
			}
			throw new Error(
				`Cannot determine parts for: '${input.value}'. Try x0, w0, v0, d0, sp, lr, xzr.`,
			);
		}

		case "calling_convention": {
			const result: Record<string, unknown> = { ...AAPCS64 };
			const n =
				input.argCount ??
				(input.value !== undefined ? Number(input.value) : undefined);
			if (n !== undefined && n >= 0) {
				const intRegs = AAPCS64.integerArgs;
				const floatRegs = AAPCS64.floatArgs;
				result.argsForFunction = Array.from({ length: n }, (_, i) => ({
					argIndex: i + 1,
					integerRegister:
						i < intRegs.length
							? intRegs[i]
							: `[sp + ${(i - intRegs.length) * 8}]`,
					floatRegister:
						i < floatRegs.length
							? floatRegs[i]
							: `[sp + ${(i - floatRegs.length) * 8}]`,
					location: i < intRegs.length ? "register" : "stack",
				}));
			}
			return JSON.stringify(result);
		}

		case "syscall_info": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) {
				const list = Object.entries(ARM64_SYSCALLS).map(([k, v]) => ({
					name: k,
					nr: v.nr,
					x16: `0x${(0x2000000 | v.nr).toString(16).toUpperCase()}`,
					desc: v.desc,
				}));
				return JSON.stringify({
					syscalls: list,
					abi: {
						syscallRegister: "x16",
						argRegisters: ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"],
						returnRegister: "x0",
						instruction: "svc #0x80",
						prefix: "0x2000000",
						errorFlag: "C flag (carry) in NZCV set on error",
						note: "Same syscall numbers as macOS x86-64 (0x2000000 | nr), but x16 instead of rax, and svc #0x80 instead of syscall",
					},
				});
			}
			const sc = ARM64_SYSCALLS[name];
			if (!sc) {
				const available = Object.keys(ARM64_SYSCALLS).join(", ");
				throw new Error(
					`Unknown macOS syscall '${name}'. Available: ${available}`,
				);
			}
			const x16Value = 0x2000000 | sc.nr;
			const argRegs = ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"];
			return JSON.stringify({
				name,
				nr: sc.nr,
				x16: `0x${x16Value.toString(16).toUpperCase()}`,
				x16Decimal: x16Value,
				description: sc.desc,
				args: sc.args,
				argRegisters: argRegs.slice(0, sc.args.length),
				argsWithRegisters: sc.args.map((a, i) => ({
					register: argRegs[i] ?? "stack",
					arg: a,
				})),
				ret: sc.ret,
				returnRegister: "x0",
				errorCheck: "C flag (carry) in NZCV set on error; errno in x0",
				asmExample: [
					...sc.args.map((a, i) => `// x${i} = ${a}`),
					`mov x16, #0x${x16Value.toString(16).toUpperCase()}`,
					"svc #0x80",
					"b.cs error_handler  // if carry set, x0 = errno",
				],
			});
		}

		case "condition_code": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) {
				return JSON.stringify({ conditionCodes: CONDITION_CODES });
			}
			const cc = CONDITION_CODES[name];
			if (!cc) {
				const available = Object.keys(CONDITION_CODES).join(", ");
				throw new Error(
					`Unknown condition code '${input.value}'. Valid: ${available}`,
				);
			}
			return JSON.stringify({
				code: name.toUpperCase(),
				flags: cc.flags,
				description: cc.desc,
				opposite: cc.opposite.toUpperCase(),
				use: cc.use,
				examples: {
					branch: `b.${name} target`,
					conditionalSet: `cset x0, ${name}`,
					conditionalSelect: `csel x0, x1, x2, ${name}`,
					conditionalIncrement: `cinc x0, x1, ${name}`,
				},
			});
		}

		case "addressing_mode": {
			const expr = String(input.value ?? "").trim();
			if (!expr)
				throw new Error(
					"value (addressing mode expression) is required. Example: [x0, #8] or [sp, x1, lsl #3]",
				);
			return JSON.stringify(parseAddressingMode(expr));
		}

		default:
			throw new Error(
				`Unknown action: ${(input as { action: string }).action}`,
			);
	}
}

export const tool: ToolDefinition = {
	name: "asm_arm64",
	description:
		"ARM64/AArch64 assembly helpers for Apple Silicon (M1/M2/M3/M4): register info (x0-x30, w0-w30, sp, lr, fp, xzr, v0-v31 SIMD), x/w and v/q/d/s/h/b sub-register relationships, AAPCS64 calling convention (Apple platform), macOS ARM64 syscalls (x16 + svc #0x80), condition codes (EQ/NE/GE/etc), and addressing mode parsing ([x0,#8], [x0,x1,lsl #2], pre/post-index).",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
