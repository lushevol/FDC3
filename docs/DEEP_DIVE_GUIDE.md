# FDC3 Deep Dive & Hands-On Guide

This guide is designed for engineers who want to understand the entire FDC3 monorepo and confidently work with each package. It supplements the root `README.md` with a deeper architectural tour, setup steps, and practice exercises you can follow end-to-end.

---

## 1. Prerequisites and Environment

- **Node.js**: Install an active LTS release (the FINOS build pipeline currently targets Node 18). Use `nvm use 18` or similar to align your local version.
- **npm**: The repository uses npm workspaces. Ensure you are using the npm version bundled with your Node installation (>= 9). Yarn and pnpm are not officially supported here.
- **Browsers**: The toolbox projects (demo agent, reference UI, workbench, conformance suite) run in the browser. Chrome or Chromium-based browsers are recommended, but Firefox also works.
- **Optional tooling**: GitHub CLI for cloning, VS Code or WebStorm for TypeScript development, and Docker if you want to containerize the dev services.

> ℹ️ The repository vendors workspace dependencies via npm workspaces. After `npm install` completes at the root, each package exposes its own scripts (`build`, `test`, `lint`) that you can run from the workspace directory or via `npm run <script> --workspace <name>`.

---

## 2. First-Time Setup

1. **Clone** the repository: `git clone https://github.com/finos/FDC3.git && cd FDC3`
2. **Install dependencies**: `npm install`
   - This installs dependencies for every workspace.
3. **Verify the build**: `npm run build`
   - Ensures TypeScript builds succeed and generated files are up-to-date.
4. **Run the tests**: `npm run test`
   - Executes the test suites across the standard, get-agent, proxy, and web implementation packages.
5. **Launch dev services** (optional during setup): `npm run dev`
   - Spins up the demo desktop agent, reference UI, conformance UI, and workbench so you can explore the ecosystem.

> 💡 If you only want to install and build a single package, use `npm install --workspace packages/fdc3-get-agent` or run scripts from the package directory (e.g., `cd packages/fdc3-get-agent && npm test`).

---

## 3. Repository Map and How to Explore It

The monorepo is organized into npm workspaces. Each workspace either ships core standard assets or delivers tooling used to exercise implementations.

### Core Standards and Schemas

| Workspace | Purpose | Key Entry Points |
| --- | --- | --- |
| `packages/fdc3-standard` | TypeScript definitions for the Desktop Agent API, errors, intents, contexts, channels, and optional features. | `src/api/DesktopAgent.ts`, `src/api/types.ts`, `src/context/types.ts` |
| `packages/fdc3-context` | JSON Schemas and generated TypeScript for standard and experimental context types. | `schemas/context/*.json`, `src/generated/*.ts` |
| `packages/fdc3-schema` | Schemas and typings for Desktop Agent Communication Protocol (DACP), Web Connection Protocol (WCP), and bridging messages. | `src/browser/index.ts`, `src/bridge/index.ts` |
| `packages/fdc3` | The main npm distribution that re-exports the standard API and context definitions. | `src/index.ts` |
| `packages/fdc3-commonjs` | CommonJS bundle for legacy tooling environments. | `src/index.ts`, `rollup.config.mjs` |

### Runtime Implementations

| Workspace | Purpose | Key Entry Points |
| --- | --- | --- |
| `packages/fdc3-get-agent` | Browser helper that discovers a Desktop Agent (preload, proxy, or failover) and returns a standard-compliant `DesktopAgent`. | `src/strategies/getAgent.ts`, `src/strategies/PostMessageLoader.ts`, `src/ui/*` |
| `packages/fdc3-agent-proxy` | Transport-agnostic Desktop Agent proxy implementing intents, channels, heartbeat, and messaging over DACP/WCP. | `src/agent/DesktopAgentProxy.ts`, `src/messaging` |
| `toolbox/fdc3-for-web/fdc3-web-impl` | Reference browser desktop agent implementation backing the demo experiences. | `src/server/FDC3Server.ts`, `src/server/handlers` |

### Developer Tooling

| Workspace | Purpose | How to Run |
| --- | --- | --- |
| `toolbox/fdc3-for-web/reference-ui` | Shared UI assets: channel selector, intent resolver, theming. | `npm run dev` (serves UI on port 4000) |
| `toolbox/fdc3-for-web/demo` | Demo desktop agent UI and sample apps. | `npm run dev` (part of root `npm run dev`) |
| `toolbox/fdc3-workbench` | Manual testing UI to raise intents, broadcast context, and inspect metadata. | `npm run dev` (runs on port 3000) |
| `toolbox/fdc3-conformance` | Conformance test suite with cucumber/vitest scenarios. | `npm run dev` (serves UI and harness) |
| `packages/testing` | Shared testing utilities (intent resolver mock, channel helpers) used by automated suites. | `src/intentResolver`, `src/channels` |

---

## 4. Guided Code Walkthrough

Follow this sequence to understand how messages flow from an application calling `getAgent()` to a Desktop Agent implementation.

1. **Start with the API contracts** (`packages/fdc3-standard`)
   - Read `src/api/DesktopAgent.ts` to understand the methods an agent must implement.
   - Inspect `src/api/errors.ts` and `src/api/channels` to learn when errors are raised and how channels behave.

2. **Study the discovery helper** (`packages/fdc3-get-agent`)
   - `src/strategies/getAgent.ts` orchestrates discovery. Pay attention to how it persists agent metadata, enforces singletons, and delegates to strategies.
   - `src/strategies/DesktopAgentPreloadLoader.ts` watches for container-injected `window.fdc3` implementations.
   - `src/strategies/PostMessageLoader.ts` performs the WCP handshake over `postMessage` and constructs a `DesktopAgentProxy`.
   - `src/strategies/FailoverHandler.ts` shows how a custom failover can be plugged in if discovery fails.
   - The `ui` folder contains optional iframe-based channel and intent selector components used when the desktop agent delegates UI back to the app.

3. **Trace message handling in the proxy** (`packages/fdc3-agent-proxy`)
   - `src/agent/DesktopAgentProxy.ts` wires together app support, channel support, intent support, and messaging.
   - The `src/messaging` directory defines transports and serialization (e.g., `AbstractMessaging`, `MessagePortMessaging`).
   - Look at `src/support` for specific feature modules (intents, channels, apps, heartbeat).

4. **Inspect the reference implementation** (`toolbox/fdc3-for-web/fdc3-web-impl`)
   - `src/server/FDC3Server.ts` exposes the Desktop Agent API over postMessage and manages connected clients.
   - Handler classes in `src/server/handlers` respond to broadcast, intent, and channel requests.
   - `src/server/context` demonstrates how identity, logging, and app directory data are injected.

5. **Examine context and schema definitions**
   - Browse `packages/fdc3-context/schemas/context` for the JSON schema of each standard context type.
   - Generated TypeScript definitions live under `packages/fdc3-context/src/generated` and map schema to strongly typed data structures.
   - `packages/fdc3-schema/src/browser` and `src/bridge` define the wire-level messages used by WCP/DACP.

6. **Review testing utilities and suites**
   - `packages/testing/src/intentResolver/SimpleIntentResolver.ts` implements the resolver used by tests.
   - Conformance scenarios in `toolbox/fdc3-conformance/src/features` show behavior-driven expectations for agents.
   - Vitest setups in `packages/fdc3-get-agent/test` validate the discovery logic.

---

## 5. Hands-On Exercises

1. **Run the integrated demo stack**
   - Command: `npm run dev`
   - Open the following URLs:
     - Demo Desktop Agent: `http://localhost:4000/static/da/index.html`
     - Reference UI assets: `http://localhost:4000`
     - Workbench: `http://localhost:3000`
     - Conformance UI: `http://localhost:3300`
   - Experiment by loading the demo agent, opening sample apps, and observing how intents and context flows appear in the Workbench.

2. **Call `getAgent()` in the browser console**
   - In any demo app window, run `const fdc3 = await window.fdc3.getAgent();` (or import `@finos/fdc3-get-agent` in a project).
   - Inspect `fdc3.getInfo()` to verify metadata about the connected agent.
   - Use `fdc3.broadcast({ type: 'fdc3.instrument', id: { ticker: 'AAPL' } });` and watch other apps respond.

3. **Simulate failover**
   - Stop the demo agent service and call `getAgent({ failover: async () => window.open('/static/da/index.html') })` to see how the failover handler reconnects.
   - Review session storage (`sessionStorage.getItem('DesktopAgentDetails')`) to observe persisted agent details.

4. **Extend an intent handler in the proxy**
   - Edit `packages/fdc3-agent-proxy/src/support/intents/IntentSupport.ts` to log incoming intents.
   - Run `npm run test --workspace @finos/fdc3-agent-proxy` to ensure the proxy still behaves as expected.

5. **Add a custom context type**
   - Create a new schema under `packages/fdc3-context/schemas/context/custom`.
   - Run `npm run build --workspace @finos/fdc3-context` to regenerate TypeScript definitions.
   - Consume the new type in a sample app to broadcast or receive custom data.

6. **Execute the conformance suite**
   - Launch `npm run dev` and navigate to `http://localhost:3300`.
   - Select your agent implementation and run the provided cucumber scenarios.
   - Review the output logs to understand required behaviors for certification.

---

## 6. Recommended Study Path

1. **Read** `packages/fdc3-standard` in full to internalize API signatures.
2. **Clone** the discovery process by stepping through `packages/fdc3-get-agent/src/strategies/getAgent.ts` with a debugger while running the demo agent.
3. **Trace** a `raiseIntent` call from the proxy (`packages/fdc3-agent-proxy`) into the server handlers (`toolbox/fdc3-for-web/fdc3-web-impl`).
4. **Investigate** how UI delegation works by following the messages exchanged in `packages/fdc3-get-agent/src/ui/DefaultDesktopAgentIntentResolver.ts` and the matching code in `toolbox/fdc3-for-web/reference-ui`.
5. **Experiment** with the Workbench to manually broadcast contexts and raise intents, validating the real-world implications of the API calls.
6. **Review** the conformance specs to understand official requirements and edge cases.

Completing these steps will give you a holistic understanding of the standard, the helper libraries, the reference implementation, and the available tooling so you can confidently extend or integrate FDC3.

---

## 7. Useful Commands Cheat Sheet

```bash
# Install everything
npm install

# Build all workspaces
npm run build

# Run all tests
npm run test

# Start the demo agent, reference UI, workbench, and conformance suite
npm run dev

# Build only the get-agent package
npm run build --workspace @finos/fdc3-get-agent

# Run vitest for the get-agent package
npm run test --workspace @finos/fdc3-get-agent

# Run lint across the repo
npm run lint
```

---

## 8. Next Steps

- Join the [FINOS FDC3 Slack channel](https://finos-lf.slack.com/messages/fdc3/) to ask questions and follow working group updates.
- Watch the [FDC3 conformance project](https://github.com/finos/FDC3-conformance-framework) for upstream changes.
- Contribute back by proposing enhancements, implementing new context types, or improving the documentation using the guidelines in `CONTRIBUTING.md`.

Happy building!
