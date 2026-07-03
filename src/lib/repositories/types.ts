import type {
  AiConversation,
  CommunicationEvent,
  CreateCommunicationEventInput,
  CreateDriverInput,
  CreateTransferRequestInput,
  Driver,
  MessageStatus,
  RequestMessage,
  TransferRequest,
  TravelEvent,
  CreateTravelEventInput
} from "@/types";
import type { buildDashboardOverview } from "@/modules/dashboard";

export type PersistenceProvider = "local" | "supabase";

export type LogisticsSnapshot = {
  requests: TransferRequest[];
  drivers: Driver[];
  messages: RequestMessage[];
  communicationEvents: CommunicationEvent[];
  travelEvents: TravelEvent[];
};

export type TransferRequestRepository = {
  create(
    snapshot: LogisticsSnapshot,
    input: CreateTransferRequestInput
  ): {
    snapshot: LogisticsSnapshot;
    request: TransferRequest;
  } | Promise<{
    snapshot: LogisticsSnapshot;
    request: TransferRequest;
  }>;
  update(
    snapshot: LogisticsSnapshot,
    requestId: string,
    input: CreateTransferRequestInput
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
  markReady(snapshot: LogisticsSnapshot, requestId: string): LogisticsSnapshot | Promise<LogisticsSnapshot>;
  assignDriver(
    snapshot: LogisticsSnapshot,
    requestId: string,
    driverId: string
  ): {
    snapshot: LogisticsSnapshot;
    request: TransferRequest;
    messages: RequestMessage[];
  } | Promise<{
    snapshot: LogisticsSnapshot;
    request: TransferRequest;
    messages: RequestMessage[];
  }>;
};

export type DriverRepository = {
  create(
    snapshot: LogisticsSnapshot,
    input: CreateDriverInput
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
  update(
    snapshot: LogisticsSnapshot,
    driverId: string,
    input: CreateDriverInput
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
  setActive(
    snapshot: LogisticsSnapshot,
    driverId: string,
    isActive: boolean
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
  delete(snapshot: LogisticsSnapshot, driverId: string): LogisticsSnapshot | Promise<LogisticsSnapshot>;
};

export type MessageRepository = {
  list(snapshot: LogisticsSnapshot): RequestMessage[];
  listByRequest(snapshot: LogisticsSnapshot, requestId: string): RequestMessage[];
  latest(snapshot: LogisticsSnapshot, limit?: number): RequestMessage[];
  updateStatus(
    snapshot: LogisticsSnapshot,
    messageId: string,
    status: MessageStatus
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
};

export type CommunicationEventRepository = {
  listByRequest(snapshot: LogisticsSnapshot, requestId: string): CommunicationEvent[];
  create(
    snapshot: LogisticsSnapshot,
    input: CreateCommunicationEventInput
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
};

export type TravelEventRepository = {
  listByRequest(snapshot: LogisticsSnapshot, requestId: string): TravelEvent[];
  create(
    snapshot: LogisticsSnapshot,
    input: CreateTravelEventInput
  ): LogisticsSnapshot | Promise<LogisticsSnapshot>;
};

export type AiConversationRepository = {
  list(): Promise<AiConversation[]>;
  save(conversation: AiConversation): Promise<AiConversation>;
};

export type DashboardRepository = {
  getOverview(snapshot: LogisticsSnapshot): ReturnType<typeof buildDashboardOverview>;
};

export type LogisticsRepositories = {
  provider: PersistenceProvider;
  loadSnapshot(): LogisticsSnapshot;
  refreshSnapshot?(snapshot: LogisticsSnapshot): Promise<LogisticsSnapshot>;
  saveSnapshot(snapshot: LogisticsSnapshot): void;
  transferRequests: TransferRequestRepository;
  drivers: DriverRepository;
  messages: MessageRepository;
  communicationEvents: CommunicationEventRepository;
  travelEvents: TravelEventRepository;
  aiConversations: AiConversationRepository;
  dashboard: DashboardRepository;
};
