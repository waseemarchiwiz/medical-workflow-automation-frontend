import axios from "axios";

export const APP_TITLE = "Soap Notes Automation";
export const AUDIO_ACCEPT = "audio/*,.wav,.mp3,.m4a,.aac,.webm";
export const API_ENDPOINT =
  import.meta.env.VITE_SOAP_UPLOAD_URL?.trim() ||
  "http://192.168.1.98:8000/v1/api";
export const API_KEY = import.meta.env.VITE_SOAP_API_KEY?.trim();
export const UPLOAD_VOICE_PATH =
  import.meta.env.VITE_UPLOAD_VOICE_PATH?.trim() || "/upload-voice";
export const GET_SOAPS_PATH =
  import.meta.env.VITE_GET_SOAPS_PATH?.trim() || "/get-soap";
export const CONFIRM_SOAP_PATH =
  import.meta.env.VITE_CONFIRM_SOAP_PATH?.trim() || "/confirm-soap-notes";
export const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024;

export const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  withCredentials: false,
});
