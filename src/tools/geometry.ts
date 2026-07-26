import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const pointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const schema = {
	action: z
		.enum(["haversine", "polygon_area", "shape_3d"])
		.describe(
			"Geometry action: haversine (GPS distance), polygon_area, or shape_3d",
		),
	lat1: z.number().optional().describe("Latitude of point 1 in degrees"),
	lon1: z.number().optional().describe("Longitude of point 1 in degrees"),
	lat2: z.number().optional().describe("Latitude of point 2 in degrees"),
	lon2: z.number().optional().describe("Longitude of point 2 in degrees"),
	unit: z
		.enum(["km", "miles", "meters"])
		.optional()
		.describe("Distance unit for haversine (default: km)"),
	vertices: z
		.array(pointSchema)
		.optional()
		.describe("Array of 2D points [{x, y}] for polygon_area"),
	shape: z
		.enum([
			"sphere",
			"cylinder",
			"cone",
			"torus",
			"box",
			"pyramid",
			"ellipsoid",
		])
		.optional()
		.describe("3D shape type"),
	radius: z.number().optional().describe("Radius or primary radius"),
	radius2: z
		.number()
		.optional()
		.describe("Secondary radius (e.g. for torus, ellipsoid)"),
	radius3: z
		.number()
		.optional()
		.describe("Tertiary radius (e.g. for ellipsoid c)"),
	height: z.number().optional().describe("Height"),
	length: z.number().optional().describe("Length"),
	width: z.number().optional().describe("Width"),
};

const inputSchema = z.object(schema);
type Input = z.infer<typeof inputSchema>;

function calculateHaversine(input: Input): string {
	const { lat1, lon1, lat2, lon2 } = input;
	if (
		lat1 === undefined ||
		lon1 === undefined ||
		lat2 === undefined ||
		lon2 === undefined
	) {
		throw new Error("lat1, lon1, lat2, and lon2 are required for haversine");
	}

	const unit = input.unit ?? "km";
	const R = unit === "miles" ? 3958.8 : unit === "meters" ? 6371000 : 6371;

	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const radLat1 = (lat1 * Math.PI) / 180;
	const radLat2 = (lat2 * Math.PI) / 180;

	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return JSON.stringify({
		from: { lat: lat1, lon: lon1 },
		to: { lat: lat2, lon: lon2 },
		distance: Number(distance.toFixed(4)),
		unit,
	});
}

function calculatePolygonArea(input: Input): string {
	const vertices = input.vertices;
	if (!vertices || vertices.length < 3) {
		throw new Error("At least 3 vertices [{x, y}] required for polygon_area");
	}

	let areaSum = 0;
	let perimeter = 0;
	const n = vertices.length;

	for (let i = 0; i < n; i++) {
		const curr = vertices[i];
		const next = vertices[(i + 1) % n];
		if (!curr || !next) continue;

		areaSum += curr.x * next.y - next.x * curr.y;

		const dx = next.x - curr.x;
		const dy = next.y - curr.y;
		perimeter += Math.sqrt(dx * dx + dy * dy);
	}

	const area = Math.abs(areaSum) / 2;

	return JSON.stringify({
		vertexCount: n,
		area: Number(area.toFixed(4)),
		perimeter: Number(perimeter.toFixed(4)),
	});
}

function calculateShape3D(input: Input): string {
	const shape = input.shape ?? "sphere";
	const r = input.radius ?? 0;
	const r2 = input.radius2 ?? r;
	const r3 = input.radius3 ?? r;
	const h = input.height ?? 0;
	const l = input.length ?? 0;
	const w = input.width ?? 0;

	let volume = 0;
	let surfaceArea = 0;

	switch (shape) {
		case "sphere": {
			if (r <= 0) throw new Error("radius is required for sphere");
			volume = (4 / 3) * Math.PI * r ** 3;
			surfaceArea = 4 * Math.PI * r ** 2;
			break;
		}
		case "cylinder": {
			if (r <= 0 || h <= 0)
				throw new Error("radius and height required for cylinder");
			volume = Math.PI * r ** 2 * h;
			surfaceArea = 2 * Math.PI * r * (r + h);
			break;
		}
		case "cone": {
			if (r <= 0 || h <= 0)
				throw new Error("radius and height required for cone");
			volume = (1 / 3) * Math.PI * r ** 2 * h;
			const slant = Math.sqrt(r ** 2 + h ** 2);
			surfaceArea = Math.PI * r * (r + slant);
			break;
		}
		case "torus": {
			// Major radius R (r), Minor radius r (r2)
			const R = Math.max(r, r2);
			const rMinor = Math.min(r, r2);
			if (R <= 0 || rMinor <= 0)
				throw new Error("radius and radius2 required for torus");
			volume = 2 * Math.PI ** 2 * R * rMinor ** 2;
			surfaceArea = 4 * Math.PI ** 2 * R * rMinor;
			break;
		}
		case "box": {
			if (l <= 0 || w <= 0 || h <= 0)
				throw new Error("length, width, and height required for box");
			volume = l * w * h;
			surfaceArea = 2 * (l * w + l * h + w * h);
			break;
		}
		case "pyramid": {
			// Rectangular pyramid base l x w
			if (l <= 0 || w <= 0 || h <= 0)
				throw new Error("length, width, and height required for pyramid");
			volume = (1 / 3) * l * w * h;
			const slantL = Math.sqrt((w / 2) ** 2 + h ** 2);
			const slantW = Math.sqrt((l / 2) ** 2 + h ** 2);
			surfaceArea = l * w + l * slantL + w * slantW;
			break;
		}
		case "ellipsoid": {
			if (r <= 0 || r2 <= 0 || r3 <= 0)
				throw new Error(
					"radius (a), radius2 (b), and radius3 (c) required for ellipsoid",
				);
			volume = (4 / 3) * Math.PI * r * r2 * r3;
			// Thomson's approximation for ellipsoid surface area (p ≈ 1.6075)
			const p = 1.6075;
			const ap = r ** p;
			const bp = r2 ** p;
			const cp = r3 ** p;
			surfaceArea =
				4 * Math.PI * ((ap * bp + ap * cp + bp * cp) / 3) ** (1 / p);
			break;
		}
	}

	return JSON.stringify({
		shape,
		volume: Number(volume.toFixed(4)),
		surfaceArea: Number(surfaceArea.toFixed(4)),
	});
}

export function execute(input: Input): string {
	switch (input.action) {
		case "haversine":
			return calculateHaversine(input);
		case "polygon_area":
			return calculatePolygonArea(input);
		case "shape_3d":
			return calculateShape3D(input);
	}
}

export const tool: ToolDefinition = {
	name: "geometry",
	description:
		"Geometric calculations: Haversine GPS distance, 2D polygon area/perimeter (Shoelace formula), and 3D shape volume/surface area",
	schema,
	handler: async (args: Record<string, unknown>) => {
		const input = inputSchema.parse(args);
		return execute(input);
	},
};
