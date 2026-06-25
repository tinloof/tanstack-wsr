import { describe, expect, it } from "vitest";
import { serverCodeGuard } from "../../src/vite";

// The guard is the fallback used only when Start's client compiler can't be
// loaded; it must flag un-compiled server markers under the app's src, and only
// there. (When the compiler IS present, the guard isn't installed — see vite.ts.)
const APP_SRC = "/app/src/";

// biome-ignore lint/suspicious/noExplicitAny: driving plugin hooks directly
function run(code: string, id: string) {
	const plugin = serverCodeGuard(APP_SRC);
	(plugin as any).transform(code, id);
	let thrown: string | undefined;
	const ctx = {
		error(msg: string) {
			thrown = msg;
			throw new Error(msg);
		},
	};
	try {
		(plugin as any).buildEnd.call(ctx);
	} catch {
		/* expected when there are offenders */
	}
	return thrown;
}

describe("serverCodeGuard", () => {
	it("flags createServerFn in app src and names the file", () => {
		const msg = run("const x = createServerFn()", `${APP_SRC}a.ts`);
		expect(msg).toBeDefined();
		expect(msg).toContain(`${APP_SRC}a.ts`);
	});

	it("flags createServerOnlyFn and bare 'use server'", () => {
		expect(run("createServerOnlyFn(() => {})", `${APP_SRC}b.ts`)).toBeDefined();
		expect(run("'use server'\nexport const x = 1", `${APP_SRC}c.ts`)).toBeDefined();
	});

	it("ignores server markers outside app src (e.g. node_modules)", () => {
		expect(
			run("const x = createServerFn()", "/repo/node_modules/pkg/index.js"),
		).toBeUndefined();
	});

	it("does not flag already-compiled createClientRpc", () => {
		expect(run('createClientRpc("abc")', `${APP_SRC}d.ts`)).toBeUndefined();
	});

	it("strips the query before the appSrc check", () => {
		expect(
			run("const x = createServerFn()", `${APP_SRC}e.ts?tss-split`),
		).toBeDefined();
	});
});
