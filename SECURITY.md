# Security

If you find a vulnerability in dsh-jev, open a GitHub security advisory on [noetion/dsh-jev](https://github.com/noetion/dsh-jev) when that form is available. Otherwise email the address on the GitHub profile of `noetion`. Do not file a public issue for an unreleased vulnerability.

This plugin sends `jev_ask` `state` to `https://api.typesafe.ai/v1/systemone`. Treat that payload as leaving your machine. Keep API keys in `TYPESAFE_API_KEY` or DSH credentials, never in `state` or in `cordis.yml`.
