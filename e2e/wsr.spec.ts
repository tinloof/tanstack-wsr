import { expect, test } from "@playwright/test";

// Waits until the service worker has installed, activated, and claimed the page.
async function waitForController(page: import("@playwright/test").Page) {
	await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
		timeout: 30_000,
	});
}

test.describe("worker-side rendering", () => {
	test("a wsr route is rendered by the service worker and hydrates without mismatch", async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(m.text());
		});
		page.on("pageerror", (e) => errors.push(String(e)));

		// First visit registers the worker; it activates and claims the page.
		await page.goto("/recipes");
		await waitForController(page);

		// Hard reload: now the controlling worker renders the document in-worker.
		await page.reload();
		await waitForController(page);

		await expect(
			page.getByRole("heading", { name: "Recipes", exact: true }),
		).toBeVisible();

		const hydrationErrors = errors.filter((e) =>
			/hydrat|did not match|server (html|rendered)/i.test(e),
		);
		expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
	});

	test("SPA navigation from the SSR home into a wsr route does not full-reload", async ({
		page,
	}) => {
		await page.goto("/");
		await waitForController(page);

		// A marker on window survives a client-side (SPA) navigation but not a full
		// document load — proof the worker isn't intercepting in-app navigation.
		await page.evaluate(() => {
			(window as unknown as { __wsrSentinel?: number }).__wsrSentinel = 1;
		});

		await page.getByRole("link", { name: /Recipes/ }).click();
		await expect(page).toHaveURL(/\/recipes$/);

		const survived = await page.evaluate(
			() => (window as unknown as { __wsrSentinel?: number }).__wsrSentinel === 1,
		);
		expect(survived).toBe(true);
	});
});
