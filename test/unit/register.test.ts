import { afterEach, describe, expect, it, vi } from "vitest";
import { registerWsr } from "../../src/register";

afterEach(() => {
	vi.unstubAllGlobals();
});

function stubServiceWorker() {
	const registration = { update: vi.fn() };
	const register = vi.fn(async () => registration);
	vi.stubGlobal("navigator", {
		serviceWorker: {
			controller: null,
			addEventListener: vi.fn(),
			register,
		},
	});
	return { registration, register };
}

describe("registerWsr", () => {
	it("returns undefined when service workers are unavailable", async () => {
		vi.stubGlobal("navigator", {});
		expect(await registerWsr()).toBeUndefined();
	});

	it("registers /sw.js as a module worker with no HTTP caching", async () => {
		const { register } = stubServiceWorker();
		await registerWsr();
		expect(register).toHaveBeenCalledWith("/sw.js", {
			scope: "/",
			type: "module",
			updateViaCache: "none",
		});
	});

	it("pulls a fresh worker when the dev `wsr:update` bridge fires", async () => {
		const { registration } = stubServiceWorker();
		const handlers: Record<string, () => void> = {};
		const hot = {
			on: (event: string, cb: () => void) => {
				handlers[event] = cb;
			},
		};
		await registerWsr({ hot });
		expect(handlers["wsr:update"]).toBeTypeOf("function");
		handlers["wsr:update"]();
		expect(registration.update).toHaveBeenCalledOnce();
	});
});
