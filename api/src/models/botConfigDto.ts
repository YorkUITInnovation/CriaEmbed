import type { IBotEmbed } from "../database/mysql/controllers/BotEmbed.js";

export const REDACTED_SECRET = "[REDACTED]";

export function toManageBotConfigDto(bot: IBotEmbed): IBotEmbed {
  return {
    ...bot,
    developerMode: bot.developerMode ? REDACTED_SECRET : null,
    microsoftAppPassword: bot.microsoftAppPassword ? REDACTED_SECRET : null
  };
}
