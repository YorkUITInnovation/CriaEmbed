import "./assets/index.css";

import Chat from "./pages/chat.js";
import {createRoot} from "react-dom/client";
import {BrowserRouter, Route, Routes} from "react-router";
import CatchAll from "@/pages/catch-all.tsx";
import {EmbedApiSdkProvider} from "@/hooks/sdk-hook.tsx";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
      <Routes>
        <Route path={"*"} element={<CatchAll/>}/>
        <Route path={"/bots/:botId/chats/:chatId"} element={
          <EmbedApiSdkProvider sdkConfig={{basePath: import.meta.env.VITE_API_BASE_URL}}>
            <QueryClientProvider client={queryClient}>
              <Chat/>
            </QueryClientProvider>
          </EmbedApiSdkProvider>
        }/>
      </Routes>
    </BrowserRouter>
);

//