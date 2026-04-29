const { tavily } = require("@tavily/core");

module.exports = {
  name: "suche",
  description: "Websuche",
  trigger: /^suche\s+(.+)/i,
  execute: async (context) => {
    const query = context.body.replace(/^suche\s+/i, "").trim();
    if (!query) return context.reply("Suchbegriff fehlt.");

    const quota = context.helpers.consumeWebSearch(context);
    if (!quota.ok) return context.reply("Websearch-Limit fuer heute leer.");

    if (!process.env.TAVILY_API_KEY) return context.reply("TAVILY_API_KEY fehlt.");

    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await tvly.search(query, {
      maxResults: 5,
      searchDepth: "basic",
      includeAnswer: true
    });

    const lines = [];
    if (result.answer) lines.push(result.answer.trim(), "");
    for (const item of result.results || []) {
      lines.push(`- ${item.title}\n${item.url}`);
    }
    lines.push("", `Websearch uebrig heute: ${quota.left}`);

    await context.reply(lines.join("\n").trim());
  }
};
