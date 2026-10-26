import { createContext } from "react";

// Context (not props) so toggling re-renders citations inside chat elements
// that were built once and stored in ChatList state. Default: ON.
export const ShowSourcesContext = createContext(true);
