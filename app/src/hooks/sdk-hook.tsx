import {createContext, ReactNode, useContext, useMemo} from "react";
import {ChatsApi, Configuration, EmbedApi, ManageApi, SessionsApi} from "@/sdk";


export class EmbedApiSdk {

  constructor(
      public readonly configuration: Configuration,
      public readonly manage: ManageApi = new ManageApi(configuration),
      public readonly embed: EmbedApi = new EmbedApi(configuration),
      public readonly chats: ChatsApi = new ChatsApi(configuration),
      public readonly sessions: SessionsApi = new SessionsApi(configuration),
  ) {
  }

}

// Create a context
const EmbedApiSdkContext = createContext<EmbedApiSdk | null>(null);

// Custom hook to use the SDK
export const useEmbedApiSdk = () => {
  const context = useContext(EmbedApiSdkContext);
  if (!context) {
    throw new Error('useGTakeOverSDK must be used within a GTakeOverSDKProvider');
  }
  return context;
};


export const EmbedApiSdkProvider = ({children, sdkConfig}: {
  children: ReactNode,
  sdkConfig: Partial<Configuration>
}) => {
  const sdk = useMemo(() => {
    const configuration = new Configuration(sdkConfig);
    return new EmbedApiSdk(configuration);
  }, [sdkConfig]);

  return (
      <EmbedApiSdkContext.Provider value={sdk}>
        {children}
      </EmbedApiSdkContext.Provider>
  );
};
