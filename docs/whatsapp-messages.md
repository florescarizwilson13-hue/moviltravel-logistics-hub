# WhatsApp Messages

WhatsApp is generation-only in this phase.

## Rules

- The app generates message bodies.
- The app saves generated messages in `request_messages`.
- The app does not send messages to WhatsApp.
- Sending can be added later through a separate provider or integration layer.

## Templates

- `request_summary`
- `driver_assignment`
- `missing_information`

Generation lives in `src/lib/messages/whatsapp.ts`.

## Assignment Flow

When a mock driver is assigned, the app generates two stored messages:

- Passenger/requester assignment notice.
- Driver assignment notice.

Both are saved locally with `status = generated`; no external WhatsApp API is called.
