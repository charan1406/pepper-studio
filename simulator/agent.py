"""Tool-routed turn handler: one place that decides what the brain does.

Offers the LLM the available tools (robot actions + optional web search), lets
it pick, and dispatches:
  - a robot action  -> execute on the bridge, speak a short confirmation
  - web_search       -> query SearXNG, synthesize a spoken answer from snippets
  - no tool          -> answer directly (fast path for casual chat)

Returns (spoken_text, kind) where kind is "action:<name>", "search", or "chat".
"""
import actions
import games
import music
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
    tools.append(games.RPS_TOOL)
    if music.HAS_YTDLP:
        tools += music.MUSIC_TOOLS
    if searxng_url:
        tools.append(search.WEB_SEARCH_TOOL)

    messages = [{"role": "system", "content": system}]
    if history:
        messages += history
    messages.append({"role": "user", "content": question})

    routed = brain.chat_tools(messages, tools)
    if routed.tool_calls:
        print("[tools] " + ", ".join("%s(%s)" % (c["name"], c["args"])
                                     for c in routed.tool_calls))

    if routed.success and routed.tool_calls:
        # Run EVERY action the model asked for, in order — it often decomposes
        # "turn and wave" into two calls. A search/music/game call is a full
        # conversational interaction, so honor the FIRST such "terminal" tool and
        # let it own the spoken reply; robot actions are physical side effects.
        confirmations = []
        action_names = []
        terminal = None
        for call in routed.tool_calls:
            name, args = call["name"], call["args"]
            if name in actions.ACTION_NAMES:
                confirm = actions.execute(client, name, args)
                if confirm:
                    confirmations.append(confirm)
                action_names.append(name)
            elif terminal is None:
                terminal = (name, args)

        if terminal is not None:
            name, args = terminal
            if name == "web_search" and searxng_url:
                text = _synthesize_search(brain, system, question, history,
                                          searxng_url, args.get("query") or question)
                return text, "search"
            if name in music.MUSIC_NAMES:
                if name == "play_song":
                    return music.play_song(client, args.get("query") or question), "music"
                return music.stop_audio(client), "music"
            if name in games.RPS_NAMES:
                return games.play_rps(client), "game"

        if action_names:
            # prefer the model's own phrasing if it spoke alongside the calls
            reply = routed.content or " ".join(confirmations) or "Done."
            return reply, "action:" + "+".join(action_names)

    # no tool call — direct answer
    if routed.success and routed.content:
        return routed.content, "chat"
    res = brain.chat(question, system=system, history=history)
    return (res.content if res.success and res.content
            else "Sorry, my brain is not responding right now."), "chat"
