// DESIGN.md §2 color tokens for the Cytoscape stylesheet.
// Cytoscape style values must be literal CSS colors, so the tokens live here
// (single source) instead of scattered hex strings in Graph.tsx.
export const TOK = {
  bg: '#0B1220',
  text: '#E6EDF7',
  muted: '#8FA0BF',
  border: '#22304D',
  primary: '#0E7C86',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
  diff: '#A78BFA',
} as const;

export const TYPE_COLOR: Record<string, string> = {
  user: TOK.info,
  device: TOK.primary,
  server: TOK.primary,
  credential: TOK.warning,
  service_token: TOK.diff,
  service: TOK.muted,
  database: TOK.success,
};
