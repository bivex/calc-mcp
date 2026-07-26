# Calc MCP

[![npm version](https://img.shields.io/npm/v/@coo-quack/calc-mcp)](https://www.npmjs.com/package/@coo-quack/calc-mcp)
[![CI](https://github.com/coo-quack/calc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/coo-quack/calc-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<br />
<br />
<img width="100%" alt="Calc MCP demo" src="https://i.imgur.com/DcOhAD4.png" />
<br />
<br />
📖 **[Documentation](https://coo-quack.github.io/calc-mcp/)** — Full tool reference, examples, and install guides.

**45 tools for things AI is not good at** — deterministic math, symbolic derivatives & integration, finance, geometry, graph theory, boolean logic, integer sequences, coding theory, quantum q-calculus, assembly analysis, cryptographic randomness, date arithmetic, encoding, and more.

LLMs hallucinate calculations, can't generate true random numbers, struggle with higher math, and fail at complex algorithms. This MCP server fixes that.

### Quick Start

```bash
# Claude Code
claude mcp add -s user calc-mcp -- npx --prefix /tmp -y @coo-quack/calc-mcp@latest

# Or just run it
npx --prefix /tmp -y @coo-quack/calc-mcp@latest
```

> Works with Claude Desktop, VS Code Copilot, Cursor, Windsurf, and any MCP client — [setup guides below](#install).

---

## Why?

| AI alone                                       | With calc-mcp                                   |
| ---------------------------------------------- | ----------------------------------------------- |
| "10 + 34 × 341 ÷ 23 = 507.8" ❌                | `514.087` ✅ (math)                             |
| "Here's a UUID: 550e8400-..." 🤷 fake          | Cryptographically random UUID v4/v7 ✅ (random) |
| "100 days from now is..." 🤔 guess             | `2026-05-22` ✅ (date)                          |
| "SHA-256 of password123 is..." 💀 hallucinated | `ef92b778bafe...` ✅ (hash)                     |
| "Integrate x^2 from 0 to 1" ❌ (hallucinated)  | `0.333333` ✅ (math)                            |
| "Truth table for (A AND B) OR NOT C" ❌        | Complete $2^N$ table & SDNF/SKNF ✅ (logic)     |

- **Deterministic** — Same input, same correct output, every time
- **Secure** — Sandboxed math, ReDoS protection, weak hash warnings
- **Private** — All computation runs locally, no data sent to external services
- **No server config** — Install once via npx; MCP client setup required
- **No API key** — No account or API key required for calc-mcp itself; requires Node.js

## Examples

Ask in natural language — your AI assistant selects the appropriate tool.

### Higher Math, Geometry & Finance

| You ask                                     | You get                            | Tool       |
| ------------------------------------------- | ---------------------------------- | ---------- |
| Symbolic derivative of `x^3 + sin(x)`       | `3*x^2 + cos(x)`                   | math       |
| Integrate `x^2` from 0 to 1                 | `0.333333`                         | math       |
| Monthly payment for $100k loan at 5% for 15y| `$790.79/mo`                       | finance    |
| GPS distance between NYC and London         | `5570.25 km`                       | geometry   |
| Linear regression slope & R² for dataset    | `r = 0.998, R² = 0.996`            | regression |

### Graphs, Logic & Sequences

| You ask                                     | You get                            | Tool          |
| ------------------------------------------- | ---------------------------------- | ------------- |
| 13 topological indices of graph (DSO, SO...) | `DSO = 12.45, M1 = 40...`          | graph         |
| Truth table & SDNF for `(A AND B) OR NOT C` | `8 rows, SDNF, Tautology: false`   | logic         |
| 50th Fibonacci & 10th Catalan number        | `F_50 = 12586269025`               | sequences     |
| Parity-check matrix for generator matrix G  | `H = [-P^T \| I_{n-k}]`            | coding_theory |
| Strongly connected components of digraph    | `Tarjan SCCs: [[0, 1, 2], [3]]`    | digraph       |
| Jackson q-derivative D_q of `x^3`           | `D_q(x^3) = 7` (for q=0.5, x=2)    | q_calculus    |

### Text, Encoding & Security

| You ask                                    | You get              | Tool   |
| ------------------------------------------ | -------------------- | ------ |
| How many characters in "Hello, World! 🌍"? | `15 chars, 18 bytes` | count  |
| Base64 encode "Hello World"                | `SGVsbG8gV29ybGQ=`   | base64 |
| SHA-256 hash of "password123"              | `ef92b778bafe...`    | hash   |
| Decode JWT token                           | `{ alg: "HS256" }`   | jwt_decode |

---

## All 45 Tools

| Tool                | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `math`              | Higher math: arithmetic, symbolic derivatives, simplification, integration, matrix det/inv/eigs, solve_linear, vectors |
| `finance`           | Loan schedules (annuity/differentiated), NPV, IRR, CAGR, compound interest                               |
| `geometry`          | Haversine GPS distance, 2D Shoelace polygon area/perimeter, 3D shape volume/surface                    |
| `regression`        | Linear regression slope, intercept, Pearson r, R², y-prediction                                         |
| `graph`             | 13 topological graph indices (DSO, SO, Zagreb M1/M2/HM, Randić, GA, Albertson, etc.) & paper sharp bounds |
| `logic`             | Boolean truth tables, canonical SDNF/SKNF normal forms, tautology/contradiction checks                  |
| `sequences`         | Special integer sequences: Fibonacci, Lucas, Jacobsthal, Pell, Catalan, Stirling 1/2, Bell, Partitions   |
| `coding_theory`     | Linear codes: Hamming distance, parity-check matrix H, self-orthogonality check, syndrome decoding      |
| `digraph`           | Directed graphs: Strongly Connected Components (Tarjan), Topological Sort (Kahn), FAS, PageRank          |
| `number_theory`     | Divisors list & sigma_k, Mobius function, Gauss circle lattice points, fractional part sums             |
| `q_calculus`        | Quantum calculus: q-bracket, q-factorial, q-binomial, q-Pochhammer, Jackson q-derivative                 |
| `batch`             | Parallel batch execution of up to 50 requests with dependency graph & variable substitution            |
| `calc_capabilities` | Server capabilities discovery, tool counts, envelope metadata                                           |
| `count`             | Characters (grapheme-aware), words, lines, bytes                                                        |
| `datetime`          | Current time, timezone conversion, UNIX timestamps                                                      |
| `random`            | UUID v4/v7, ULID, passwords (readable, custom charset), random number, shuffle                          |
| `hash`              | MD5, SHA-1, SHA-256, SHA-512, CRC32, HMAC                                                               |
| `base64`            | Base64 encode / decode                                                                                  |
| `encode`            | URL, HTML entity, Unicode escape                                                                        |
| `date`              | Date diff, add/subtract, weekday, wareki, business days                                                 |
| `regex`             | RegEx test, match, matchAll, replace                                                                    |
| `base`              | Number base conversion (2–36)                                                                           |
| `diff`              | Line diff, Levenshtein distance (O(N) memory optimized)                                                 |
| `json_validate`     | Validate JSON, CSV, XML, YAML                                                                           |
| `cron_parse`        | Human-readable cron + next runs (weekday/month names supported)                                         |
| `luhn`              | Luhn algorithm validate / generate check digits                                                         |
| `ip`                | IPv4/IPv6 info, CIDR contains check, range calculation                                                  |
| `color`             | HEX ↔ RGB ↔ HSL (alpha channel supported)                                                               |
| `convert`           | 12 categories, 70+ units: length, weight, temp, area, volume, speed, data, time, pressure, energy, etc.|
| `char_info`         | Unicode code point, block, category                                                                     |
| `jwt_decode`        | Decode header + payload (no verification)                                                               |
| `url_parse`         | Protocol, host, path, params, hash                                                                      |
| `semver`            | Compare, validate, parse, range satisfaction                                                            |
| `asm_arm64`         | ARM64 assembly instruction decoder & analysis                                                           |
| `asm_bitwise`       | Assembly bitwise operation analysis                                                                     |
| `asm_encoding`      | Assembly opcode encoding analysis                                                                       |
| `asm_flags`         | Assembly CPU flag status analysis                                                                       |
| `asm_float`         | Floating-point IEEE-754 representation analysis                                                         |
| `asm_gas`           | GNU Assembler (GAS) syntax helper                                                                       |
| `asm_macho`         | Mach-O binary format header analysis                                                                    |
| `asm_memory`        | Memory alignment & offset calculation                                                                   |
| `asm_numbers`       | Integer representations & endianness analysis                                                           |
| `asm_registers`     | CPU register mapping & width analysis                                                                   |
| `asm_stack`         | Stack frame layout & offset analysis                                                                    |
| `asm_struct`        | C/Assembly struct padding & alignment analysis                                                          |

---

## Install

### Claude Code

```bash
claude mcp add -s user calc-mcp -- npx --prefix /tmp -y @coo-quack/calc-mcp@latest
```

### Claude Desktop / Cursor / Windsurf

Add to your config file:

| App                      | Config path                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| Claude Desktop (macOS)   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json`                     |
| Cursor                   | `~/.cursor/mcp.json`                                              |
| Windsurf                 | `~/.codeium/windsurf/mcp_config.json`                             |

```json
{
  "mcpServers": {
    "calc-mcp": {
      "command": "npx",
      "args": ["--prefix", "/tmp", "-y", "@coo-quack/calc-mcp@latest"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "calc-mcp": {
      "command": "npx",
      "args": ["--prefix", "/tmp", "-y", "@coo-quack/calc-mcp@latest"]
    }
  }
}
```

### Docker Image

Calc MCP is available as a Docker image from GitHub Container Registry:

```bash
docker run --rm -i ghcr.io/coo-quack/calc-mcp:latest
```

Or use in MCP client config:

```json
{
  "mcpServers": {
    "calc-mcp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "ghcr.io/coo-quack/calc-mcp:latest"]
    }
  }
}
```

Available tags:
- `ghcr.io/coo-quack/calc-mcp:latest` — Latest release
- `ghcr.io/coo-quack/calc-mcp:X.Y.Z` — Specific version (replace X.Y.Z with the desired version)

---

## Development

```bash
bun install
bun run dev       # Start dev server
bun test          # Run tests
bun run lint      # Biome
bun run format    # Biome
```

## Security

calc-mcp processes all data **locally** and does **not**:

- ❌ Send data to external servers
- ❌ Log data to files or remote services
- ❌ Store processed data persistently

**For detailed security information, see [SECURITY.md](SECURITY.md).**

## License

MIT
