# packages/modules

Grouping directory for the platform's business modules (Modular Monolith —
ADR-002). This directory is not itself a workspace package; each subfolder
is an independent package discovered via the `packages/modules/*` glob in
`pnpm-workspace.yaml`.
