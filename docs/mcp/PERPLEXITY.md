# Connect GBrain to Perplexity Computer

Perplexity Computer supports remote MCP servers with bearer token authentication.

## Fastest path: `gbrain connect`

Run anywhere `gbrain` is installed to get the exact connector values to paste:

```bash
gbrain auth create "perplexity"
gbrain connect https://YOUR-DOMAIN.ngrok.app/mcp --token gbrain_xxx --agent perplexity
```

Perplexity is a GUI connector, so there's no `--install` — `gbrain connect` prints
the URL + token to paste into Settings → Connectors (the manual steps below).

## Setup

1. Open Perplexity (requires Pro subscription)
2. Go to **Settings > Connectors** (or **MCP Servers**)
3. Add a new remote connector:
   - **URL:** `https://YOUR-DOMAIN.ngrok.app/mcp`
   - **Authentication:** API Key / Bearer Token
   - **Token:** your GBrain access token
     (create one with `gbrain auth create "perplexity"`)
4. Save

Replace `YOUR-DOMAIN` with your ngrok domain (see
[ngrok-tunnel recipe](../../recipes/ngrok-tunnel.md) for setup).

## Verify

In a Perplexity conversation, ask it to use your brain:

```
Use my GBrain to search for [topic]
```

## Notes

- Perplexity Computer is available to Pro subscribers
- Both the Perplexity Mac app and web version support MCP connectors
- The Mac app also supports local MCP servers if you prefer `gbrain serve` (stdio)
