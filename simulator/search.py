"""Optional web search for the AI brain via a self-hosted SearXNG instance.

The brain decides *when* to search (tool-calling): casual chat stays a single
fast call, real questions ("weather in Berlin", "who won the match") trigger a
lookup. We run the query against SearXNG's JSON API and feed the snippets back
for a spoken answer (route -> search -> synthesize).

Bring-your-own and optional: if no SearXNG URL is configured, the orchestrator
falls back to a plain answer, so nothing breaks when search is off.
"""
import json
import urllib.parse
import urllib.request

# OpenAI-style tool schema the model sees.
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for current, real-world information you cannot know "
            "on your own: today's weather, news, sports scores, prices, opening "
            "hours, recent events, or any fact that may have changed recently. "
            "Do NOT use it for greetings, opinions, or general chit-chat."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "a concise web search query",
                },
            },
            "required": ["query"],
        },
    },
}


def search(query, base_url, n=4, timeout=10):
    """Query the SearXNG JSON API. Returns up to n {title, content, url} dicts,
    or [] on any failure (unreachable, bad JSON) so the caller degrades cleanly."""
    if not base_url:
        return []
    url = base_url.rstrip("/") + "/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json"})
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[search] failed: {e}")
        return []
    out = []
    for r in data.get("results", [])[:n]:
        out.append({
            "title": r.get("title", ""),
            "content": (r.get("content") or "").strip(),
            "url": r.get("url", ""),
        })
    return out


def format_results(results):
    """Compact text block for prompt injection."""
    if not results:
        return "(no results found)"
    return "\n".join(
        f"{i}. {r['title']}\n   {r['content']}" for i, r in enumerate(results, 1))


def answer(brain, system, question, history, searxng_url):
    """Tool-routed answer. Returns (text, used_search: bool).

    1. Offer the brain the web_search tool. If it calls it, run the search and
       synthesize a spoken answer from the snippets.
    2. If it answers directly (no tool call), use that.
    3. If search is disabled/unavailable, fall back to a plain chat.
    """
    if searxng_url:
        messages = [{"role": "system", "content": system}]
        if history:
            messages += history
        messages.append({"role": "user", "content": question})

        routed = brain.chat_tools(messages, [WEB_SEARCH_TOOL])
        if routed.success and routed.tool_calls:
            query = routed.tool_calls[0]["args"].get("query") or question
            print(f"[search] query: {query!r}")
            results = search(query, searxng_url)
            aug_system = (
                system
                + "\n\nWeb search results for the user's question:\n"
                + format_results(results)
                + "\n\nAnswer the user in one or two short spoken sentences using "
                  "these results. If they don't contain the answer, say you "
                  "couldn't find it."
            )
            final = brain.chat(question, system=aug_system, history=history)
            if final.success and final.content:
                return final.content, True
            return "Sorry, I found some results but couldn't summarize them.", True
        if routed.success and routed.content:
            return routed.content, False

    res = brain.chat(question, system=system, history=history)
    return (res.content if res.success and res.content
            else "Sorry, my brain is not responding right now."), False
