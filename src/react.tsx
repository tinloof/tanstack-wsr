import { useEffect } from "react";
import { type RegisterWsrOptions, registerWsr } from "./register";

// Bring the `wsr` route-option augmentation into apps that import this component
// (i.e. render <WsrRegister> in their root). This MUST re-export a named type,
// not a side-effect `import './types'`: tsdown drops side-effect imports from
// the generated .d.ts, which would orphan the augmentation and leave `wsr: true`
// untyped in consumer apps.
export type { WsrRouteOption } from "./types";

/**
 * Registers the SW service worker from your app's root. Renders nothing.
 *
 * Render it once in your root document and pass `import.meta.hot` to enable the
 * dev instant-update bridge (it must be read here, in your own Vite-served
 * module, since the package can't access your `import.meta`):
 *
 * ```tsx
 * <WsrRegister hot={import.meta.hot} />
 * ```
 *
 * Because it ships in your client bundle, it registers in production too.
 */
export function WsrRegister({ hot }: RegisterWsrOptions = {}) {
	useEffect(() => {
		void registerWsr({ hot });
		// Register once on mount; `hot` is stable for the page's lifetime.
	}, [hot]);
	return null;
}
