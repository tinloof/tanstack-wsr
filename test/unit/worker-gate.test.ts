import { describe, expect, it } from "vitest";
import { isNavigationRequest, isWsrChain } from "../../src/worker";

const ORIGIN = "https://app.test";

function req(url: string, init?: RequestInit) {
	return new Request(url, init);
}

describe("isNavigationRequest", () => {
	it("accepts a same-origin GET document navigation", () => {
		const r = req(`${ORIGIN}/recipes`, { headers: { accept: "text/html" } });
		expect(isNavigationRequest(r, new URL(r.url), ORIGIN)).toBe(true);
	});

	it("rejects non-GET", () => {
		const r = req(`${ORIGIN}/recipes`, {
			method: "POST",
			headers: { accept: "text/html" },
		});
		expect(isNavigationRequest(r, new URL(r.url), ORIGIN)).toBe(false);
	});

	it("rejects non-HTML accept (assets)", () => {
		const r = req(`${ORIGIN}/app.js`, { headers: { accept: "*/*" } });
		expect(isNavigationRequest(r, new URL(r.url), ORIGIN)).toBe(false);
	});

	it("rejects cross-origin", () => {
		const r = req("https://other.test/recipes", {
			headers: { accept: "text/html" },
		});
		expect(isNavigationRequest(r, new URL(r.url), ORIGIN)).toBe(false);
	});
});

describe("isWsrChain (chain-aware gate)", () => {
	it("true when the leaf is marked", () => {
		expect(
			isWsrChain([{ options: {} }, { options: {} }, { options: { wsr: true } }]),
		).toBe(true);
	});

	it("true when a parent/layout is marked (leaf is not)", () => {
		expect(
			isWsrChain([{ options: {} }, { options: { wsr: true } }, { options: {} }]),
		).toBe(true);
	});

	it("true when the root is marked", () => {
		expect(isWsrChain([{ options: { wsr: true } }, { options: {} }])).toBe(true);
	});

	it("false when no route in the chain is marked", () => {
		expect(isWsrChain([{ options: {} }, { options: { wsr: false } }])).toBe(
			false,
		);
	});

	it("false for an empty chain (unmatched, root not marked)", () => {
		expect(isWsrChain([])).toBe(false);
	});
});
