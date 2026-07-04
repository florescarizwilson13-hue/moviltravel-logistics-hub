import type { Driver, TransferRequest } from "@/types";

export type WhatsAppOutboundIntentType =
  | "passenger_assignment"
  | "driver_assignment"
  | "driver_trip_list"
  | "driver_trip_selected"
  | "driver_arrived_pickup_confirmation"
  | "driver_passenger_on_board_confirmation"
  | "driver_completed_confirmation"
  | "driver_incident_confirmation"
  | "location_request";

export type WhatsAppOutboundRecipient = {
  type: "passenger" | "requester" | "driver" | "coordinator";
  name?: string | null;
  phone?: string | null;
};

export type WhatsAppOutboundTripOption = {
  id: string;
  passengerName?: string | null;
  originAddress?: string | null;
  destinationAddress?: string | null;
  scheduleLabel?: string | null;
};

export type WhatsAppOutboundContext = {
  request?: TransferRequest;
  driver?: Driver;
  trips?: WhatsAppOutboundTripOption[];
  selectedTrip?: WhatsAppOutboundTripOption;
  eventTime?: string | null;
};

export type WhatsAppOutboundIntent =
  | {
      type: "passenger_assignment" | "driver_assignment";
      recipient: WhatsAppOutboundRecipient;
      context: WhatsAppOutboundContext & {
        request: TransferRequest;
        driver: Driver;
      };
    }
  | {
      type: "driver_trip_list";
      recipient: WhatsAppOutboundRecipient;
      context: WhatsAppOutboundContext & {
        trips: WhatsAppOutboundTripOption[];
      };
    }
  | {
      type:
        | "driver_trip_selected"
        | "driver_arrived_pickup_confirmation"
        | "driver_passenger_on_board_confirmation"
        | "driver_completed_confirmation"
        | "driver_incident_confirmation"
        | "location_request";
      recipient: WhatsAppOutboundRecipient;
      context: WhatsAppOutboundContext & {
        selectedTrip: WhatsAppOutboundTripOption;
      };
    };

export type WhatsAppOutboundTextRenderResult = {
  kind: "text";
  body: string;
  fallbackText: string;
};

export type WhatsAppOutboundTemplateRenderResult = {
  kind: "template";
  templateName: string;
  languageCode: string;
  variables: Record<string, string | number | null | undefined>;
  fallbackText: string;
};

export type WhatsAppOutboundInteractiveButtonsRenderResult = {
  kind: "interactive_buttons";
  body: string;
  buttons: Array<{
    id: string;
    title: string;
  }>;
  fallbackText: string;
};

export type WhatsAppOutboundInteractiveListRenderResult = {
  kind: "interactive_list";
  body: string;
  buttonText: string;
  sections: Array<{
    title?: string | null;
    rows: Array<{
      id: string;
      title: string;
      description?: string | null;
    }>;
  }>;
  fallbackText: string;
};

export type WhatsAppOutboundLocationRequestRenderResult = {
  kind: "location_request";
  body: string;
  fallbackText: string;
};

export type WhatsAppOutboundRenderResult =
  | WhatsAppOutboundTextRenderResult
  | WhatsAppOutboundTemplateRenderResult
  | WhatsAppOutboundInteractiveButtonsRenderResult
  | WhatsAppOutboundInteractiveListRenderResult
  | WhatsAppOutboundLocationRequestRenderResult;

export type WhatsAppOutboundMessage = {
  intent: WhatsAppOutboundIntent;
  rendered: WhatsAppOutboundRenderResult;
};
