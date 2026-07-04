import {
  buildDriverAssignmentBody,
  buildPassengerAssignmentBody
} from "@/lib/messages/whatsapp";
import type {
  WhatsAppOutboundIntent,
  WhatsAppOutboundRenderResult,
  WhatsAppOutboundTripOption
} from "./types";

const fallbackValue = "Sin información";

export function renderWhatsAppOutboundMessage(
  input: WhatsAppOutboundIntent
): WhatsAppOutboundRenderResult {
  switch (input.type) {
    case "passenger_assignment": {
      const body = buildPassengerAssignmentBody(
        input.context.request,
        input.context.driver
      );

      return renderText(body);
    }
    case "driver_assignment": {
      return renderText(buildDriverAssignmentBody(input.context.request));
    }
    case "driver_trip_list":
      return renderDriverTripList(input.context.trips);
    case "location_request":
      return renderLocationRequest(input.context.selectedTrip);
    default:
      return renderText(buildDriverConfirmationText(input));
  }
}

function renderText(body: string): WhatsAppOutboundRenderResult {
  return {
    kind: "text",
    body,
    fallbackText: body
  };
}

function renderDriverTripList(trips: WhatsAppOutboundTripOption[]): WhatsAppOutboundRenderResult {
  const fallbackText = buildTripListFallbackText(trips);

  return {
    kind: "interactive_list",
    body: "Selecciona el viaje que vas a operar.",
    buttonText: "Ver mis viajes",
    sections: [
      {
        title: "Viajes disponibles",
        rows: trips.map((trip, index) => ({
          id: trip.id,
          title: `${index + 1}. ${safeText(trip.scheduleLabel)} · ${safeText(trip.passengerName)}`,
          description: `${safeText(trip.originAddress)} → ${safeText(trip.destinationAddress)}`
        }))
      }
    ],
    fallbackText
  };
}

function renderLocationRequest(trip: WhatsAppOutboundTripOption): WhatsAppOutboundRenderResult {
  const body = [
    "Comparte tu ubicación actual para registrar el hito.",
    "",
    `Pasajero: ${safeText(trip.passengerName)}`,
    `Origen: ${safeText(trip.originAddress)}`,
    `Destino: ${safeText(trip.destinationAddress)}`
  ].join("\n");

  return {
    kind: "location_request",
    body,
    fallbackText: body
  };
}

function buildDriverConfirmationText(input: Extract<
  WhatsAppOutboundIntent,
  {
    type:
      | "driver_trip_selected"
      | "driver_arrived_pickup_confirmation"
      | "driver_passenger_on_board_confirmation"
      | "driver_completed_confirmation"
      | "driver_incident_confirmation"
      | "location_request";
  }
>) {
  const trip = input.context.selectedTrip;
  const eventTime = input.context.eventTime ?? fallbackValue;
  const titleByType: Record<typeof input.type, string> = {
    driver_trip_selected: "Viaje seleccionado.",
    driver_arrived_pickup_confirmation: `Registrado: llegaste al origen a las ${eventTime}.`,
    driver_passenger_on_board_confirmation: `Registrado: saliste con el pasajero a las ${eventTime}.`,
    driver_completed_confirmation: `Servicio finalizado registrado a las ${eventTime}.`,
    driver_incident_confirmation: `Incidencia registrada a las ${eventTime}.`,
    location_request: "Comparte tu ubicación actual para registrar el hito."
  };

  return [
    titleByType[input.type],
    "",
    `Pasajero: ${safeText(trip.passengerName)}`,
    `Origen: ${safeText(trip.originAddress)}`,
    `Destino: ${safeText(trip.destinationAddress)}`,
    `Horario: ${safeText(trip.scheduleLabel)}`
  ].join("\n");
}

function buildTripListFallbackText(trips: WhatsAppOutboundTripOption[]) {
  if (trips.length === 0) {
    return "No tienes viajes operables cercanos en este momento.";
  }

  return [
    "Tus viajes disponibles:",
    "",
    ...trips.map((trip, index) =>
      [
        `${index + 1}. ${safeText(trip.scheduleLabel)} · ${safeText(trip.passengerName)}`,
        `${safeText(trip.originAddress)} → ${safeText(trip.destinationAddress)}`
      ].join("\n")
    ),
    "",
    "Selecciona el viaje que vas a operar."
  ].join("\n");
}

function safeText(value: string | null | undefined) {
  return value?.trim() || fallbackValue;
}
