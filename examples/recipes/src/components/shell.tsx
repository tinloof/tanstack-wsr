import type { ReactNode } from "react";

/** Minimalist, centered column that reads well on phones and desktops alike. */
export function Shell({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-6 pb-16">
			{children}
		</div>
	);
}
