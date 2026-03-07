# Knotes API — Copilot Instructions

## What This App Does

Knotes API is a notes application backend. It is a Fastify HTTP API deployed as an AWS Lambda function, fronted by API Gateway. Infrastructure is managed with AWS CDK (TypeScript). The project is in early development — the API layer is scaffolded but not yet implemented, and the CDK `AppStack` has four pending constructs (LambdaApi, Database, Storage, Dns) stubbed out as TODOs.

---

## Tech Stack

| Layer           | Technology                                                               |
| --------------- | ------------------------------------------------------------------------ |
| Language        | TypeScript 5.x (strict mode, `ES2022` target)                            |
| API framework   | Fastify v5 + `@fastify/aws-lambda`                                       |
| Lambda runtime  | Node.js 22                                                               |
| Build tool      | esbuild (bundled via a `tsx` script)                                     |
| Infrastructure  | AWS CDK v2 (TypeScript, `NodeNext` modules)                              |
| Testing         | Jest + ts-jest (infrastructure only; API has no tests yet)               |
| Package manager | npm (each workspace has its own `node_modules`)                          |
| Linting         | ESLint + Prettier declared as root devDependencies (no config files yet) |

---

## Project Structure

```
knotes-api/
├── package.json              # Root — shared devDeps (eslint, prettier, typescript)
├── tsconfig.json             # Root tsconfig (ESNext, covers packages/** & infrastructure/**)
├── packages/
│   └── api/
│       ├── package.json      # API-specific deps & scripts
│       ├── scripts/build.ts  # esbuild bundler script (run via tsx)
│       └── src/
│           ├── app.ts        # Fastify factory (createApp)
│           ├── handler.ts    # Lambda entry point (lambdaHandler)
│           ├── controllers/  # Barrel: controllers/index.ts (empty)
│           ├── routes/       # Barrel: routes/index.ts (empty)
│           ├── services/     # Barrel: services/index.ts (empty)
│           ├── middleware/   # Barrel: middleware/index.ts (empty)
│           └── models/       # Barrel: models/index.ts (empty)
└── infrastructure/
    ├── package.json          # CDK deps & scripts
    ├── tsconfig.json         # NodeNext module resolution
    ├── cdk.json              # CDK app: ts-node bin/infrastructure.ts
    ├── bin/infrastructure.ts # Creates Dev & Prod AppStack instances
    ├── lib/
    │   ├── account-stack.ts  # Account-level: GitHub OIDC for CI/CD
    │   ├── app-stack.ts      # App-level (Dev/Prod) — constructs are all TODO
    │   └── constructs/
    │       ├── index.ts      # Barrel export
    │       └── github-oidc.ts # GitHub Actions OIDC IAM role
    └── test/
        └── infrastructure.test.ts # Jest CDK assertion tests
```

**Path aliases** (root tsconfig): `@api/*` → `packages/api/*`, `@infrastructure/*` → `infrastructure/*`

---

## Commands

### API (`packages/api/`)

```bash
cd packages/api
npm install          # install deps (separate node_modules)
npm run build        # esbuild bundle → dist/index.js (CJS, Node 22)
```

The build script (`scripts/build.ts`) reads `node_modules/` to determine externals. All packages except `aws-sdk` / `@aws-sdk` are marked external. The output is `dist/index.js` in CommonJS format.

### Infrastructure (`infrastructure/`)

```bash
cd infrastructure
npm install          # install deps
npm run build        # tsc compile
npm test             # jest (CDK assertion tests)
npx cdk synth        # synthesize CloudFormation
npx cdk deploy KnotesApiAccount   # one-time account bootstrap
npx cdk deploy KnotesApiDev       # deploy Dev environment
npx cdk deploy KnotesApiProd      # deploy Prod environment
```

CDK executes via `ts-node` (configured in `cdk.json`), no pre-compile needed for deploy/synth.

---

## Coding Guidelines

- **TypeScript strict mode** is on everywhere. All code must type-check cleanly.
- **Infrastructure** uses `NodeNext` module resolution — use `.js` extensions on local import paths (e.g., `import { Foo } from './foo.js'`), even when source is `.ts`.
- **API** (root `tsconfig.json`) uses `ESNext`/`node` resolution — no `.js` extensions required on local imports.
- Barrel `index.ts` files exist in all `src/` subdirectories; add new exports through them.
- New CDK constructs belong in `infrastructure/lib/constructs/` and must be re-exported from `constructs/index.ts`.
- `AppStack` has four planned constructs to implement: `LambdaApi`, `Database`, `Storage`, `Dns`.
- No `.eslintrc` or `.prettierrc` config files exist yet — do not rely on auto-formatting enforcement.
- Keep `.copilot-instructions.md` up to date with any relevant coding guidelines or project conventions.
- Make sure tests pass and test coverage is sufficient. Consider adding tests for new features or bug fixes. Follow best practices for test structure and assertions.

---

## Environments & Deployment

| Stack           | Domain                     | `isProd` |
| --------------- | -------------------------- | -------- |
| `KnotesApiDev`  | `knotes-api-dev.kstrm.com` | `false`  |
| `KnotesApiProd` | `knotes-api.kstrm.com`     | `true`   |

GitHub Actions CI/CD uses the OIDC IAM role created by `AccountStack` (`KnotesApiAccount`) — no long-lived AWS credentials needed in CI.

---

## Way of working

- Suggest good git commit messages when code changes using Conventional Commits format
