export type Recipe = {
	id: string;
	title: string;
	image: string;
	description: string;
	minutes: number;
};

const img = (id: string) =>
	`https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

/**
 * The full catalogue of recipes the app knows about. The "Generate" CTA on the
 * home page adds one of these (at random) to IndexedDB at a time, until every
 * recipe has been generated.
 */
export const SEED_RECIPES: Recipe[] = [
	{
		id: "margherita-pizza",
		title: "Margherita Pizza",
		image: img("photo-1565299624946-b28f40a0ae38"),
		description:
			"Blistered sourdough base, San Marzano tomatoes, torn buffalo mozzarella and fresh basil — the original, done right.",
		minutes: 40,
	},
	{
		id: "rainbow-grain-bowl",
		title: "Rainbow Grain Bowl",
		image: img("photo-1546069901-ba9599a7e63c"),
		description:
			"Warm quinoa, roasted chickpeas, avocado and a tahini-lemon drizzle. A bright, filling lunch in under twenty minutes.",
		minutes: 20,
	},
	{
		id: "fluffy-pancakes",
		title: "Fluffy Buttermilk Pancakes",
		image: img("photo-1567620905732-2d1ec7ab7445"),
		description:
			"Tall, cloud-soft stacks with crisp edges. Serve with maple syrup and a knob of melting butter.",
		minutes: 25,
	},
	{
		id: "smash-burger",
		title: "Classic Smash Burger",
		image: img("photo-1551782450-a2132b4ba21d"),
		description:
			"Thin, lacy-edged beef patties with melted cheese, pickles and a tangy house sauce on a toasted brioche bun.",
		minutes: 30,
	},
	{
		id: "garlic-pasta",
		title: "Garlic Butter Pasta",
		image: img("photo-1473093295043-cdd812d0e601"),
		description:
			"A weeknight hero: al dente spaghetti tossed in garlic, butter, chilli flakes and a shower of parmesan.",
		minutes: 15,
	},
	{
		id: "harvest-salad",
		title: "Autumn Harvest Salad",
		image: img("photo-1540189549336-e6e99c3679fe"),
		description:
			"Roasted squash, pomegranate, toasted walnuts and feta over peppery greens with a maple vinaigrette.",
		minutes: 25,
	},
	{
		id: "miso-ramen",
		title: "Miso Ramen",
		image: img("photo-1565958011703-44f9829ba187"),
		description:
			"Silky miso broth, springy noodles, soft egg and charred corn. Deep umami comfort in a bowl.",
		minutes: 45,
	},
	{
		id: "buddha-bowl",
		title: "Veggie Buddha Bowl",
		image: img("photo-1512621776951-a57141f2eefd"),
		description:
			"Brown rice, roasted sweet potato, edamame and pickled cabbage finished with a ginger-miso dressing.",
		minutes: 35,
	},
	{
		id: "thai-curry",
		title: "Coconut Thai Curry",
		image: img("photo-1504674900247-0877df9cc836"),
		description:
			"Fragrant red curry simmered with coconut milk, seasonal vegetables and basil. Spoon over jasmine rice.",
		minutes: 30,
	},
	{
		id: "street-tacos",
		title: "Street-Style Tacos",
		image: img("photo-1565557623262-b51c2513a641"),
		description:
			"Charred corn tortillas piled with marinated protein, onion, coriander and a squeeze of lime.",
		minutes: 30,
	},
];

export const TOTAL_RECIPES = SEED_RECIPES.length;
