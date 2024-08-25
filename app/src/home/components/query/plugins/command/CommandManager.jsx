import {Command} from "./commands/Command.js";
import PingCommand from "./commands/PingCommand.js";
import ClearChatCommand from "./commands/ClearChatCommand.js";
import HelpCommand from "./commands/CommandListCommand.js";
import RestartChatCommand from "./commands/RestartChatCommand.js";
import AboutCommand from "./commands/AboutCommand.js";
import {getTheme} from "../../../chat/ChatHeader.jsx";
import ExportCommand from "./commands/ExportCommand.js";
import ContactCommand from "./commands/ContactCommand.js";

export const COMMAND_PREFIX = "/";

export class _CommandManager {

  #commands = {};

  closestCommand(partial) {
    partial = this.possibleCommand(partial).trim();
    if (!partial) return null;

    for (let command of Object.keys(this.#commands)) {
      if (command.startsWith(partial)) {
        return this.getCommand(command);
      }
    }
    return null;
  }

  /**
   *
   * @return Command | null
   */
  getCommand(text) {
    return this.#commands[this.possibleCommand(text)];
  }

  possibleCommand(text) {
    if (text.startsWith(COMMAND_PREFIX)) {
      return text.split(" ")[0].trim().substring(COMMAND_PREFIX.length || 0);
    }
    return text.split(" ")[0].trim();
  }

  getCommands() {
    return Object.values(this.#commands);
  }

  /**
   * @param includeArgs
   * @param text
   * @param {Command} command
   * @return {string}
   */
  getAutocompleteRemainder(command, text, includeArgs = false) {

    let remainderOfCommand = command.constructor.getId().slice(text.length - 1);

    if (includeArgs && command.argsText()) {
      remainderOfCommand += " " + command.argsText();
    }

    return remainderOfCommand;
  }

  /**
   *
   * @param {typeof Command} commands
   */
  registerCommands(...commands) {

    for (const command of commands) {
      this.#commands[command.getId()] = new command();
    }
  }

  render(text) {

    let retrievedCommand = this.getCommand(text);

    if (retrievedCommand == null) {

      const closestCommand = text.length > COMMAND_PREFIX.length ? this.closestCommand(text) : undefined;

      const containerElement = document.createElement("span");
      containerElement.classList.add("commandNode");

      const commandElement = document.createElement("span");
      commandElement.classList.add("commandUnknown");
      commandElement.textContent = text;

      if (closestCommand) {
        commandElement.setAttribute(
          "suggestion",
          this.getAutocompleteRemainder(closestCommand, text, true)
        )
      }

      containerElement.appendChild(commandElement);
      return containerElement;
    }

    return retrievedCommand.render(text, getTheme());

  }

}

export const CommandManager = new _CommandManager();

const loadCommands = function () {

  CommandManager.registerCommands(
    HelpCommand,
    AboutCommand,
    ContactCommand,
    ClearChatCommand,
    RestartChatCommand,
    ExportCommand,
    PingCommand,
  );

  if (window.Cria.botContact) {
    CommandManager.registerCommands(
      ContactCommand
    )
  }

}

window.loadedCriaCommands = false;


document.addEventListener("criaConfigLoaded", () => {
  loadCommands();
});