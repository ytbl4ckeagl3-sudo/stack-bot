const fs = require("fs");
const path = require("path");

module.exports = {
  name: "help",
  description: "Befehlsliste",
  trigger: /^help$/i,
  execute: async (context) => {
    const files = fs
      .readdirSync(context.commandDir)
      .filter((file) => file.endsWith(".js"))
      .sort();

    const lines = ["Stack Befehle:"];
    for (const file of files) {
      const fullPath = path.join(context.commandDir, file);
      delete require.cache[require.resolve(fullPath)];
      const command = require(fullPath);
      lines.push(`- ${file}: ${command.trigger}`);
    }

    await context.reply(lines.join("\n"));
  }
};
