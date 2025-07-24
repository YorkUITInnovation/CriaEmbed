import {Command} from "./Command.js";

export default class ContactCommand extends Command {

  static getId() {
    return "contact";
  }

  getDescription() {
    return "Contact Information"
  }

  async execute(text, ref = undefined) {

    return `For assistance pertaining to this bot, please contact ${window.Cria.botContact}.`

  }
}
