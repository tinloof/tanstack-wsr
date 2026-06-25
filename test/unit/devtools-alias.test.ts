import { describe, expect, it } from "vitest";
import { DEVTOOLS_ALIAS } from "../../src/vite";

// The alias must catch every Solid-based devtools package (and subpaths) so they
// never reach the worker bundle, WITHOUT catching the real router packages.
describe("DEVTOOLS_ALIAS.find", () => {
	const re = DEVTOOLS_ALIAS.find;

	it.each([
		"@tanstack/react-devtools",
		"@tanstack/react-router-devtools",
		"@tanstack/devtools",
		"@tanstack/router-devtools-core",
		"@tanstack/react-devtools/dist/x.js",
		"@tanstack/devtools/dist/devtools/LY5FZR75.js",
	])("matches %s", (id) => {
		expect(re.test(id)).toBe(true);
	});

	it.each([
		"@tanstack/react-router",
		"@tanstack/router-core",
		"@tanstack/react-start",
		"react",
		"@tanstack/devtools-vite",
	])("does NOT match %s", (id) => {
		expect(re.test(id)).toBe(false);
	});
});
