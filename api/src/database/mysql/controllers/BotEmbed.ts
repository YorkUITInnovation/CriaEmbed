import {ResultSetHeader, RowDataPacket} from "mysql2"
import {MySQLController} from "../../../models/MySQLController";
import {CriabotChatResponseRelatedPrompt} from "../../../services/EmbedService";
import {debugEnabled} from "../../../config";

export enum EmbedPosition {
  BL = 1,
  BR = 2,
  TR = 3,
  TL = 4
}

export type BotLocale = "en-US" | "fr-FR";


export interface IBotBaseEmbedConfig {
  botTitle?: string | null,
  botSubTitle?: string | null,
  botGreeting?: string | null,
  botIconUrl?: string | null,
  botEmbedTheme?: string | null,
  botEmbedDefaultEnabled?: boolean | null,
  botEmbedPosition?: EmbedPosition | null
  botWatermark?: boolean | null,
  botLocale?: BotLocale | null,
  botTrustWarning?: string | null,
  initialPrompts?: CriabotChatResponseRelatedPrompt[] | null,
  microsoftAppId?: string | null,
  microsoftAppPassword?: string | null,
  integrationsNoContextReply?: boolean | null,
  integrationsFirstEmailOnly?: boolean | null,
  embedHoverTooltip?: string | null
  botContact?: string | null
}

export interface IBotEmbedConfig extends IBotBaseEmbedConfig {
  botName: string,
}

export interface IBotEmbed extends IBotEmbedConfig {
  id?: number,
  createdAt?: Date
}

export interface IBotEmbedPacket extends IBotEmbed, RowDataPacket {

}

export class BotEmbed extends MySQLController {

  private postProcessRes(res: Record<string, any>): IBotEmbed | undefined {

    if (res === undefined) {
      return undefined;
    }

    if (res?.initialPrompts) {
      res['initialPrompts'] = JSON.parse(res['initialPrompts']);
    }

    res['integrationsNoContextReply'] = res['integrationsNoContextReply'] !== null ? Boolean(res['integrationsNoContextReply']) : null;
    res['integrationsFirstEmailOnly'] = res['integrationsFirstEmailOnly'] !== null ? Boolean(res['integrationsFirstEmailOnly']) : null;
    res['botEmbedDefaultEnabled'] = res['botEmbedDefaultEnabled'] !== null ? Boolean(res['botEmbedDefaultEnabled']) : null;
    res['botWatermark'] = res['botWatermark'] !== null ? Boolean(res['botWatermark']) : null;

    return res as IBotEmbed;

  }

  retrievedById(botId: number): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<IBotEmbedPacket[]>(
          "SELECT * FROM `EmbedBot` WHERE `id`=?",
          [botId],
          (err, res) => {
            if (err) reject(err)
            else resolve(this.postProcessRes(res?.[0]))
          }
      )
    })
  }

  retrieveByName(botName: string): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<IBotEmbedPacket[]>(
          "SELECT * FROM `EmbedBot` WHERE `botName`=?",
          [botName],
          (err, res) => {
            if (err) reject(err)
            else resolve(this.postProcessRes(res?.[0]))
          }
      )
    })
  }

  retrieveByAppId(appId: string): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<IBotEmbedPacket[]>(
          "SELECT * FROM `EmbedBot` WHERE `microsoftAppId`=?",
          [appId],
          (err, res) => {
            if (err) reject(err)
            else resolve(this.postProcessRes(res?.[0]))
          }
      )
    })
  }

  insert(bot: IBotEmbedConfig): Promise<IBotEmbed> {
    return new Promise((resolve, reject) => {

      this.pool.query<ResultSetHeader>(
          `
              INSERT INTO \`EmbedBot\` (botName, botTitle, botSubTitle, botGreeting, botIconUrl, botEmbedTheme,
                                        botWatermark, botLocale, initialPrompts, microsoftAppId, microsoftAppPassword,
                                        integrationsNoContextReply, integrationsFirstEmailOnly, botEmbedDefaultEnabled,
                                        botTrustWarning, embedHoverTooltip, botContact)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            bot.botName,
            bot.botTitle,
            bot.botSubTitle,
            bot.botGreeting,
            bot.botIconUrl,
            bot.botEmbedTheme,
            Number(bot.botWatermark),
            bot.botLocale,
            JSON.stringify(bot.initialPrompts),
            bot.microsoftAppId,
            bot.microsoftAppPassword,
            Number(bot.integrationsNoContextReply),
            Number(bot.integrationsFirstEmailOnly),
            Number(bot.botEmbedDefaultEnabled),
            bot.botTrustWarning,
            bot.embedHoverTooltip,
            bot.botContact
          ],
          async (err, res: ResultSetHeader) => {
            if (err || !res) {
              reject(err)
            } else {
              this.retrievedById(res.insertId)
                  .then(bot => resolve(bot!))
                  .catch(reject);
            }

          }
      )
    });

  }

  update(bot: IBotEmbedConfig): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {

      if (debugEnabled()) {
        console.log("Updating bot: ", bot);
      }

      this.pool.query<ResultSetHeader>(
          `
              UPDATE EmbedBot
              SET botTitle=?,
                  botSubTitle=?,
                  botGreeting=?,
                  botIconUrl=?,
                  botEmbedTheme=?,
                  botWatermark=?,
                  botLocale=?,
                  initialPrompts=?,
                  botEmbedPosition=?,
                  microsoftAppId=?,
                  microsoftAppPassword=?,
                  integrationsNoContextReply=?,
                  integrationsFirstEmailOnly=?,
                  botEmbedDefaultEnabled=?,
                  botTrustWarning=?,
                  embedHoverTooltip=?,
                  botContact=?
              WHERE botName = ?
          `,
          [
            // Update
            bot.botTitle,
            bot.botSubTitle,
            bot.botGreeting,
            bot.botIconUrl,
            bot.botEmbedTheme,
            Number(bot.botWatermark),
            bot.botLocale,
            JSON.stringify(bot.initialPrompts),
            bot.botEmbedPosition,
            bot.microsoftAppId,
            bot.microsoftAppPassword,
            Number(bot.integrationsNoContextReply),
            Number(bot.integrationsFirstEmailOnly),
            Number(bot.botEmbedDefaultEnabled),
            bot.botTrustWarning,
            bot.embedHoverTooltip,
            bot.botContact,

            // Identifier
            bot.botName
          ],
          (err, _) => {
            if (err) reject(err)
            else
              this.retrieveByName(bot.botName)
                  .then(bot => resolve(bot!))
                  .catch(reject)
          }
      )
    })
  }

  removeByName(botName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
          "DELETE FROM `EmbedBot` WHERE botName=?",
          [botName],
          (err, res: ResultSetHeader) => {
            if (err) reject(err)
            else resolve(res.affectedRows)
          }
      )
    })
  }

  existsByName(botName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader[]>(
          "SELECT 1 FROM `EmbedBot` WHERE botName=?",
          [botName],
          (err, res: ResultSetHeader[]) => {
            if (err) reject(err)
            else resolve(res.length > 0)
          }
      )
    })
  }

}
