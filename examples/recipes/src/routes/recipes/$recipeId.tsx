import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";

import { Shell } from "#/components/shell";
import { Button } from "#/components/ui/button";
import { getStoredRecipe } from "#/lib/db";

// wsr: true → rendered in the service worker on a hard load (from IndexedDB),
// on the client during SPA navigation.
export const Route = createFileRoute("/recipes/$recipeId")({
	wsr: true,
	loader: async ({ params }) => {
		const recipe = await getStoredRecipe(params.recipeId);
		if (!recipe) throw notFound();
		return { recipe };
	},
	component: RecipePage,
});

function RecipePage() {
	const { recipe } = Route.useLoaderData();
	return (
		<Shell>
			<Link to="/recipes" className="self-start">
				<Button variant="ghost" size="sm" className="-ml-2">
					<ArrowLeft />
					All recipes
				</Button>
			</Link>

			<article className="mt-4 flex flex-col gap-5">
				<img
					src={recipe.image}
					alt={recipe.title}
					className="aspect-[16/9] w-full rounded-none object-cover ring-1 ring-foreground/10"
				/>
				<div className="flex items-start justify-between gap-4">
					<h1 className="font-heading text-2xl font-semibold tracking-tight">
						{recipe.title}
					</h1>
					<span className="mt-1.5 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
						<Clock className="size-3.5" />
						<span className="tabular-nums">{recipe.minutes} min</span>
					</span>
				</div>
				<p className="text-sm leading-relaxed text-muted-foreground">
					{recipe.description}
				</p>
			</article>
		</Shell>
	);
}
