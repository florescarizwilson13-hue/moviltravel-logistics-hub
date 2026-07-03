import { buildDashboardOverview } from "@/modules/dashboard";
import {
  assignLocalDriver,
  createLocalDriver,
  createLocalTransferRequest,
  deleteLocalDriver,
  loadLocalLogisticsStore,
  saveLocalLogisticsStore,
  setLocalDriverActiveState,
  updateLocalDriver,
  updateLocalTransferRequest,
  markLocalRequestReady,
  type LocalLogisticsStore
} from "@/lib/local/logistics-store";
import type { LogisticsRepositories, LogisticsSnapshot } from "../types";

export function createLocalRepositories(): LogisticsRepositories {
  return {
    provider: "local",
    loadSnapshot: loadLocalLogisticsStore,
    saveSnapshot: saveLocalLogisticsStore,
    transferRequests: {
      create(snapshot, input) {
        const result = createLocalTransferRequest(snapshot as LocalLogisticsStore, input);
        return {
          snapshot: result.store,
          request: result.request
        };
      },
      update(snapshot, requestId, input) {
        return updateLocalTransferRequest(snapshot as LocalLogisticsStore, requestId, input);
      },
      markReady(snapshot, requestId) {
        return markLocalRequestReady(snapshot as LocalLogisticsStore, requestId);
      },
      assignDriver(snapshot, requestId, driverId) {
        const result = assignLocalDriver(snapshot as LocalLogisticsStore, requestId, driverId);
        return {
          snapshot: result.store,
          request: result.request,
          messages: result.messages
        };
      }
    },
    drivers: {
      create(snapshot, input) {
        return createLocalDriver(snapshot as LocalLogisticsStore, input);
      },
      update(snapshot, driverId, input) {
        return updateLocalDriver(snapshot as LocalLogisticsStore, driverId, input);
      },
      setActive(snapshot, driverId, isActive) {
        return setLocalDriverActiveState(snapshot as LocalLogisticsStore, driverId, isActive);
      },
      delete(snapshot, driverId) {
        return deleteLocalDriver(snapshot as LocalLogisticsStore, driverId);
      }
    },
    messages: {
      list(snapshot) {
        return [...snapshot.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      listByRequest(snapshot, requestId) {
        return snapshot.messages.filter((message) => message.transferRequestId === requestId);
      },
      latest(snapshot: LogisticsSnapshot, limit = 5) {
        return [...snapshot.messages]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit);
      },
      updateStatus(snapshot, messageId, status) {
        const updatedAt = new Date().toISOString();

        return {
          ...snapshot,
          messages: snapshot.messages.map((message) =>
            message.id === messageId ? { ...message, status, updatedAt } : message
          )
        };
      }
    },
    communicationEvents: {
      listByRequest(snapshot, requestId) {
        return snapshot.communicationEvents
          .filter((event) => event.transferRequestId === requestId)
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
      },
      create(snapshot, input) {
        const event = {
          id: crypto.randomUUID(),
          ...input,
          createdAt: new Date().toISOString()
        };

        return {
          ...snapshot,
          communicationEvents: [event, ...snapshot.communicationEvents]
        };
      }
    },
    travelEvents: {
      listByRequest(snapshot, requestId) {
        return snapshot.travelEvents
          .filter((event) => event.transferRequestId === requestId)
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
      },
      create(snapshot, input) {
        const event = {
          id: crypto.randomUUID(),
          ...input,
          createdAt: new Date().toISOString()
        };

        return {
          ...snapshot,
          travelEvents: [event, ...snapshot.travelEvents]
        };
      }
    },
    aiConversations: {
      async list() {
        return [];
      },
      async save(conversation) {
        return conversation;
      }
    },
    dashboard: {
      getOverview(snapshot) {
        return buildDashboardOverview(snapshot);
      }
    }
  };
}
