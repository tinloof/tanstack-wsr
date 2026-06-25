import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { WsrRegister } from "@tinloof/tanstack-wsr/react";

import { Header } from "#/components/header";
import { NotFound } from "#/components/not-found";
import appCss from "../styles.css?url";

const FAVICON =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8D%B3%3C/text%3E%3C/svg%3E";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Recipes · TanStack SW" },
		],
		links: [
			{ rel: "icon", href: FAVICON },
			{ rel: "stylesheet", href: appCss },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<Header />
				{children}
				{/* Registers /sw.js (dev + prod). */}
				<WsrRegister hot={import.meta.hot} />
				{/* Devtools render only on the client; the worker build aliases them to
            a no-op so their Solid dependency never reaches /sw.js. */}
				<TanStackDevtools
					plugins={[
						{
							name: "TanStack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
