function parseHomework(input) {
  const raw = input.replace(/^HA:\s*/i, "").trim();
  const firstPart = raw.split(/,\s*(heute|in stunde|in der stunde|gemacht|notiz)/i)[0].trim();
  const colon = firstPart.match(/^([^:;-]{2,40})[:;-]\s*(.+)$/);
  if (colon) return { fach: colon[1].trim(), aufgabe: colon[2].trim(), raw };

  const words = firstPart.split(/\s+/);
  const fach = words.shift() || "";
  const aufgabe = words.join(" ").trim();
  return { fach, aufgabe, raw };
}

module.exports = {
  name: "hausaufgabe",
  description: "Hausaufgaben-Planer",
  trigger: /^HA:/i,
  execute: async (context) => {
    const parsed = parseHomework(context.body);
    if (!parsed.fach || !parsed.aufgabe) {
      return context.reply("Format: Stack, HA: Mathe S.45 Nr.3");
    }

    let lesson = null;
    try {
      lesson = await context.helpers.getNextLessonForSubject(parsed.fach);
    } catch (_) {
      return context.reply("WebUntis hakt gerade. HA ist nicht gespeichert.");
    }

    if (!lesson) {
      return context.reply(`Keinen naechsten Termin fuer ${parsed.fach} gefunden.`);
    }

    if (context.supabase) {
      const { error } = await context.supabase.from("homework").insert({
        number: context.senderNumber,
        fach: parsed.fach,
        aufgabe: parsed.aufgabe,
        due: lesson.start.toISOString(),
        done: false
      });
      if (error) console.error("homework insert fail:", error.message);
    }

    const hoursLeft = (lesson.start.getTime() - Date.now()) / (60 * 60 * 1000);
    const due = context.helpers.formatDueDE(lesson.start);
    const day = context.helpers.relativeDayDE(lesson.start);

    if (hoursLeft > 48) {
      return context.reply(`Mach spaeter King, hast bis ${due}.`);
    }

    if (hoursLeft < 24) {
      return context.reply(`Heute machen, ${day} ${lesson.periodNumber}. Stunde ${parsed.fach}.`);
    }

    return context.reply(`Bald machen King, bis ${due}.`);
  }
};
