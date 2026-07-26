import { describe, expect, test } from "bun:test";
import { executeCapabilities } from "../../src/tools/capabilities.js";

describe("capabilities tool", () => {
	test("returns capabilities metadata", () => {
		const res = JSON.parse(executeCapabilities());
		expect(res.name).toBe("@coo-quack/calc-mcp");
		expect(res.capabilities.batch.supportsDependencies).toBe(true);
		expect(res.capabilities.batch.supportsParallel).toBe(true);
		expect(res.capabilities.convert.categories).toContain("typography");
	});
});
