import { CLIENT_VISIBLE_VALUE } from "./secrets";

// Ordinary client component: its value legitimately ships in the bundle (browser
// parity). The leak test asserts CLIENT_VISIBLE_VALUE IS present, to document
// that only server-only bodies are stripped — not all imported strings.
export function ProbeComponent() {
	return <span>{CLIENT_VISIBLE_VALUE}</span>;
}
