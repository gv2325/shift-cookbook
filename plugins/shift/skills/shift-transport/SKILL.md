---
name: shift-transport
description: Answers questions about urban transport in 20 Indian cities (bus fleets, public transport coverage and ridership, modal share, road speeds and congestion, road deaths and crashes) using the SHIFT Cookbook MCP connector, with a source on every number. Use when the user asks about transport, mobility, buses, metro, traffic, congestion or road safety in Indian cities such as Pune, Bengaluru, Delhi, Mumbai, Chennai or Kolkata, or mentions SHIFT.
---

# SHIFT transport data for Indian cities

SHIFT is an open cookbook of transport data for 20 Indian cities, served by a free, read-only MCP connector that needs no sign-in:

**`https://shift-cookbook-mcp.onrender.com/mcp`**

Cities: Ahmedabad, Bengaluru, Bhopal, Chennai, Coimbatore, Delhi, Hyderabad, Indore, Jaipur, Kanpur, Kochi, Kolkata, Kozhikode, Lucknow, Mumbai, Nagpur, Patna, Pune, Surat, Thrissur.

## Step 1: make sure the SHIFT tools are available

Look for the tools `list_cities`, `list_indicators`, `get_indicator`, `compare_cities`, `get_map_link`, `search` and `fetch` from the SHIFT connector. If they are there, go to step 2.

If they are not, connect it:

- **Claude Code:** run this in a terminal, then start a new session (check with `/mcp`):
  ```bash
  claude mcp add --transport http --scope user shift https://shift-cookbook-mcp.onrender.com/mcp
  ```
- **Claude.ai or Claude Desktop:** ask the user to add it once (it takes under a minute):
  1. **Customize → Connectors** (claude.ai/customize/connectors) → **Add custom connector**
  2. Name: `SHIFT`, URL: `https://shift-cookbook-mcp.onrender.com/mcp`
  3. Leave the OAuth fields empty and select **Add**, then turn SHIFT on in the chat's tools menu.
- **No connector but you can run code with internet access:** call the endpoint directly. Each call is a single JSON-RPC POST; no handshake is needed:
  ```bash
  curl -s https://shift-cookbook-mcp.onrender.com/mcp \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"compare_cities","arguments":{"cities":["Pune","Delhi"],"indicator":"buses_per_million"}}}'
  ```
  The answer is in `result.structuredContent`. Use `"method":"tools/list"` to see every tool and its inputs.

The server sleeps when idle. If the first call fails or returns 502/503, wait 30–60 seconds and try once more.

## Step 2: answer with the tools

| Tool | Use it to |
|---|---|
| `list_cities` | See the 20 cities and which indicators each has |
| `list_indicators` | Get indicator ids, definitions, units, sources and benchmarks |
| `get_indicator` | One value for one city (`city`, `indicator`) |
| `compare_cities` | Rank up to 10 cities, or `["all"]`, on one indicator |
| `get_map_link` | A link to the SHIFT map showing up to 4 cities |
| `search` / `fetch` | City profiles, indicator rankings and the WRI India story “Streets That Move Cities” |

Indicator ids: `buses_per_million`, `pt_coverage`, `daily_pt_trips`, `sustainable_mode_share`, `evening_peak_speed`, `road_deaths_per_million`, `road_crashes_per_million`.

## Rules for the answer

- **Cite the `sources`** returned with every result, by name.
- **Report the `caveats`.** They flag missing data, places where SHIFT's own tables disagree (both figures are given), old mobility plans, and licence notes on travel-time data.
- **`null` means SHIFT has no figure.** Say so plainly; never estimate or fill the gap from memory.
- **Offer the `map_link`** so the user can see the comparison on the SHIFT map.
- Use per-capita indicators when comparing cities of different sizes. The bus benchmark is 600 buses per million residents.
- Old city names work (Bangalore, Bombay, Calcutta, Madras, Cochin, Calicut).

More: https://shift-cookbook-web.onrender.com/connect
