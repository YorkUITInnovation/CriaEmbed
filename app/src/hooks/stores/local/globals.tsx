import {create} from "zustand/react";

interface GlobalsStore {
  chatExpired: boolean,
  setChatExpired: (chatExpired: boolean) => void
}

export const useGlobalsStore = create<GlobalsStore>((set) => ({
  chatExpired: false,
  setChatExpired: (chatExpired: boolean) => set({chatExpired}),
}))