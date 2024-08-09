import {ResultSetHeader, RowDataPacket} from "mysql2"
import {MySQLController} from "../../../models/MySQLController";
import {CriabotChatResponseRelatedPrompt} from "../../../services/EmbedService";

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
  initialPrompts?: CriabotChatResponseRelatedPrompt[] | null,
  microsoftAppId?: string,
  microsoftAppPassword?: string,
  integrationsNoContextReply?: boolean,
  integrationsFirstEmailOnly?: boolean
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

  private postProcessRes(res: Record<string, any>): IBotEmbed {
    if (res?.initialPrompts) {
      res['initialPrompts'] = JSON.parse(res['initialPrompts']);
    }
    return res as IBotEmbed;
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
                                        botWatermark, botLocale, initialPrompts, microsoftAppId, microsoftAppPassword, integrationsNoContextReply, integrationsFirstEmailOnly)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [bot.botName, bot.botTitle, bot.botSubTitle, bot.botGreeting, bot.botIconUrl, bot.botEmbedTheme, bot.botWatermark, bot.botLocale, JSON.stringify(bot.initialPrompts), bot.microsoftAppId, bot.microsoftAppPassword, bot.integrationsNoContextReply, bot.integrationsFirstEmailOnly],
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
      console.log('Got', bot)

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
                  integrationsFirstEmailOnly=?
              WHERE botName = ?
          `,
          [
            // Update
            bot.botTitle, bot.botSubTitle, bot.botGreeting, bot.botIconUrl, bot.botEmbedTheme, bot.botWatermark, bot.botLocale, JSON.stringify(bot.initialPrompts), bot.botEmbedPosition, bot.microsoftAppId, bot.microsoftAppPassword, bot.integrationsNoContextReply, bot.integrationsFirstEmailOnly,

            // Identifier
            bot.botName],
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
