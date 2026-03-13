# Contributing to TS AiTool

Thank you for your interest in contributing to TS AiTool! This guide will help you get started.

## Development Environment Setup

### Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- **VS Code** 1.85.0 or later
- **Git**

### Getting Started

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/<your-username>/ts-aitool.git
cd ts-aitool
```

2. Install dependencies:

```bash
npm install
```

3. Install pre-commit hooks (requires husky):

```bash
npm run prepare
```

4. Open the project in VS Code:

```bash
code .
```

5. Press `F5` to launch the Extension Development Host with the extension loaded.

## Building and Testing

### Development Mode

Run both the extension and webview in watch mode:

```bash
npm run dev
```

This starts two concurrent watchers:
- `dev:extension` -- rebuilds the Node.js extension backend via esbuild
- `dev:webview` -- rebuilds the React webview frontend via Vite

### Production Build

```bash
npm run build
```

### Running Tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev/). Test files live in `src/test/` and follow the `*.test.ts` naming convention.

### Linting

```bash
npm run lint
```

ESLint is configured with `@typescript-eslint` for TypeScript-aware linting.

### Packaging

To create a `.vsix` file for local installation:

```bash
npm run package
```

## Code Style Guidelines

### General

- **TypeScript** is required for all source files. No `any` types unless absolutely necessary.
- Use **ES module** imports (`import`/`export`), not CommonJS (`require`).
- Prefer `const` over `let`. Never use `var`.
- Use **template literals** over string concatenation.

### Naming Conventions

- **Files**: PascalCase for classes/components (`ClaudeService.ts`, `ChatPanel.tsx`), camelCase for utilities (`generateId.ts`).
- **Classes**: PascalCase (`ClaudeService`, `ChatHandler`).
- **Functions/variables**: camelCase (`sendMessage`, `currentProjectId`).
- **Constants**: UPPER_SNAKE_CASE (`BUILT_IN_AGENTS`, `MODEL_PRICING`).
- **Interfaces/Types**: PascalCase (`ChatMessage`, `ToolExecutionResult`).

### Project Structure

```
src/
  extension/           # VS Code extension backend (Node.js)
    handlers/          # Message handlers (Chat, Agent, Git, Settings)
    services/          # Core services (Claude, Git, Export, Projects)
  webview/             # React frontend (Webview)
    components/        # UI components
    state/             # App state management (Context + Reducer)
    utils/             # Utilities
  shared/              # Shared types, constants, and utilities
  test/                # Unit tests (Vitest)
```

### Extension Code (Node.js)

- Keep handler classes focused on message routing; delegate logic to service classes.
- Use VS Code APIs (`vscode.workspace`, `vscode.window`) instead of raw `fs`/`path` where possible.
- Always validate file paths before accessing the filesystem (use `validatePath`).
- Store secrets via `context.secrets`, never in plaintext settings.

### Webview Code (React)

- Use functional components with hooks.
- State management uses React Context + `useReducer` (no external state libraries).
- Use Tailwind CSS for styling. Avoid inline styles except for dynamic values.
- Support RTL layouts -- use logical properties (`ms-`, `me-`, `ps-`, `pe-`) instead of physical ones (`ml-`, `mr-`).
- All user-facing strings must go through `i18next` for internationalization.

### Comments

- Add JSDoc comments to all public methods and exported functions.
- Use Hebrew comments for internal implementation notes where it helps the team.
- Explain *why*, not *what* -- the code should be self-documenting for the *what*.

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` -- New feature
- `fix:` -- Bug fix
- `refactor:` -- Code change that neither fixes a bug nor adds a feature
- `docs:` -- Documentation only
- `test:` -- Adding or updating tests
- `chore:` -- Maintenance tasks (deps, CI, tooling)

Examples:
```
feat: add voice input support for Arabic
fix: CLI timeout on large project scans
refactor: extract tool permission logic into ToolExecutor
docs: add troubleshooting section to README
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** with clear, focused commits.

3. **Run quality checks** before pushing:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Push your branch** and open a Pull Request against `main`.

5. **PR description** should include:
   - A summary of what changed and why
   - Screenshots or GIFs for UI changes
   - Testing steps for reviewers
   - Any breaking changes or migration notes

6. **Code review**: At least one maintainer approval is required before merging.

7. **CI checks** must pass (lint, tests, build).

### PR Tips

- Keep PRs small and focused -- one feature or fix per PR.
- If your PR addresses a GitHub issue, reference it (`Fixes #123`).
- Update documentation if your change affects user-facing behavior.
- Add tests for new features and bug fixes.

## Reporting Issues

- Use GitHub Issues to report bugs or request features.
- Include steps to reproduce, expected behavior, and actual behavior.
- Attach VS Code version, OS, and extension version.
- For CLI-related issues, include the output of `claude --version`.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
