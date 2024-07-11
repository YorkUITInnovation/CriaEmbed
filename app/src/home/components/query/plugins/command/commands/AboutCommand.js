import {Command} from "./Command.js";

export default class AboutCommand extends Command {

    static getId() {
        return "about";
    }

    getDescription() {
        return "All about Cria"
    }

    async execute(text, ref = undefined) {

        return `This bot, ${window.Cria.botName} (${window.Cria.botSubName || "N/A"}), is one of many Cria bots.<br><br/>`
            +  `Cria is a chat-bot system created by IT Innovation at York University.<br/><br/>`
            + `These bots use <a target="_blank" href="https://en.wikipedia.org/wiki/Generative_artificial_intelligence">generative AI</a>&nbsp;`
            + `in combination with <a target="_blank" href="https://www.elastic.co/what-is/semantic-search">semantic search</a>&nbsp;`
            + `of <a target="_blank" href="https://www.cloudflare.com/en-ca/learning/ai/what-is-vector-database/">vector databases</a> to create interactive, high-quality chat experiences.<br/><br/>`
            + `Cria first launched to the public on Wed, March 13th, 2024.`
    }
}
