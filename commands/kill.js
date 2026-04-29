module.exports = {
  name: "kill",
  description: "Killswitch",
  trigger: /^kill(?:\s+(on|off|status))?$/i,
  execute: async (context) => {
    if (!context.isMain) return context.reply("Nur MAIN_NUMBER darf das.");

    const mode = (context.body.match(/^kill(?:\s+(on|off|status))?$/i)?.[1] || "status").toLowerCase();

    if (mode === "on") {
      context.helpers.setKilled(true);
      return context.reply("Killswitch an.");
    }

    if (mode === "off") {
      context.helpers.setKilled(false);
      return context.reply("Killswitch aus.");
    }

    await context.reply(context.helpers.isKilled() ? "Killswitch ist an." : "Killswitch ist aus.");
  }
};
