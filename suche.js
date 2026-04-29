module.exports = {
  name: "ping",
  description: "Healthcheck",
  trigger: /^ping$/i,
  execute: async (context) => {
    await context.reply("pong");
  }
};
