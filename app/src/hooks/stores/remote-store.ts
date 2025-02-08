import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useEmbedApiSdk} from "@/hooks/sdk-hook.tsx";
import {useParams} from "react-router";

export abstract class RemoteStore<T> {
  static sdk = useEmbedApiSdk();
  private query: ReturnType<typeof useQuery>;
  protected botId: string;
  protected chatId: string;

  protected constructor(
      queryKey: string,
      protected client = useQueryClient(),
      protected sdk = RemoteStore.sdk,
  ) {
    this.query = useQuery<T>({
      queryKey: [queryKey as string],
      queryFn: this.queryFn,
    });

    const {botId, chatId} = useParams();
    this.botId = botId || "";
    this.chatId = chatId || "";
  }

  abstract queryFn(): Promise<any>;

  get data(): T | undefined {
    return this.query.data as T | undefined;
  }

}


export function useRemoteStore<Z, T extends RemoteStore<Z>>(store: new () => T): T {
  return new store();
}