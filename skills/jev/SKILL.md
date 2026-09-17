---
name: jev
description: Ask TypeSafe Jev for typed noul, choice, and score judgments that code and the agent can branch on. Use when a DSH agent needs programmable common sense instead of generated prose.
when-to-use: The current step is a judgment over evidence you already have, and the rest of the turn should branch on a typed answer, probability, or confidence. Skip it when the user needs generated text, a patch, or a shell command.
---

# Ask Jev

Jev is TypeSafe's System One model. It does not write code or chat. You send `state` plus typed `questions`. You get structured answers.

Call the `jev_ask` tool. Several questions in one call share one state and run in parallel. Prefer one call over a sequence of calls when the questions do not depend on each other.

## When to use it

Use Jev when you would otherwise prompt an LLM to "decide" and then parse its prose.

Examples:

- Is this change in scope for the current task?
- Which of these files is the intended target?
- How severe is this failure on a rubric you define?

Do not use Jev to generate a patch, a commit message, or a user-facing explanation. Keep those with the session LLM.

## Question types

Pick the type by what the answer means.

| Type | Use | Returns |
| --- | --- | --- |
| `noul` | Does this condition hold? | `noul` in 0..1, the probability of yes |
| `choice` | One option from a set you name | `choice`, `probabilities`, `confidence` |
| `score` | Degree on ordered levels you write | `score`, `legend`, `probabilities`, `confidence` |

Write the full meaning in `instructions`. Question ids are for you, not for Jev.

For `choice`, include a no-match option when nothing may fit. For `score`, every level must stand on its own as a situation, not a number.

## How to call

```json
{
  "state": {
    "task": "Fix the login timeout",
    "diff": "..."
  },
  "questions": {
    "in_scope": {
      "type": "noul",
      "instructions": "Does this diff address the login timeout named in `task`?",
      "criteria": {
        "true": "The diff changes timeout handling or the login path.",
        "false": "The diff is unrelated or only incidental."
      }
    },
    "risk": {
      "type": "score",
      "instructions": "How risky is shipping this diff as-is?",
      "criteria": [
        "Safe to ship with ordinary review",
        "Needs a closer look at one area",
        "Should not ship without a specific fix"
      ]
    }
  }
}
```

## How to read answers

- A noul near 0.5 is undecided, not medium intensity. Do not treat it as a weak yes.
- Choice `confidence` is how peaked the distribution is, not permission to act. If several options are acceptable, low confidence can still be a harmless preference.
- Combine answers in your own logic. Do not ask Jev to weigh independent factors in one question.

If `jev_ask` fails because the API key is missing, tell the user to set `TYPESAFE_API_KEY` in the process environment or DSH credentials. Do not invent answers.

Do not put API keys or other secrets in `state`. Every call posts the full state to `https://api.typesafe.ai/v1/systemone`.
