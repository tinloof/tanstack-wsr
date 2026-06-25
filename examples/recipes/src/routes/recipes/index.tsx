import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Clock, Sparkles } from "lucide-react";
import { useState } from "react";

import { Shell } from "#/components/shell";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { getStoredIds, getStoredRecipes, storeRecipe } from "#/lib/db";
import { SEED_RECIPES, TOTAL_RECIPES } from "#/lib/recipes";

// wsr: true → on a hard load the service worker renders this from IndexedDB
// (zero flash, offline); on SPA navigation the client renders it. The loader
// runs in whichever environment handled the request.
export const Route = createFileRoute("/recipes/")({
	wsr: true,
	loader: async () => ({ recipes: await getStoredRecipes() }),
	component: RecipesPage,
});

function RecipesPage() {
	const { recipes } = Route.useLoaderData();
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	const count = recipes.length;
	const complete = count >= TOTAL_RECIPES;

	// Generate runs on the client (after hydration). It writes to IndexedDB and
	// invalidates the router — which re-runs the loader on the main thread and
	// re-renders the list. No reload needed.
	async function generate() {
		const stored = new Set(await getStoredIds());
		const remaining = SEED_RECIPES.filter((r) => !stored.has(r.id));
		if (remaining.length === 0) return;
		const pick = remaining[Math.floor(Math.random() * remaining.length)];
		setBusy(true);
		await storeRecipe(pick);
		await router.invalidate();
		setBusy(false);
	}

	return (
		<Shell>
			<header className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between gap-3">
					<h1 className="font-heading text-2xl font-semibold tracking-tight">
						Recipes
					</h1>
					<span className="text-xs text-muted-foreground tabular-nums">
						{count} / {TOTAL_RECIPES}
					</span>
				</div>
				<p className="text-sm text-muted-foreground">
					A local-first recipe book. Conjure dishes one at a time — everything
					lives in your browser, rendered inside a service worker.
				</p>
				<Button
					type="button"
					size="lg"
					onClick={generate}
					disabled={complete || busy}
					className="mt-1 self-start"
				>
					<Sparkles />
					{complete ? "All recipes generated" : "Generate a recipe"}
				</Button>
			</header>

			<main className="mt-8">
				{count === 0 ? (
					<div className="flex flex-col items-center gap-2 rounded-none border border-dashed py-16 text-center">
						<Sparkles className="size-5 text-muted-foreground" />
						<p className="text-sm font-medium">No recipes yet</p>
						<p className="max-w-xs text-xs text-muted-foreground">
							Tap <span className="font-medium">Generate a recipe</span> to add
							your first dish.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-4">
						{recipes.map((recipe) => (
							<Link
								key={recipe.id}
								to="/recipes/$recipeId"
								params={{ recipeId: recipe.id }}
								className="group block transition-transform active:translate-y-px"
							>
								<Card className="h-full transition-shadow group-hover:ring-foreground/25">
									<img
										src={recipe.image}
										alt={recipe.title}
										loading="lazy"
										className="aspect-[3/2] w-full object-cover"
									/>
									<CardHeader>
										<CardTitle>{recipe.title}</CardTitle>
										<CardDescription className="line-clamp-2">
											{recipe.description}
										</CardDescription>
									</CardHeader>
									<CardContent className="mt-auto flex items-center gap-1.5 text-muted-foreground">
										<Clock className="size-3.5" />
										<span className="tabular-nums">{recipe.minutes} min</span>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</main>
		</Shell>
	);
}
