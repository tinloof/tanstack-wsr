import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Each link advertises where that route renders on a cold load — the whole point
// of the demo: Home is SSR, Recipes is rendered in the service worker. In-app
// navigation between them is a normal SPA transition (this header never reloads;
// the underline just slides).
const NAV = [
	{ to: "/", label: "Home", emoji: "🏠", mode: "ssr" },
	{ to: "/recipes", label: "Recipes", emoji: "🍳", mode: "wsr" },
] as const;

function isActive(pathname: string, to: string) {
	return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function Header() {
	const { pathname } = useLocation();
	const navRef = useRef<HTMLElement>(null);
	// Sliding active-underline. Measured on the client; hidden until measured so
	// the SSR/SW markup and first client render match (no hydration mismatch).
	const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
	const [animate, setAnimate] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is an intentional trigger — it re-runs the effect to re-measure the active link's underline on navigation (it's read in the JSX via data-active, not in the effect body).
	useEffect(() => {
		const active = navRef.current?.querySelector<HTMLElement>(
			'[data-active="true"]',
		);
		if (!active) return;
		setBar({ left: active.offsetLeft, width: active.offsetWidth });
		// Enable the slide only after the first positioning, so it doesn't animate
		// in from the corner on load.
		const id = requestAnimationFrame(() => setAnimate(true));
		return () => cancelAnimationFrame(id);
	}, [pathname]);

	return (
		<header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
			<div className="mx-auto flex h-12 w-full max-w-2xl items-center px-5">
				<nav ref={navRef} className="relative flex items-center gap-5">
					{NAV.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							data-active={isActive(pathname, item.to)}
							className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[active=true]:text-foreground"
						>
							<span aria-hidden>{item.emoji}</span>
							{item.label}
							<span className="rounded-sm bg-muted px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
								{item.mode}
							</span>
						</Link>
					))}
					<span
						className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-foreground"
						style={{
							left: bar?.left ?? 0,
							width: bar?.width ?? 0,
							opacity: bar ? 1 : 0,
							transition: animate
								? "left .25s ease, width .25s ease, opacity .15s ease"
								: "none",
						}}
					/>
				</nav>
			</div>
		</header>
	);
}
