# AI Capture

AI capture is mocked for the first delivery.

## Current Behavior

`src/lib/ai/mock-provider.ts` reads simple labels and common free-text patterns from text:

- `nombre:`
- `telefono:`
- `origen:`
- `destino:`
- `fecha:`
- `para [nombre]`
- `2 pasajeros`, `3 personas`, `4 pax`
- `10:30`
- `desde ...`
- `al ...` or `a ...`

The service returns captured data, missing fields, confidence, readiness for review and an assistant message.

## Completing Existing Requests

`src/modules/ai-capture/service.ts` can merge new captured data into an existing incomplete request.

The merge rule is conservative:

- Fill only empty or pending fields.
- Keep existing valid values.
- Do not overwrite an existing value automatically when a new message mentions the same field.
- Recalculate missing fields after the merge using `src/modules/transfer-requests`.

## Provider Design

Real providers should implement `AiCaptureProvider` from `src/lib/ai/provider.ts`.

This keeps the business workflow independent from OpenAI, Anthropic or any future provider.

## Replacing With OpenAI

Create a provider that implements `AiCaptureProvider` and returns the same `AiCaptureResult` shape:

- `capturedData`
- `missingFields`
- `assistantMessage`
- `confidence`
- `readyForReview`
- `extractedFields`

Then pass that provider to `createAiCaptureService(provider)` in `src/modules/ai-capture/service.ts` or switch providers from a small factory based on `AI_PROVIDER`.

Keep validation and request creation outside the provider so the UI and local/Supabase persistence do not depend on a specific AI vendor.
