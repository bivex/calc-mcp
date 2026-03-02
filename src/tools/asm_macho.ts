/**
 * Copyright (c) 2026 Bivex
 *
 * Author: Bivex
 * Available for contact via email: support@b-b.top
 * For up-to-date contact information:
 * https://github.com/bivex
 *
 * Created: 2026-03-02 19:11
 * Last Updated: 2026-03-02 19:11
 *
 * Licensed under the MIT License.
 * Commercial licensing available upon request.
 */

import { z } from "zod";
import type { ToolDefinition } from "../index.js";

// macOS BSD syscalls use class 0x2 prefix: syscall_nr = 0x2000000 | number
// Source: xnu/bsd/kern/syscalls.master
const MACOS_SYSCALLS: Record<
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
	wait4: {
		nr: 7,
		args: ["int pid", "int *status", "int options", "struct rusage *rusage"],
		ret: "pid_t",
		desc: "Wait for process",
	},
	getpid: { nr: 20, args: [], ret: "pid_t", desc: "Get process ID" },
	getuid: { nr: 24, args: [], ret: "uid_t", desc: "Get real user ID" },
	kill: {
		nr: 37,
		args: ["int pid", "int signum"],
		ret: "int",
		desc: "Send signal to process",
	},
	getppid: { nr: 39, args: [], ret: "pid_t", desc: "Get parent process ID" },
	dup: {
		nr: 41,
		args: ["int oldd"],
		ret: "int",
		desc: "Duplicate file descriptor",
	},
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
	getgid: { nr: 47, args: [], ret: "gid_t", desc: "Get real group ID" },
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
	accept: {
		nr: 30,
		args: ["int s", "struct sockaddr *name", "socklen_t *anamelen"],
		ret: "int",
		desc: "Accept connection",
	},
	bind: {
		nr: 104,
		args: ["int s", "const struct sockaddr *name", "socklen_t namelen"],
		ret: "int",
		desc: "Bind socket",
	},
	listen: {
		nr: 106,
		args: ["int s", "int backlog"],
		ret: "int",
		desc: "Listen for connections",
	},
	send: {
		nr: 133,
		args: ["int s", "const void *msg", "size_t len", "int flags"],
		ret: "ssize_t",
		desc: "Send on socket",
	},
	recv: {
		nr: 134,
		args: ["int s", "void *buf", "size_t len", "int flags"],
		ret: "ssize_t",
		desc: "Receive from socket",
	},
	gettimeofday: {
		nr: 116,
		args: ["struct timeval *tp", "struct timezone *tzp"],
		ret: "int",
		desc: "Get time of day",
	},
	stat64: {
		nr: 338,
		args: ["const char *path", "struct stat64 *ub"],
		ret: "int",
		desc: "Get file status (64-bit)",
	},
	fstat64: {
		nr: 339,
		args: ["int fd", "struct stat64 *sb"],
		ret: "int",
		desc: "Get file status by fd (64-bit)",
	},
	pread: {
		nr: 153,
		args: ["int fd", "void *buf", "size_t nbyte", "off_t offset"],
		ret: "ssize_t",
		desc: "Read at offset",
	},
	pwrite: {
		nr: 154,
		args: ["int fd", "const void *buf", "size_t nbyte", "off_t offset"],
		ret: "ssize_t",
		desc: "Write at offset",
	},
};

const MACOS_SECTIONS: Record<
	string,
	{ segment: string; flags: string; desc: string; access: string }
> = {
	".text": {
		segment: "__TEXT",
		flags: "S_REGULAR | S_ATTR_PURE_INSTRUCTIONS",
		desc: "Executable code",
		access: "r-x",
	},
	".data": {
		segment: "__DATA",
		flags: "S_REGULAR",
		desc: "Initialized writable data",
		access: "rw-",
	},
	".bss": {
		segment: "__DATA",
		flags: "S_ZEROFILL",
		desc: "Zero-initialized data (no space in file)",
		access: "rw-",
	},
	".rodata": {
		segment: "__TEXT",
		flags: "S_REGULAR",
		desc: "Read-only data (macOS: in __TEXT segment)",
		access: "r--",
	},
	".cstring": {
		segment: "__TEXT",
		flags: "S_CSTRING_LITERALS",
		desc: "C string literals",
		access: "r--",
	},
	".literal4": {
		segment: "__TEXT",
		flags: "S_4BYTE_LITERALS",
		desc: "4-byte literals (float constants)",
		access: "r--",
	},
	".literal8": {
		segment: "__TEXT",
		flags: "S_8BYTE_LITERALS",
		desc: "8-byte literals (double constants)",
		access: "r--",
	},
	".const": {
		segment: "__TEXT",
		flags: "S_REGULAR",
		desc: "Constant data",
		access: "r--",
	},
	".eh_frame": {
		segment: "__TEXT",
		flags: "S_REGULAR",
		desc: "Exception handling frames (DWARF)",
		access: "r--",
	},
	".init_array": {
		segment: "__DATA",
		flags: "S_MOD_INIT_FUNC_POINTERS",
		desc: "Constructors (init functions)",
		access: "rw-",
	},
	".fini_array": {
		segment: "__DATA",
		flags: "S_MOD_TERM_FUNC_POINTERS",
		desc: "Destructors (term functions)",
		access: "rw-",
	},
};

// x86-64 System V ABI (used by macOS)
const SYSV_AMD64_ABI = {
	integerArgs: ["rdi", "rsi", "rdx", "rcx", "r8", "r9"],
	floatArgs: ["xmm0", "xmm1", "xmm2", "xmm3", "xmm4", "xmm5", "xmm6", "xmm7"],
	returnInt: ["rax", "rdx"],
	returnFloat: ["xmm0", "xmm1"],
	calleeSaved: ["rbx", "rbp", "r12", "r13", "r14", "r15", "rsp"],
	callerSaved: ["rax", "rcx", "rdx", "rsi", "rdi", "r8", "r9", "r10", "r11"],
	stackAlignment: 16,
	redZone: 128,
	notes: [
		"Stack must be 16-byte aligned before CALL instruction",
		"128-byte red zone below RSP (leaf functions may use without adjusting RSP)",
		"Varargs: AL = number of XMM registers used (0-8)",
		"macOS: C symbols have underscore prefix (_main, _printf)",
	],
};

// macOS syscall: rax = 0x2000000 | nr, then syscall instruction
// args in: rdi, rsi, rdx, r10 (NOT rcx!), r8, r9
const SYSCALL_ABI = {
	note: "macOS BSD syscalls: RAX = 0x2000000 | syscall_nr. Args: rdi, rsi, rdx, r10, r8, r9 (r10 instead of rcx!)",
	classPrefix: "0x2000000",
	argRegisters: ["rdi", "rsi", "rdx", "r10", "r8", "r9"],
	returnRegisters: ["rax", "rdx"],
	errorFlag: "CF (carry flag) set on error; errno in rax",
};

const schema = {
	action: z
		.enum([
			"mangle_symbol",
			"demangle_symbol",
			"syscall_info",
			"section_info",
			"calling_convention",
			"stack_alignment",
		])
		.describe(
			"Action: mangle_symbol (add _ prefix for Mach-O), demangle_symbol (remove _ prefix), syscall_info (macOS BSD syscall nr/args), section_info (.text/.data/.bss info), calling_convention (x86-64 SysV ABI register usage), stack_alignment (check/compute 16-byte alignment)",
		),
	value: z
		.string()
		.optional()
		.describe("Symbol name, section name, or syscall name depending on action"),
	stackDepth: z
		.number()
		.int()
		.optional()
		.describe("Number of bytes pushed on stack (for stack_alignment)"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

export function execute(input: Input): string {
	switch (input.action) {
		case "mangle_symbol": {
			const name = String(input.value ?? "").trim();
			if (!name) throw new Error("value (symbol name) is required");
			const mangled = name.startsWith("_") ? name : `_${name}`;
			return JSON.stringify({
				input: name,
				mangled,
				note: "macOS Mach-O requires leading underscore for C/extern symbols",
				gasDirective: `.globl ${mangled}`,
				nasmDirective: `global ${mangled}`,
			});
		}
		case "demangle_symbol": {
			const name = String(input.value ?? "").trim();
			if (!name) throw new Error("value (symbol name) is required");
			const demangled = name.startsWith("_") ? name.slice(1) : name;
			return JSON.stringify({
				input: name,
				demangled,
				hadPrefix: name.startsWith("_"),
			});
		}
		case "syscall_info": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) {
				// Return all syscalls
				const list = Object.entries(MACOS_SYSCALLS).map(([k, v]) => ({
					name: k,
					nr: v.nr,
					rax: `0x${(0x2000000 | v.nr).toString(16).toUpperCase()}`,
					desc: v.desc,
				}));
				return JSON.stringify({ syscalls: list, abi: SYSCALL_ABI });
			}
			const sc = MACOS_SYSCALLS[name];
			if (!sc) {
				const available = Object.keys(MACOS_SYSCALLS).join(", ");
				throw new Error(
					`Unknown macOS syscall '${name}'. Available: ${available}`,
				);
			}
			const raxValue = 0x2000000 | sc.nr;
			return JSON.stringify({
				name,
				nr: sc.nr,
				rax: `0x${raxValue.toString(16).toUpperCase()}`,
				raxDecimal: raxValue,
				description: sc.desc,
				args: sc.args,
				argRegisters: SYSCALL_ABI.argRegisters.slice(0, sc.args.length),
				argsWithRegisters: sc.args.map((a, i) => ({
					register: SYSCALL_ABI.argRegisters[i] ?? "stack",
					arg: a,
				})),
				ret: sc.ret,
				returnRegister: "rax",
				errorCheck: "CF set on error; errno value in rax",
				abi: SYSCALL_ABI,
				gasExample: [
					`mov $0x${raxValue.toString(16).toUpperCase()}, %rax`,
					"syscall",
				],
				nasmExample: [
					`mov rax, 0x${raxValue.toString(16).toUpperCase()}`,
					"syscall",
				],
			});
		}
		case "section_info": {
			const name = String(input.value ?? "")
				.trim()
				.toLowerCase();
			if (!name) {
				return JSON.stringify({ sections: MACOS_SECTIONS });
			}
			const normalized = name.startsWith(".") ? name : `.${name}`;
			const sec = MACOS_SECTIONS[normalized];
			if (!sec) {
				const available = Object.keys(MACOS_SECTIONS).join(", ");
				throw new Error(
					`Unknown section '${normalized}'. Available: ${available}`,
				);
			}
			return JSON.stringify({
				name: normalized,
				macosSegment: sec.segment,
				macosSection: `${sec.segment},${normalized.toUpperCase().replace(".", "__")}`,
				flags: sec.flags,
				description: sec.desc,
				access: sec.access,
				gasDirective: `.section ${sec.segment},${normalized.replace(".", "__")}`,
				shortDirective: normalized,
				note:
					normalized === ".rodata"
						? "On macOS, .rodata lives in __TEXT segment (unlike Linux where it's in __RODATA segment)"
						: undefined,
			});
		}
		case "calling_convention": {
			const n = input.value ? Number(input.value) : undefined;
			const result: Record<string, unknown> = {
				abi: "System V AMD64 ABI (used by macOS x86-64)",
				integerArgRegisters: SYSV_AMD64_ABI.integerArgs,
				floatArgRegisters: SYSV_AMD64_ABI.floatArgs,
				returnInt: SYSV_AMD64_ABI.returnInt,
				returnFloat: SYSV_AMD64_ABI.returnFloat,
				calleeSaved: SYSV_AMD64_ABI.calleeSaved,
				callerSaved: SYSV_AMD64_ABI.callerSaved,
				stackAlignment: SYSV_AMD64_ABI.stackAlignment,
				redZoneBytes: SYSV_AMD64_ABI.redZone,
				notes: SYSV_AMD64_ABI.notes,
				syscallDifference: "Syscalls use r10 instead of rcx for 4th arg",
			};
			if (n !== undefined && n >= 0) {
				const intRegs = SYSV_AMD64_ABI.integerArgs;
				result.argsForFunction = Array.from({ length: n }, (_, i) => ({
					argIndex: i + 1,
					register:
						i < intRegs.length
							? intRegs[i]
							: `[rsp + ${(i - intRegs.length + 1) * 8}]`,
					location: i < intRegs.length ? "register" : "stack",
				}));
			}
			return JSON.stringify(result);
		}
		case "stack_alignment": {
			const depth =
				input.stackDepth ??
				(input.value !== undefined ? Number(input.value) : undefined);
			if (depth === undefined)
				throw new Error("Provide stackDepth (bytes pushed) or value");
			const aligned = depth % 16 === 0;
			const needed = aligned ? 0 : 16 - (depth % 16);
			const afterCall = (depth + 8) % 16; // +8 for return address pushed by CALL
			return JSON.stringify({
				stackDepth: depth,
				isAligned: aligned,
				alignmentMod16: depth % 16,
				bytesNeededToPad: needed,
				afterCallMod16: afterCall,
				alignedBeforeCall: afterCall === 0,
				note: "Before CALL, RSP must be 16-byte aligned (CALL pushes 8-byte return addr, making RSP mod 16 = 8 at function entry)",
				gasCode:
					needed > 0
						? [
								`subq $${needed}, %rsp`,
								"# ... your code ...",
								`addq $${needed}, %rsp`,
							]
						: ["# already aligned"],
			});
		}
		default:
			throw new Error(
				`Unknown action: ${(input as { action: string }).action}`,
			);
	}
}

export const tool: ToolDefinition = {
	name: "asm_macho",
	description:
		"macOS Mach-O and x86-64 ABI helpers: symbol mangling (underscore prefix), macOS BSD syscall numbers/registers (0x2000000 prefix), Mach-O section info (__TEXT/__DATA), x86-64 System V calling convention (register assignment, callee/caller-saved), and stack alignment checks.",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
