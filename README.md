# dsh-jev

A DeepSeek Harness plugin that gives any DSH agent a native Jev capability.

Jev is TypeSafe's System One model. It returns typed noul, choice, and score answers. It does not generate chat or code. This plugin registers `jev_ask` so the session LLM, Code mode, and other DSH agents can call Jev the same way they call `bash`.

## Install

Build once, then add the package to a profile.

```sh
pnpm install
pnpm run build
dsh plugin --profile web add /absolute/path/to/dsh-jev
```

From GitHub after you allow the `prepare` build:

```sh
dsh plugin --profile web add github:noetion/dsh-jev
```

Set `TYPESAFE_API_KEY` in the process environment, or store that same name in DSH credentials. The plugin reads the key on every call. It does not put the secret in `cordis.yml`.

## Use

Ask the agent to call `jev_ask`, or invoke the bundled `jev` skill. One call can mix question types over the same state.

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

The tool result is the TypeSafe JSON. Your agent branches on `answers.<id>.noul`, `.choice`, `.score`, and `.confidence`.

## Configure

Optional `cordis.yml` fields on the `jev` row:

- `model`, default `jev-latest`
- `endpoint`, default `https://api.typesafe.ai/v1/systemone`
- `apiKeyEnv`, default `TYPESAFE_API_KEY`

## Develop

```sh
pnpm install
pnpm run check
```

`pnpm run check` typechecks, runs the mock HTTP tests, and builds the bundle.

Live TypeSafe proof, with a key in the environment:

```sh
pnpm run live
```

Install-and-load proof against a throwaway `DSH_HOME`:

```sh
pnpm run verify-boot
```

`@deepseek-ai/dsh-tools` is pinned to `0.1.5-rc.2` (the `next` dist-tag). npm `latest` is a stale `0.0.1-rc.1`. Do not replace the pin with an untagged install.

## Why this is not an LLM adapter

An LLM adapter must stream text and tool-call chunks. Jev answers typed questions. Wiring it as a chat provider would be a lie. The native DSH seam for Jev is a tool plus, when the profile has `ctx.skills`, a bundled skill.
