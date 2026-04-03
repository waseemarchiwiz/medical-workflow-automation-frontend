import axios, { type AxiosProgressEvent } from "axios";

import {
  CONFIRM_SOAP_PATH,
  GET_SOAPS_PATH,
  UPLOAD_VOICE_PATH,
  apiClient,
} from "../config";

type RecordIdentifier = number | string;

interface UploadAudioParams {
  file: File;
}

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
      return String(error.response.data.message);
    }

    return error.message || "Request failed.";
  }

  return error instanceof Error ? error.message : "An unknown error occurred.";
}

export async function uploadAudio(
  { file }: UploadAudioParams,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
) {
  try {
    const formData = new FormData();
    formData.append("voice", file);

    const response = await apiClient.post(UPLOAD_VOICE_PATH, formData, {
      onUploadProgress,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getSoapNotes({
  transcriptionId,
  description,
}: GetSoapNotesParams) {
  try {
    const response = await apiClient.post(GET_SOAPS_PATH, {
      id: transcriptionId,
      description,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function confirmSoapNotes({
  transcriptionId,
  description,
  soapNotes,
}: ConfirmSoapNotesParams) {
  try {
    const response = await apiClient.post(CONFIRM_SOAP_PATH, {
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
