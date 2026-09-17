# dsh-jev

dsh-jev is a DeepSeek Harness bundle that registers the `jev_ask` tool. On a profile that loads this bundle, a DSH agent can send typed noul, choice, and score questions to TypeSafe Jev.

Jev is TypeSafe's System One model. It returns structured answers. It does not generate chat or code.

This package is version 0.1.0. It targets DSH `0.1.5-rc.2` (the npm `next` dist-tag), Node 22.19 through 22.x or Node 24 and later, and a TypeSafe API key.

## Install from GitHub

Pin a commit so a later push cannot change what you run.

```sh
dsh plugin --profile web add github:noetion/dsh-jev#<commit>
```

Replace `<commit>` with a SHA from `main`.

The first add fails until pnpm allows this package's `prepare` script. Copy the exact key from the pnpm error into the profile's `pnpm-workspace.yaml` under `allowBuilds`. The key is often `dsh-jev`. Some pnpm versions print a longer `dsh-jev@github:...` key. Use that exact string.

```yaml
allowBuilds:
  dsh-jev: true
```

Then run the same `dsh plugin add` command again. Treat that allowlist as permission to run this package's build on your machine at install time.

Set `TYPESAFE_API_KEY` in the process environment, or store that same name in DSH credentials. Restart `dsh web` if it is already running.

## Install from a local checkout

```sh
pnpm install
dsh plugin --profile web add /absolute/path/to/dsh-jev
```

`pnpm install` runs `prepare`, which writes `dist/`.

## Call jev_ask

Ask the agent to call `jev_ask`, or invoke the bundled `jev` skill. The session LLM chooses the tool from the tool description and the skill. There is no hard interceptor.

One call can mix question types over the same state.

```json
{
  "state": "Help! My payouts have been failing for 3 days.",
  "questions": {
    "is_urgent": {
      "type": "noul",
      "instructions": "Does this convey urgency?"
    },
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "Payments, invoicing, refunds",
        "technical": "Bugs, outages, integrations",
        "sales": "Pricing, upgrades, new accounts"
      }
    }
  }
}
```

The tool result is the TypeSafe JSON. Branch on `answers.<id>.noul`, `.choice`, `.score`, and `.confidence`.

Every call posts `state` to `https://api.typesafe.ai/v1/systemone`. Do not put secrets in `state`.

## Configure

Optional `cordis.yml` fields on the `jev` row:

- `model`, default `jev-latest`
- `endpoint`, default `https://api.typesafe.ai/v1/systemone`
- `apiKeyEnv`, default `TYPESAFE_API_KEY`

The plugin reads the key on every call. It does not put the secret in `cordis.yml`.

## Names

- GitHub repository: `noetion/dsh-jev`
- npm package name: `dsh-jev` (install from GitHub, not npm)
- Plugin id: `jev`
- Tool: `jev_ask`
- Bundled skill: `jev`

## Verify

From a checkout:

```sh
pnpm install
pnpm run check
```

`pnpm run check` runs `typecheck`, `test`, `build`, and `adopt-check` in that order. The tests use a mock HTTP transport, so they need no API key.

Live TypeSafe proof, with a key in `TYPESAFE_API_KEY` or in the file named by `TYPESAFE_KEY_FILE`:

```sh
pnpm run live
```

Install-and-load proof against a throwaway `DSH_HOME`:

```sh
pnpm run verify-boot
```

Proof that a git install builds `dist/` and that pnpm accepts the `allowBuilds` key:

```sh
pnpm run verify-git-install
```

`@deepseek-ai/dsh-tools` is pinned to `0.1.5-rc.2`. npm `latest` is a stale `0.0.1-rc.1`. Do not replace the pin with an untagged install.

## Why this is not an LLM adapter

An LLM adapter must stream text and tool-call chunks. Jev returns typed answers and cannot stream, so it cannot be one. The native DSH seam for Jev is a tool, plus a bundled skill when the profile has `ctx.skills`.

## License and support

MIT. See `LICENSE`.

Open a GitHub issue for bugs and questions. There is no response-time promise. Pull requests are welcome when they include `pnpm run check`.

Report a vulnerability in [SECURITY.md](SECURITY.md).
