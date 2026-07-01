import { mockAiCaptureProvider } from "@/lib/ai";
import type { AiCaptureProvider } from "@/lib/ai/provider";
import {
  getTransferRequestCompleteness,
  TRANSFER_REQUEST_FIELD_LABELS
} from "@/modules/transfer-requests";
import type {
  AiCompletionResult,
  CreateTransferRequestInput,
  TransferRequest
} from "@/types";

const mergeableFields: Array<keyof CreateTransferRequestInput> = [
  "companyName",
  "requesterName",
  "requesterPhone",
  "passengerName",
  "passengerPhone",
  "passengerCount",
  "pickupDate",
  "pickupTime",
  "originAddress",
  "destinationAddress",
  "notes"
];

export function createAiCaptureService(provider: AiCaptureProvider = mockAiCaptureProvider) {
  return {
    captureTransferRequest: provider.captureTransferRequest,
    async completeExistingTransferRequest(input: {
      request: TransferRequest;
      message: string;
    }): Promise<AiCompletionResult> {
      const analysis = await provider.captureTransferRequest({ message: input.message });
      const merge = mergeCapturedDataIntoRequest(input.request, analysis.capturedData);
      const completenessAfterMerge = getTransferRequestCompleteness(merge.mergedData);
      const missingFieldsAfterMerge = completenessAfterMerge.missingFields.map(
        (field) => TRANSFER_REQUEST_FIELD_LABELS[field] ?? field
      );

      return {
        ...analysis,
        assistantMessage: buildMergedAssistantMessage(missingFieldsAfterMerge),
        mergedData: merge.mergedData,
        newlyAppliedFields: merge.newlyAppliedFields,
        skippedExistingFields: merge.skippedExistingFields,
        missingFieldsAfterMerge,
        readyForReviewAfterMerge: completenessAfterMerge.isComplete
      };
    }
  };
}

export function mergeCapturedDataIntoRequest(
  request: TransferRequest,
  capturedData: CreateTransferRequestInput
) {
  const mergedData: CreateTransferRequestInput = { ...request };
  const newlyAppliedFields: Array<keyof CreateTransferRequestInput> = [];
  const skippedExistingFields: Array<keyof CreateTransferRequestInput> = [];

  for (const field of mergeableFields) {
    const capturedValue = capturedData[field];

    if (isEmpty(capturedValue)) {
      continue;
    }

    if (isEmpty((request as CreateTransferRequestInput)[field])) {
      mergedData[field] = capturedValue as never;
      newlyAppliedFields.push(field);
      continue;
    }

    skippedExistingFields.push(field);
  }

  return {
    mergedData,
    newlyAppliedFields,
    skippedExistingFields
  };
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}

function buildMergedAssistantMessage(missingFields: string[]) {
  if (missingFields.length === 0) {
    return "Gracias. Ya tenemos los datos necesarios para revisar y coordinar tu traslado.";
  }

  return `Gracias. Para coordinar el traslado, ¿me indicas ${missingFields.join(", ")}?`;
}
