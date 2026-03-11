# Contributing to assign-to-claude

Thanks for your interest in contributing! This guide will help you get started.

## Development setup

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/assign-to-claude.git
cd assign-to-claude

# Install dependencies
npm install

# Build
npm run build

# Run tests
node test.mjs
```

## Making changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes in `src/`

3. Build and test:
   ```bash
   npm run build
   node test.mjs
   ```

4. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add support for new PM tool"
   ```

   We use [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `chore:` — maintenance (deps, CI, etc.)

5. Push and open a PR against `main`

## Project structure

```
src/
  cli.ts              # CLI entry point
  commands/init.ts    # Interactive setup flow
  templates/generate.ts  # File generator
  adapters/           # PM tool adapters (linear, jira, asana, clickup, github-issues)
  platforms/          # Hosting platforms (netlify, vercel, cloudflare)
  utils/              # CI guard, env detection
  types.ts            # Shared TypeScript types
test.mjs              # Test suite
```

## Adding a new PM tool adapter

1. Create `src/adapters/your-tool.ts` — implement the `PMAdapter` interface
2. Register it in `src/adapters/index.ts`
3. Add the tool to the `PMTool` type in `src/types.ts`
4. Add event type in `src/templates/generate.ts` (`EVENT_TYPE` map)
5. Add tests in `test.mjs`

## Adding a new hosting platform

1. Create `src/platforms/your-platform.ts` — implement the `Platform` interface
2. Register it in `src/platforms/index.ts`
3. Add the platform to the `HostingPlatform` type in `src/types.ts`
4. Add the platform wrapper in `src/templates/generate.ts`
5. Add tests in `test.mjs`

## Code style

- TypeScript strict mode
- No runtime dependency on this package — generated files must be standalone
- Keep the CLI output clean and readable

## Questions?

Open an issue if something is unclear. We're happy to help.
