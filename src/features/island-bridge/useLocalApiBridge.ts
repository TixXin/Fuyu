import { useEffect, useRef } from "react";
import { answerLocalApiRequest, listenLocalApiRequests } from "./api";
import { dispatchLocalApiRequest, type LocalApiHandlers } from "./dispatch";
import { devIslandHandlers } from "./devIsland";

export function useLocalApiBridge(handlers: LocalApiHandlers) {
  const handlersRef = useRef(import.meta.env.DEV ? { ...devIslandHandlers, ...handlers } : handlers);

  useEffect(() => {
    handlersRef.current = import.meta.env.DEV ? { ...devIslandHandlers, ...handlers } : handlers;
  }, [handlers]);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void listenLocalApiRequests((request) => {
      void dispatchLocalApiRequest(handlersRef.current, request.method, request.params)
        .then((response) => answerLocalApiRequest(request.id, response))
        .catch((error) => console.error("Failed to answer a local API request", error));
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => console.error("Failed to listen for local API requests", error));

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);
}
