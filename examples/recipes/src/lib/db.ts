import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type { Recipe } from "./recipes";

/**
 * IndexedDB is the single source of truth for which recipes exist. It is read
 * when rendering each route — in the SERVICE WORKER (sw, on a document load)
 * and on the CLIENT (csr, on SPA navigation) — and written from the page (when
 * the user taps "Generate"). All three contexts share the same database.
 *
 * On the ORIGIN (Cloudflare SSR, the very first visit before the worker is in
 * control) there's no IndexedDB, so the reads return empty — the page renders
 * its "no recipes yet" shell, the worker installs, and from then on the SW
 * renders every navigation from the user's local data.
 */
export type StoredRecipe = Recipe & { createdAt: number };

interface RecipesDB extends DBSchema {
	recipes: {
		key: string;
		value: StoredRecipe;
	};
}

const DB_NAME = "recipes-app";
const DB_VERSION = 1;
const STORE = "recipes";

const hasIndexedDB = () => typeof indexedDB !== "undefined";

let dbPromise: Promise<IDBPDatabase<RecipesDB>> | undefined;

function getDB() {
	if (!dbPromise) {
		dbPromise = openDB<RecipesDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: "id" });
				}
			},
		});
	}
	return dbPromise;
}

/** Every generated recipe, newest first. Empty where IndexedDB is unavailable. */
export async function getStoredRecipes(): Promise<StoredRecipe[]> {
	if (!hasIndexedDB()) return [];
	const db = await getDB();
	const recipes = await db.getAll(STORE);
	return recipes.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStoredRecipe(
	id: string,
): Promise<StoredRecipe | undefined> {
	if (!hasIndexedDB()) return undefined;
	const db = await getDB();
	return db.get(STORE, id);
}

export async function getStoredIds(): Promise<string[]> {
	if (!hasIndexedDB()) return [];
	const db = await getDB();
	return db.getAllKeys(STORE);
}

export async function storeRecipe(recipe: Recipe): Promise<void> {
	const db = await getDB();
	await db.put(STORE, { ...recipe, createdAt: Date.now() });
}
