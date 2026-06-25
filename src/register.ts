// Minimal shape of Vite's `import.meta.hot`, so this package doesn't depend on
// `vite/client` types. The app passes its own `import.meta.hot` in.
interface HotContext {
	on(event: string, cb: (...args: Array<unknown>) => void): void;
}

export interface RegisterWsrOptions {
	/**
	 * Pass `import.meta.hot` from your (Vite-served) registration module to enable
	 * the dev instant-update bridge: when the plugin rebuilds the worker, it emits
	 * a `wsr:update` event; we pull the new worker, which activates, claims, and
	 * triggers the reload below. Omit in non-Vite contexts.
	 */
	hot?: HotContext;
}

/**
 * Registers the SW service worker (`/sw.js`) and keeps it fresh in dev.
 *
 * A service worker can't be hot-swapped — only replaced through install→
 * activate. So when a NEW worker takes control we reload, so the document is
 * re-rendered by it (gated on the page already being controlled, so a first
 * visit doesn't reload). With `hot`, we also proactively pull the new worker on
 * the plugin's `wsr:update` signal instead of waiting for the next navigation.
 */
export async function registerWsr(
	options: RegisterWsrOptions = {},
): Promise<ServiceWorkerRegistration | undefined> {
	if (!("serviceWorker" in navigator)) return undefined;

	const hadController = !!navigator.serviceWorker.controller;
	let reloading = false;
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (reloading || !hadController) return;
		reloading = true;
		window.location.reload();
	});

	try {
		const registration = await navigator.serviceWorker.register("/sw.js", {
			scope: "/",
			type: "module",
			// Always revalidate the worker script instead of using the HTTP cache,
			// so update() picks up edits immediately.
			updateViaCache: "none",
		});

		options.hot?.on("wsr:update", () => {
			void registration.update();
		});

		return registration;
	} catch {
		return undefined;
	}
}
