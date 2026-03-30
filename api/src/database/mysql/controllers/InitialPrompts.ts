import {ResultSetHeader, RowDataPacket} from "mysql2"
import {MySQLController} from "../../../models/MySQLController.js";
import {CriabotChatResponseRelatedPrompt} from "../../../services/EmbedService.js";

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
  initialPrompts?: CriabotChatResponseRelatedPrompt[]
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

  constructor(pool: import('mysql2').Pool) {
    super(pool);
  }

  retrievedById(botId: number): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<IBotEmbedPacket[]>(
          "SELECT * FROM `EmbedBot` WHERE `id`=?",
          [botId],
          (err: Error | null, res?: IBotEmbedPacket[]) => {
            if (err) reject(err)
            else resolve(res?.[0])
          }
      )
    })
  }

  retrieveByName(botName: string): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<IBotEmbedPacket[]>(
          "SELECT * FROM `EmbedBot` WHERE `botName`=?",
          [botName],
          (err: Error | null, res?: IBotEmbedPacket[]) => {
            if (err) reject(err)
            else resolve(res?.[0])
          }
      )
    })
  }

  update(bot: IBotEmbedConfig): Promise<IBotEmbed | undefined> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
          `
              UPDATE EmbedBot
              SET botTitle=?,
                  botSubTitle=?,
                  botGreeting=?,
                  botIconUrl=?,
                  botEmbedTheme=?,
                  botWatermark=?,
                  botLocale=?
              WHERE botName = ?
          `,
          [bot.botTitle, bot.botSubTitle, bot.botGreeting, bot.botIconUrl, bot.botEmbedTheme, bot.botWatermark, bot.botLocale, bot.botName],
          (err: Error | null, _?: ResultSetHeader) => {
            if (err) reject(err)
            else
              this.retrieveByName(bot.botName)
                  .then(bot => resolve(bot!))
                  .catch(reject)
          }
      )
    })
  }

  removeById(botId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
          "DELETE FROM `EmbedBot` WHERE id=?",
          [botId],
          (err: Error | null, res?: ResultSetHeader) => {
            if (err) reject(err)
            else resolve(res!.affectedRows)
          }
      )
    })
  }

  removeByName(botName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
          "DELETE FROM `EmbedBot` WHERE botName=?",
          [botName],
          (err: Error | null, res?: ResultSetHeader) => {
            if (err) reject(err)
            else resolve(res!.affectedRows)
          }
      )
    })
  }

  existsByName(botName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader[]>(
          "SELECT 1 FROM `EmbedBot` WHERE botName=?",
          [botName],
          (err: Error | null, res?: ResultSetHeader[]) => {
            if (err) reject(err)
            else resolve((res?.length ?? 0) > 0)
          }
      )
    })
  }

}
