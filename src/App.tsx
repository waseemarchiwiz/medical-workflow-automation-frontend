import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AudioLines,
  AudioWaveform,
  CloudUpload,
  LoaderCircle,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Progress } from "./components/ui/progress";
import { Textarea } from "./components/ui/textarea";
import { APP_TITLE, AUDIO_ACCEPT, MAX_AUDIO_SIZE_BYTES } from "./config";
import {
  confirmSoapNotes,
  getSoapNotes,
  uploadAudio,
} from "./services/upload.services";

type VoiceSource = "upload" | "record";
type StatusTone = "idle" | "success" | "error";

interface TranscriptionRecord {
  id: number | string;
  description: string;
  voiceId?: number | string;
}

interface SoapSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const RESPONSE_TEXT_KEYS = [
  "transcript",
  "text",
  "content",
  "draft",
  "message",
  "summary",
];

const EMPTY_SOAP_SECTIONS: SoapSections = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isAudioFile(file: File) {
  return (
    file.type.startsWith("audio/") ||
    /\.(wav|mp3|m4a|aac|webm|ogg)$/i.test(file.name)
  );
}

function extractPreferredText(value: unknown, keys: string[]): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedText = extractPreferredText(item, keys);

      if (nestedText) {
        return nestedText;
      }
    }

    return "";
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of keys) {
      const candidate = record[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    for (const candidate of Object.values(record)) {
      const nestedText = extractPreferredText(candidate, keys);

      if (nestedText) {
        return nestedText;
      }
    }
  }

  return "";
}

function buildFallbackSoapSections(description: string): SoapSections {
  return {
    subjective: description.trim() || "-",
    objective: "",
    assessment: "",
    plan: "",
  };
}

function readSoapSections(source: unknown): SoapSections | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;

  const sections: SoapSections = {
    subjective:
      typeof record.subjective === "string" ? record.subjective.trim() : "",
    objective:
      typeof record.objective === "string" ? record.objective.trim() : "",
    assessment:
      typeof record.assessment === "string" ? record.assessment.trim() : "",
    plan: typeof record.plan === "string" ? record.plan.trim() : "",
  };

  return Object.values(sections).some((section) => section) ? sections : null;
}

function parseSoapSectionsFromJson(value: unknown): SoapSections | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return readSoapSections(JSON.parse(value));
  } catch {
    return null;
  }
}

function getParsedSoapSections(value: unknown): SoapSections | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const response = value as {
    parsed?: unknown;
    soap?: {
      parsed?: unknown;
      record?: {
        description?: unknown;
      };
    };
    record?: {
      description?: unknown;
    };
  };

  return (
    readSoapSections(response.soap?.parsed) ||
    readSoapSections(response.parsed) ||
    parseSoapSectionsFromJson(response.soap?.record?.description) ||
    parseSoapSectionsFromJson(response.record?.description)
  );
}

function serializeSoapSections(sections: SoapSections) {
  return [
    `Subjective:\n${sections.subjective.trim() || "-"}`,
    `Objective:\n${sections.objective.trim() || "-"}`,
    `Assessment:\n${sections.assessment.trim() || "-"}`,
    `Plan:\n${sections.plan.trim() || "-"}`,
  ].join("\n\n");
}

function hasSoapContent(sections: SoapSections) {
  return Object.values(sections).some((section) => section.trim());
}

function getTranscriptionRecord(value: unknown): TranscriptionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = (
    value as {
      transcription?: {
        record?: Record<string, unknown>;
      };
    }
  ).transcription?.record;

  if (!record) {
    return null;
  }

  const id = record.id;
  const description =
    typeof record.description === "string" ? record.description.trim() : "";

  if ((typeof id === "number" || typeof id === "string") && description) {
    return {
      id,
      description,
      ...(typeof record.voiceId === "number" ||
      typeof record.voiceId === "string"
        ? { voiceId: record.voiceId }
        : {}),
    };
  }

  return null;
}

function App() {
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [voiceSource, setVoiceSource] = useState<VoiceSource | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Choose a voice note or record one live, then send it to begin the SOAP workflow.",
  );
  const [recorderError, setRecorderError] = useState("");
  const [uploadResponseData, setUploadResponseData] = useState<unknown | null>(
    null,
  );
  const [transcriptionRecord, setTranscriptionRecord] =
    useState<TranscriptionRecord | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const [isResponseConfirmed, setIsResponseConfirmed] = useState(false);
  const [isGettingSoaps, setIsGettingSoaps] = useState(false);
  const [soapSections, setSoapSections] =
    useState<SoapSections>(EMPTY_SOAP_SECTIONS);
  const [isConfirmingSoap, setIsConfirmingSoap] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const showWorkflowStepOne = Boolean(uploadResponseData);
  const showWorkflowStepTwo = showWorkflowStepOne && isResponseConfirmed;
  const showWorkflowStepThree =
    showWorkflowStepTwo &&
    (hasSoapContent(soapSections) ||
      isConfirmingSoap ||
      Boolean(confirmationMessage));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  useEffect(() => {
    if (!selectedAudio) {
      setAudioPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAudio);
    setAudioPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAudio]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }

      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetWorkflowState() {
    setUploadResponseData(null);
    setTranscriptionRecord(null);
    setReviewDraft("");
    setIsResponseConfirmed(false);
    setSoapSections(EMPTY_SOAP_SECTIONS);
    setConfirmationMessage("");
  }

  function resetRecordingResources() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function selectAudio(file: File, source: VoiceSource) {
    if (!isAudioFile(file)) {
      setStatusTone("error");
      setStatusMessage("Please choose a valid audio file before sending.");
      return;
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setStatusTone("error");
      setStatusMessage(
        "Audio files larger than 50 MB are not supported in this screen.",
      );
      return;
    }

    resetWorkflowState();
    setSelectedAudio(file);
    setVoiceSource(source);
    setUploadProgress(0);
    setRecorderError("");
    setStatusTone("idle");
    setStatusMessage(
      source === "record"
        ? "Recording captured. Send it to the API, then review the transcription record."
        : "Audio file ready. Send it to the API, then review the transcription record.",
    );
  }

  function handleReviewDraftChange(nextValue: string) {
    setReviewDraft(nextValue);
    setIsResponseConfirmed(false);
    setSoapSections(EMPTY_SOAP_SECTIONS);
    setConfirmationMessage("");
  }

  function handleSoapSectionChange(
    section: keyof SoapSections,
    nextValue: string,
  ) {
    setSoapSections((currentSections) => ({
      ...currentSections,
      [section]: nextValue,
    }));
    setConfirmationMessage("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (isRecording) {
      setRecorderError(
        "Stop the current recording before uploading a different clip.",
      );
      event.target.value = "";
      return;
    }

    selectAudio(file, "upload");
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    if (isRecording) {
      setRecorderError(
        "Stop the current recording before uploading a different clip.",
      );
      return;
    }

    selectAudio(file, "upload");
  }

  async function startRecording() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecorderError(
        "This browser does not support in-page voice recording.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((mimeType) =>
          MediaRecorder.isTypeSupported(mimeType),
        ) || "";
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecorderError("");
      setUploadProgress(0);
      setStatusTone("idle");
      setStatusMessage(
        "Recording in progress. Speak your SOAP note clearly, then stop when ready.",
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecorderError(
          "Recording failed. Please try again or upload an existing audio file.",
        );
        setIsRecording(false);
        resetRecordingResources();
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        const recordedBlob = new Blob(recordedChunksRef.current, {
          type: mimeType,
        });

        resetRecordingResources();
        setIsRecording(false);

        if (recordedBlob.size === 0) {
          setRecorderError(
            "No audio was captured. Please try the recording again.",
          );
          return;
        }

        const recordedFile = new File(
          [recordedBlob],
          `soap-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
          {
            type: mimeType,
            lastModified: Date.now(),
          },
        );

        selectAudio(recordedFile, "record");
      };

      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((previousSeconds) => previousSeconds + 1);
      }, 1000);
    } catch {
      resetRecordingResources();
      setIsRecording(false);
      setRecorderError(
        "Microphone access was blocked. Allow it in the browser and try again.",
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recorder.stop();
  }

  function clearAudio() {
    setSelectedAudio(null);
    setVoiceSource(null);
    setUploadProgress(0);
    setRecorderError("");
    resetWorkflowState();
    setStatusTone("idle");
    setStatusMessage(
      "Choose a voice note or record one live, then send it to begin the SOAP workflow.",
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitAudio() {
    if (!selectedAudio) {
      setStatusTone("error");
      setStatusMessage(
        "Add an audio file before sending it to the automation workflow.",
      );
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setStatusTone("idle");
    setStatusMessage(
      "Sending audio to the API and waiting for the transcription record...",
    );

    try {
      const response = await uploadAudio(
        {
          file: selectedAudio,
        },
        (progressEvent) => {
          const totalBytes = progressEvent.total ?? selectedAudio.size;

          if (!totalBytes) {
            return;
          }

          setUploadProgress(
            Math.min(
              100,
              Math.round((progressEvent.loaded / totalBytes) * 100),
            ),
          );
        },
      );

      const nextTranscriptionRecord = getTranscriptionRecord(response);
      const nextReviewDraft =
        nextTranscriptionRecord?.description ||
        extractPreferredText(response, RESPONSE_TEXT_KEYS) ||
        `Uploaded ${selectedAudio.name}. Review or replace this transcription before requesting SOAP notes.`;

      setUploadResponseData(response);
      setTranscriptionRecord(nextTranscriptionRecord);
      setReviewDraft(nextReviewDraft);
      setIsResponseConfirmed(false);
      setSoapSections(EMPTY_SOAP_SECTIONS);
      setConfirmationMessage("");
      setStatusTone("success");
      setStatusMessage(
        nextTranscriptionRecord
          ? `Upload complete. Transcription #${nextTranscriptionRecord.id} is ready for review.`
          : "Upload complete. Review the returned transcription before requesting SOAP notes.",
      );
      setUploadProgress(100);
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Check the API configuration and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmReviewedResponse() {
    if (!reviewDraft.trim()) {
      setStatusTone("error");
      setStatusMessage("Add or edit the transcription before confirming it.");
      return;
    }

    setIsResponseConfirmed(true);
    setStatusTone("success");
    setStatusMessage(
      "Transcription confirmed. You can now request SOAP notes from /get-soaps.",
    );
  }

  async function handleGetSoapNotes() {
    if (!reviewDraft.trim()) {
      setStatusTone("error");
      setStatusMessage(
        "Confirm the transcription before requesting SOAP notes.",
      );
      return;
    }

    if (!isResponseConfirmed) {
      setStatusTone("error");
      setStatusMessage("Please confirm the transcription first.");
      return;
    }

    if (!transcriptionRecord) {
      setStatusTone("error");
      setStatusMessage(
        "No transcription record was returned from the upload response.",
      );
      return;
    }

    setIsGettingSoaps(true);
    setStatusTone("idle");
    setStatusMessage(
      `Requesting SOAP notes for transcription #${transcriptionRecord.id}...`,
    );

    try {
      const response = await getSoapNotes({
        transcriptionId: transcriptionRecord.id,
        description: reviewDraft,
      });

      const nextSoapSections =
        getParsedSoapSections(response) ||
        buildFallbackSoapSections(reviewDraft);

      setSoapSections(nextSoapSections);
      setConfirmationMessage("");
      setStatusTone("success");
      setStatusMessage(
        "SOAP notes received in subjective, objective, assessment, and plan format.",
      );
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "SOAP retrieval failed. Please try again.",
      );
    } finally {
      setIsGettingSoaps(false);
    }
  }

  async function handleConfirmSoapNotes() {
    if (!hasSoapContent(soapSections)) {
      setStatusTone("error");
      setStatusMessage("Generate or add SOAP notes before confirming them.");
      return;
    }

    if (!transcriptionRecord) {
      setStatusTone("error");
      setStatusMessage(
        "No transcription record is available for confirmation.",
      );
      return;
    }

    setIsConfirmingSoap(true);
    setStatusTone("idle");
    setStatusMessage("Sending the confirmed SOAP notes back to the API...");

    try {
      await confirmSoapNotes({
        transcriptionId: transcriptionRecord.id,
        description: reviewDraft,
        soapNotes: serializeSoapSections(soapSections),
      });

      setConfirmationMessage("Successfully stored.");
      setStatusTone("success");
      setStatusMessage("SOAP notes successfully stored.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Confirmation failed. Please try again.",
      );
    } finally {
      setIsConfirmingSoap(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute left-[-8%] top-[-6%] h-72 w-72 rounded-full bg-[rgba(15,118,110,0.14)] blur-3xl" />
      <div className="absolute bottom-0 right-[-10%] h-80 w-80 rounded-full bg-[rgba(201,108,49,0.16)] blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <header className="rounded-[32px] border border-white/50 bg-white/55 px-5 py-5 shadow-[var(--shadow)] backdrop-blur-xl sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
                NeuroICU Voice Intake
              </Badge>
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                  Upload, review, get soaps, and confirm
                </p>
                <h1
                  className="max-w-3xl text-4xl leading-none tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl xl:text-6xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {APP_TITLE}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  Upload or record audio, review the returned transcription
                  record, request SOAP notes from `/get-soaps`, and confirm the
                  final result.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-6 grid flex-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle
                  className="text-2xl tracking-[-0.03em] text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Upload voice note
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-[var(--muted)]">
                  Drag an audio file here or browse from your device.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Audio file
                </Label>
                <input
                  ref={fileInputRef}
                  accept={AUDIO_ACCEPT}
                  className="hidden"
                  id="voice-upload"
                  type="file"
                  onChange={handleFileChange}
                />
                <div
                  className={`rounded-[28px] border-2 border-dashed p-6 transition ${
                    dragActive
                      ? "border-[var(--primary)] bg-[rgba(15,118,110,0.1)]"
                      : "border-[rgba(36,28,23,0.12)] bg-white/40"
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-full bg-[rgba(15,118,110,0.12)] p-4 text-[var(--primary)]">
                      <CloudUpload className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                      Drop voice files here
                    </p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                      WAV, MP3, M4A, AAC, and WebM files work well here. Maximum
                      size: 50 MB.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-5"
                      disabled={isRecording}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <AudioLines className="mr-2 h-4 w-4" />
                      Browse audio
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle
                  className="text-2xl tracking-[-0.03em] text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Record live audio
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-[var(--muted)]">
                  Start recording when you are ready to dictate your SOAP note.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[28px] border border-white/55 bg-white/45 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        Recorder status
                      </p>
                      <p
                        className="mt-2 text-3xl tracking-[-0.04em] text-[var(--foreground)]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {isRecording ? formatTime(recordingSeconds) : "Ready"}
                      </p>
                    </div>
                    <Badge
                      variant={isRecording ? "default" : "secondary"}
                      className={
                        isRecording
                          ? "bg-[var(--danger)] text-[var(--danger-foreground)]"
                          : "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]"
                      }
                    >
                      {isRecording ? "Recording" : "Standby"}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                    The browser will ask for microphone permission the first
                    time you start recording.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="lg"
                      disabled={isRecording}
                      onClick={startRecording}
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      Start recording
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="border-white/70 bg-white/55"
                      disabled={!isRecording}
                      onClick={stopRecording}
                    >
                      Stop recording
                    </Button>
                  </div>
                </div>

                {recorderError ? (
                  <div className="rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.86)] px-4 py-3 text-sm text-[var(--danger)]">
                    {recorderError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle
                      className="text-2xl tracking-[-0.03em] text-[var(--foreground)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Selected voice note
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      Send the clip first, then the transcription-driven
                      workflow opens below.
                    </CardDescription>
                  </div>
                  {voiceSource ? (
                    <Badge
                      variant="secondary"
                      className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]"
                    >
                      {voiceSource === "record"
                        ? "Recorded in browser"
                        : "Uploaded file"}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className={`rounded-[28px] border p-5 transition ${
                    selectedAudio
                      ? "border-white/55 bg-white/55 shadow-[0_16px_32px_rgba(69,45,27,0.08)]"
                      : "border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.28)]"
                  }`}
                >
                  {selectedAudio ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                            Active clip
                          </p>
                          <p className="text-lg font-semibold text-[var(--foreground)]">
                            {selectedAudio.name}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {formatFileSize(selectedAudio.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/70 bg-white/55"
                          onClick={clearAudio}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove clip
                        </Button>
                      </div>
                      {audioPreviewUrl ? (
                        <audio
                          controls
                          className="w-full rounded-2xl border border-white/60 bg-white/70 p-2"
                          src={audioPreviewUrl}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-48 flex-col items-center justify-center text-center">
                      <AudioWaveform className="h-10 w-10 text-[var(--muted-foreground)]" />
                      <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                        No voice note selected yet
                      </p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                        Use the upload panel or record panel to prepare a clip
                        for submission.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-[24px] border border-white/55 bg-white/45 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        Submission status
                      </p>
                      <p
                        className={`mt-1 text-sm leading-6 ${
                          statusTone === "error"
                            ? "text-[var(--danger)]"
                            : statusTone === "success"
                              ? "text-[var(--primary)]"
                              : "text-[var(--muted)]"
                        }`}
                      >
                        {statusMessage}
                      </p>
                    </div>
                    {uploadProgress > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-white/60 bg-white/55"
                      >
                        {uploadProgress}% sent
                      </Badge>
                    ) : null}
                  </div>
                  <Progress value={uploadProgress} />
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!selectedAudio || isSubmitting}
                    onClick={submitAudio}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Sending voice note
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send to API
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Card className="mt-10 w-full border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle
              className="text-2xl tracking-[-0.03em] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Transcription and SOAP workflow
            </CardTitle>
            <CardDescription className="mt-1 text-sm leading-6 text-[var(--muted)]">
              First review `transcription.record`, then request `/get-soaps`,
              then confirm the final SOAP note.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!showWorkflowStepOne ? (
              <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.35)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Workflow steps
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Send a recorded or uploaded voice note first. When the upload
                  response arrives, Step 1 opens with the returned transcription
                  description.
                </p>
              </div>
            ) : null}

            {showWorkflowStepOne ? (
              <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Step 1
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      Confirm the transcription
                    </h3>
                  </div>
                  <Badge
                    variant={isResponseConfirmed ? "secondary" : "outline"}
                    className={
                      isResponseConfirmed
                        ? "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]"
                        : "border-white/60 bg-white/55"
                    }
                  >
                    {isResponseConfirmed ? "Confirmed" : "Pending"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  This field is populated from
                  `transcription.record.description`. You can edit it before
                  continuing.
                </p>
                {transcriptionRecord ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.55)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        Transcription ID
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                        {transcriptionRecord.id}
                      </p>
                    </div>
                    {transcriptionRecord.voiceId ? (
                      <div className="rounded-2xl border border-white/60 bg-[rgba(255,255,255,0.55)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Voice ID
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {transcriptionRecord.voiceId}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4 space-y-4">
                  <Textarea
                    disabled={!uploadResponseData}
                    placeholder="The transcription description will appear here after you send audio."
                    value={reviewDraft}
                    onChange={(event) =>
                      handleReviewDraftChange(event.target.value)
                    }
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      disabled={!reviewDraft.trim()}
                      onClick={confirmReviewedResponse}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Confirm transcription
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showWorkflowStepTwo ? (
              <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Step 2
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      Get SOAP notes
                    </h3>
                  </div>
                  {hasSoapContent(soapSections) ? (
                    <Badge className="bg-[rgba(201,108,49,0.12)] text-[var(--accent)]">
                      SOAP ready
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Send the confirmed transcription `id` and `description` to
                  `/get-soaps`. The returned `subjective`, `objective`,
                  `assessment`, and `plan` values are shown in their own fields
                  below.
                </p>
                <div className="mt-4 space-y-4">
                  <Button
                    type="button"
                    disabled={!isResponseConfirmed || isGettingSoaps}
                    onClick={handleGetSoapNotes}
                  >
                    {isGettingSoaps ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Getting SOAP notes
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Get SOAP notes
                      </>
                    )}
                  </Button>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Subjective</Label>
                      <Textarea
                        placeholder="Subjective"
                        value={soapSections.subjective}
                        onChange={(event) =>
                          handleSoapSectionChange(
                            "subjective",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Objective</Label>
                      <Textarea
                        placeholder="Objective"
                        value={soapSections.objective}
                        onChange={(event) =>
                          handleSoapSectionChange(
                            "objective",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assessment</Label>
                      <Textarea
                        placeholder="Assessment"
                        value={soapSections.assessment}
                        onChange={(event) =>
                          handleSoapSectionChange(
                            "assessment",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Textarea
                        placeholder="Plan"
                        value={soapSections.plan}
                        onChange={(event) =>
                          handleSoapSectionChange("plan", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {showWorkflowStepThree ? (
              <div className="rounded-[28px] border border-white/55 bg-white/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Step 3
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      Confirm final result
                    </h3>
                  </div>
                  {confirmationMessage ? (
                    <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
                      Confirmed
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Confirm the edited SOAP note and store it. After confirmation,
                  we only show a simple success message.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={!hasSoapContent(soapSections) || isConfirmingSoap}
                    onClick={handleConfirmSoapNotes}
                  >
                    {isConfirmingSoap ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Confirming SOAP notes
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Confirm final result
                      </>
                    )}
                  </Button>
                </div>
                {confirmationMessage ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(15,118,110,0.18)] bg-[rgba(241,255,252,0.86)] px-4 py-3 text-sm font-medium text-[var(--primary)]">
                    {confirmationMessage}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
