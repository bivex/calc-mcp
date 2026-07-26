import { describe, expect, test } from "bun:test";
import { execute } from "../../src/tools/geometry.js";

describe("geometry tool", () => {
	test("calculates Haversine distance between NYC and London", () => {
		const result = JSON.parse(
			execute({
				action: "haversine",
				lat1: 40.7128,
				lon1: -74.006,
				lat2: 51.5074,
				lon2: -0.1278,
				unit: "km",
			}),
		);
		expect(result.distance).toBeCloseTo(5570, -1);
	});

	test("calculates polygon area using Shoelace formula", () => {
		// Square 10x10 -> Area 100, Perimeter 40
		const result = JSON.parse(
			execute({
				action: "polygon_area",
				vertices: [
					{ x: 0, y: 0 },
					{ x: 10, y: 0 },
					{ x: 10, y: 10 },
					{ x: 0, y: 10 },
				],
			}),
		);
		expect(result.area).toBe(100);
		expect(result.perimeter).toBe(40);
	});

	test("calculates 3D sphere volume and surface area", () => {
		const result = JSON.parse(
			execute({
				action: "shape_3d",
				shape: "sphere",
				radius: 3,
			}),
		);
		expect(result.volume).toBeCloseTo(113.0973, 2);
		expect(result.surfaceArea).toBeCloseTo(113.0973, 2);
	});
});
