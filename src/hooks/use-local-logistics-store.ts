"use client";

import { useEffect, useState } from "react";
import {
  createLogisticsRepositories,
  type LogisticsRepositories,
  type LogisticsSnapshot
} from "@/lib/repositories";

const repositories = createLogisticsRepositories();
const EMPTY_LOGISTICS_SNAPSHOT: LogisticsSnapshot = {
  requests: [],
  drivers: [],
  messages: [],
  communicationEvents: [],
  travelEvents: []
};

export function useLocalLogisticsStore() {
  const [store, setStoreState] = useState<LogisticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let initialStore = EMPTY_LOGISTICS_SNAPSHOT;

    try {
      initialStore = repositories.loadSnapshot();
    } catch {
      setError("No se pudo cargar la información guardada en este navegador. Intentaremos actualizarla.");
    }

    setStoreState(initialStore);

    if (!repositories.refreshSnapshot) {
      return;
    }

    let isMounted = true;
    setIsRefreshing(true);
    repositories
      .refreshSnapshot(initialStore)
      .then((nextStore) => {
        if (!isMounted) {
          return;
        }
        repositories.saveSnapshot(nextStore);
        setStoreState(nextStore);
        setError(null);
      })
      .catch((caught) => {
        if (!isMounted) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar la información desde Supabase."
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsRefreshing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function setStore(nextStore: LogisticsSnapshot) {
    repositories.saveSnapshot(nextStore);
    setStoreState(nextStore);
  }

  return {
    store,
    setStore,
    error,
    isRefreshing,
    repositories: repositories as LogisticsRepositories,
    isReady: store !== null
  };
}
