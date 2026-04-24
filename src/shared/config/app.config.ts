// api url
const api_url =
  import.meta.env.VITE_API_URL?.trim() || "http://192.168.1.98:8000/v1/api";
// app config
export const appConfig = {
  title: "SOAP Notes Automation",
  audioAccept: "audio/*,.wav,.mp3,.m4a,.aac,.webm,.ogg",
  maxAudioSizeBytes: 50 * 1024 * 1024,
  api: {
    baseUrl: api_url,
    uploadVoicePath: api_url + "/upload-voice",
    getSoapPath: api_url + "/get-soap",
    confirmSoapPath: api_url + "/confirm-soap-notes",
  },
} as const;
