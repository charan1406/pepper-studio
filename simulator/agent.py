"""Tool-routed turn handler: one place that decides what the brain does.

Offers the LLM the available tools (robot actions + optional web search), lets
it pick, and dispatches:
  - a robot action  -> execute on the bridge, speak a short confirmation
  - web_search       -> query SearXNG, synthesize a spoken answer from snippets
  - no tool          -> answer directly (fast path for casual chat)

Returns (spoken_text, kind) where kind is "action:<name>", "search", or "chat".
"""
import actions
import search


def _synthesize_search(brain, system, question, history, searxng_url, query):
    print(f"[search] query: {query!r}")
    results = search.search(query, searxng_url, n=8)
    aug_system = (
        system
        + "\n\nWeb search results for the user's question:\n"
        + search.format_results(results)
        + "\n\nAnswer the user in one or two short spoken sentences using these "
          "results — pull out the specific fact they asked for (temperature, name, "
          "score, price, date, etc.) if it appears. Only say you couldn't find it "
          "if the results truly don't contain it."
    )
    final = brain.chat(question, system=aug_system, history=history)
    if final.success and final.content:
        return final.content
    return "Sorry, I found some results but couldn't summarize them."


def respond(brain, client, system, question, history, searxng_url=""):
    """Run one brain turn with tools. Returns (spoken_text, kind)."""
    tools = list(actions.ACTION_TOOLS)
    if searxng_url:
        tools.append(search.WEB_SEARCH_TOOL)

    messages = [{"role": "system", "content": system}]
    if history:
        messages += history
    messages.append({"role": "user", "content": question})

    routed = brain.chat_tools(messages, tools)

    if routed.success and routed.tool_calls:
        call = routed.tool_calls[0]
        name, args = call["name"], call["args"]

        if name == "web_search" and searxng_url:
            text = _synthesize_search(brain, system, question, history,
                                      searxng_url, args.get("query") or question)
            return text, "search"

        if name in actions.ACTION_NAMES:
            confirm = actions.execute(client, name, args)
            # prefer the model's own phrasing if it spoke alongside the tool call
            return (routed.content or confirm or "Done."), f"action:{name}"

    # no tool call — direct answer
    if routed.success and routed.content:
        return routed.content, "chat"
    res = brain.chat(question, system=system, history=history)
    return (res.content if res.success and res.content
            else "Sorry, my brain is not responding right now."), "chat"
