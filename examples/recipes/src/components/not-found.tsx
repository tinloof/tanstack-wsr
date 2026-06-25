import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Shell } from "#/components/shell";
import { Button } from "#/components/ui/button";

export function NotFound() {
	return (
		<Shell>
			<div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
				<h1 className="font-heading text-2xl font-semibold">
					Recipe not found
				</h1>
				<p className="max-w-xs text-sm text-muted-foreground">
					This recipe hasn&apos;t been generated yet, or the link is wrong.
				</p>
				<Link to="/recipes">
					<Button variant="outline" size="sm">
						<ArrowLeft />
						All recipes
					</Button>
				</Link>
			</div>
		</Shell>
	);
}
