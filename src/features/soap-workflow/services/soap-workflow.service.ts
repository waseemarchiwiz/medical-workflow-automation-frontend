import axios, { type AxiosProgressEvent } from "axios";

import type { RecordIdentifier } from "@/features/soap-workflow/types";
import { apiClient } from "@/shared/api/client";
import { appConfig } from "@/shared/config/app.config";

interface GetSoapNotesParams {
  transcriptionId: RecordIdentifier;
  description: string;
}

interface ConfirmSoapNotesParams {
  transcriptionId: RecordIdentifier;
  description: string;
  soapNotes: string;
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (
      error.response?.data &&
      typeof error.response.data === "object" &&
      "message" in error.response.data
    ) {
      return String(
        error.response.data.message + "Details: " + error.response.data?.error,
      );
    }

    return error.message || "Request failed.";
  }

  return error instanceof Error ? error.message : "An unknown error occurred.";
}

export async function uploadVoiceNote(
  file: File,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
) {
  try {
    const formData = new FormData();
    formData.append("voice", file);

    const response = await apiClient.post(
      appConfig.api.uploadVoicePath,
      formData,
      {
        onUploadProgress,
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function requestSoapNotes({
  transcriptionId,
  description,
}: GetSoapNotesParams) {
  try {
    const response = await apiClient.post(appConfig.api.getSoapPath, {
      id: transcriptionId,
      description,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function confirmSoapWorkflow({
  transcriptionId,
  description,
  soapNotes,
}: ConfirmSoapNotesParams) {
  try {
    const response = await apiClient.post(appConfig.api.confirmSoapPath, {
      id: transcriptionId,
      description,
      soapNotes,
      confirmedAt: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
