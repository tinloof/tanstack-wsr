import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, WifiOff, Zap } from "lucide-react";

import { Shell } from "#/components/shell";
import { Button } from "#/components/ui/button";

// A NORMAL route — no `wsr: true`. On a hard load it's server-rendered by
// Cloudflare/Start (the worker passes it through to the origin); on SPA
// navigation it's client-rendered.
export const Route = createFileRoute("/")({
	component: Home,
});

const FEATURES = [
	{ icon: Zap, text: "Zero-flash hard loads, rendered on-device" },
	{ icon: WifiOff, text: "Works offline — no origin roundtrip" },
	{ icon: Sparkles, text: "Normal SPA navigation between every page" },
];

function Home() {
	return (
		<Shell>
			<div className="flex flex-col gap-6">
				<h1 className="font-heading text-3xl font-semibold tracking-tight">
					A local-first recipe book
				</h1>
				<p className="text-sm leading-relaxed text-muted-foreground">
					This page is{" "}
					<strong className="text-foreground">server-rendered</strong>. The{" "}
					<strong className="text-foreground">Recipes</strong> section is
					rendered{" "}
					<strong className="text-foreground">in a service worker</strong>,
					straight from IndexedDB on your device — instant, offline, zero flash.
					Same app, same router, same <code>&lt;Link&gt;</code>; only the
					rendering location differs per route.
				</p>
				<ul className="flex flex-col gap-2.5">
					{FEATURES.map(({ icon: Icon, text }) => (
						<li
							key={text}
							className="flex items-center gap-2.5 text-sm text-muted-foreground"
						>
							<Icon className="size-4 shrink-0 text-foreground" />
							{text}
						</li>
					))}
				</ul>
				<Link to="/recipes" className="self-start">
					<Button size="lg">
						Browse recipes
						<ArrowRight />
					</Button>
				</Link>
			</div>
		</Shell>
	);
}
