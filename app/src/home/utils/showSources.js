/**
 * Read the bot-owner "show sources" flag from the embed config.
 * Defaults to ON when the API omits the flag (older responses).
 *
 * @param {object} [config] Embed config object (window.Cria).
 * @returns {boolean} True when sources should be shown.
 */
export function readShowSources(config) {
  return config?.showSources !== false;
}

/**
 * Read the bot-owner auto-scroll-to-response-top flag from the embed config.
 * Defaults to ON when the API omits the flag (older responses).
 *
 * @param {object} [config] Embed config object (window.Cria).
 * @returns {boolean} True when finished replies should anchor to their top.
 */
export function readAutoScrollTop(config) {
  return config?.autoScrollTop !== false;
}

/**
 * Single gate for rendering SourceCitations.
 *
 * @param {boolean} showSources Config flag (undefined defaults to on).
 * @param {Array} citations Citation list for the response.
 * @returns {boolean} True when the citations block should render.
 */
export function shouldRenderSources(showSources, citations) {
  return (
    showSources !== false && Array.isArray(citations) && citations.length > 0
  );
}

/**
 * Decide whether finishing a stream should auto-anchor to the response top.
 * Pure decision; DOM measurement (short-response/visibility checks) stays in
 * ChatList. Keyed on the dedicated auto-scroll setting, independent of the
 * sources flag.
 *
 * @param {{autoScrollTop?: boolean, streamingFinished?: boolean,
 *   addedBotReply?: boolean, userScrolledAway?: boolean}} input
 * @returns {boolean} True when ChatList should jump to the response top.
 */
export function shouldAutoAnchorToResponseTop({
  autoScrollTop,
  streamingFinished,
  addedBotReply,
  userScrolledAway,
} = {}) {
  return Boolean(
    autoScrollTop !== false &&
      streamingFinished &&
      addedBotReply &&
      !userScrolledAway
  );
}
