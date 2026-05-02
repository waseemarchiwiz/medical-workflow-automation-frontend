import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AudioWaveform,
  CheckCircle2,
  Clock3,
  FileAudio,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";

import { EMPTY_SOAP_SECTIONS } from "@/features/soap-workflow/constants";
import { formatFileSize, formatTime } from "@/features/soap-workflow/lib/audio";
import {
  buildFallbackSoapSections,
  getParsedSoapSections,
  getTranscriptionRecord,
  hasSoapContent,
} from "@/features/soap-workflow/lib/soap-transformers";
import {
  requestSoapNotes,
  uploadVoiceNote,
} from "@/features/soap-workflow/services/soap-workflow.services";
import type {
  DialogueTurn,
  SoapSections,
  TranscriptionRecord,
} from "@/features/soap-workflow/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { appConfig } from "@/shared/config/app.config";
import { cn } from "@/shared/lib/utils";

const MAX_SESSION_SECONDS = 10 * 60;
const SESSION_STORAGE_KEY = "neuroicu:ambient-sessions:v1";
const LIMITED_RESOURCES_NOTE =
  "We are using limited resources for SOAP generation right now. If this fails, retry after a moment or continue from the transcript.";

type AmbientSessionStatus =
  | "uploading"
  | "generating-soap"
  | "complete"
  | "soap-error"
  | "upload-error";

type SessionDetailTab = "soap" | "transcript" | "dialogue";

interface AmbientSession {
  id: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  status: AmbientSessionStatus;
  fileName?: string;
  fileSize?: number;
  uploadUrl?: string;
  downloadUrl?: string;
  transcriptionRecord?: TranscriptionRecord;
  correctedDialogues?: DialogueTurn[];
  rawText?: string;
  soapSections?: SoapSections;
  errorMessage?: string;
  soapErrorMessage?: string;
  limitedResourcesNote?: string;
}

interface UploadMetadata {
  fileName?: string;
  fileSize?: number;
  uploadUrl?: string;
  downloadUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAmbientSession(value: unknown): value is AmbientSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.status === "string" &&
    typeof value.durationSeconds === "number"
  );
}

function readStoredSessions() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedSessions = JSON.parse(
      window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "[]",
    );

    return Array.isArray(storedSessions)
      ? storedSessions.filter(isAmbientSession)
      : [];
  } catch {
    return [];
  }
}

function createSessionId() {
  return `ambient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSessionTitle(date: Date) {
  return `Ambient session ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""
  );
}

function getRecordingExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function getUploadMetadata(response: unknown): UploadMetadata {
  if (!isRecord(response)) {
    return {};
  }

  const payload = isRecord(response.data) ? response.data : response;
  const file = isRecord(payload.file) ? payload.file : undefined;
  const blob = isRecord(payload.blob) ? payload.blob : undefined;

  return {
    ...(typeof file?.originalname === "string"
      ? { fileName: file.originalname }
      : {}),
    ...(typeof file?.size === "number" ? { fileSize: file.size } : {}),
    ...(typeof blob?.url === "string" ? { uploadUrl: blob.url } : {}),
    ...(typeof blob?.downloadUrl === "string"
      ? { downloadUrl: blob.downloadUrl }
      : {}),
  };
}

function getStatusLabel(status: AmbientSessionStatus) {
  switch (status) {
    case "uploading":
      return "Uploading";
    case "generating-soap":
      return "Getting SOAP";
    case "complete":
      return "SOAP ready";
    case "soap-error":
      return "SOAP failed";
    case "upload-error":
      return "Upload failed";
  }
}

function getStatusClassName(status: AmbientSessionStatus) {
  if (status === "complete") {
    return "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]";
  }

  if (status === "soap-error" || status === "upload-error") {
    return "bg-[rgba(185,56,47,0.12)] text-[var(--danger)]";
  }

  return "bg-[rgba(201,108,49,0.12)] text-[var(--accent)]";
}

function AmbientRecording() {
  const [sessions, setSessions] =
    useState<AmbientSession[]>(readStoredSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSession, setIsProcessingSession] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recorderError, setRecorderError] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState(
    "Ready for the next ambient session.",
  );
  const [activeSessionTitle, setActiveSessionTitle] = useState("");
  const [retryingSessionId, setRetryingSessionId] = useState<string | null>(
    null,
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const activeSessionRef = useRef<AmbientSession | null>(null);

  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions[0] ??
      null,
    [selectedSessionId, sessions],
  );
  const sessionCountLabel =
    sessions.length === 1 ? "1 session" : `${sessions.length} sessions`;
  const recordingProgress = (recordingSeconds / MAX_SESSION_SECONDS) * 100;

  useEffect(() => {
    document.title = `Ambient Recording | ${appConfig.title}`;
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!selectedSessionId && sessions[0]) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    return () => {
      resetRecordingResources();
    };
  }, []);

  function resetRecordingResources() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    mediaRecorderRef.current?.stream
      .getTracks()
      .forEach((track) => track.stop());
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    recordedChunksRef.current = [];
    recordingStartedAtRef.current = null;
  }

  function upsertSession(nextSession: AmbientSession) {
    setSessions((currentSessions) => [
      nextSession,
      ...currentSessions.filter((session) => session.id !== nextSession.id),
    ]);
    setSelectedSessionId(nextSession.id);
  }

  async function startSession() {
    if (isRecording || isProcessingSession) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecorderError("This browser does not support in-page recording.");
      return;
    }

    try {
      const now = new Date();
      const session: AmbientSession = {
        id: createSessionId(),
        title: formatSessionTitle(now),
        startedAt: now.toISOString(),
        durationSeconds: 0,
        status: "uploading",
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      activeSessionRef.current = session;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      setRecorderError("");
      setWorkflowMessage("Recording ambient session.");
      setActiveSessionTitle(session.title);
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        const failedDurationSeconds = recordingStartedAtRef.current
          ? Math.min(
              MAX_SESSION_SECONDS,
              Math.round((Date.now() - recordingStartedAtRef.current) / 1000),
            )
          : 0;
        const failedSession: AmbientSession = {
          ...session,
          endedAt: new Date().toISOString(),
          durationSeconds: failedDurationSeconds,
          status: "upload-error",
          errorMessage:
            "Recording failed. Please start a fresh session and try again.",
        };

        activeSessionRef.current = null;
        resetRecordingResources();
        setIsRecording(false);
        setIsProcessingSession(false);
        setRecorderError(failedSession.errorMessage ?? "");
        setWorkflowMessage("Recording failed.");
        setActiveSessionTitle("");
        upsertSession(failedSession);
      };

      recorder.onstop = () => {
        void finalizeSession(recorder.mimeType || mimeType || "audio/webm");
      };

      recorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        const startedAt = recordingStartedAtRef.current;

        if (!startedAt) {
          return;
        }

        const nextSeconds = Math.min(
          MAX_SESSION_SECONDS,
          Math.floor((Date.now() - startedAt) / 1000),
        );

        setRecordingSeconds(nextSeconds);

        if (nextSeconds >= MAX_SESSION_SECONDS) {
          stopSession();
        }
      }, 250);
    } catch {
      resetRecordingResources();
      setIsRecording(false);
      setIsProcessingSession(false);
      setRecorderError(
        "Microphone access was blocked. Allow access in the browser and try again.",
      );
      setWorkflowMessage("Microphone access is required.");
      setActiveSessionTitle("");
    }
  }

  function stopSession() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setWorkflowMessage("Ending session and preparing upload.");
    recorder.stop();
  }

  async function finalizeSession(mimeType: string) {
    const activeSession = activeSessionRef.current;
    const startedAt = recordingStartedAtRef.current;
    const endedAt = new Date();
    const durationSeconds = startedAt
      ? Math.max(
          1,
          Math.min(
            MAX_SESSION_SECONDS,
            Math.round((Date.now() - startedAt) / 1000),
          ),
        )
      : recordingSeconds;
    const recordedBlob = new Blob(recordedChunksRef.current, {
      type: mimeType,
    });

    resetRecordingResources();
    setIsRecording(false);
    setRecordingSeconds(durationSeconds);

    if (!activeSession) {
      setActiveSessionTitle("");
      setWorkflowMessage("No active session was found.");
      return;
    }

    if (recordedBlob.size === 0) {
      const emptySession: AmbientSession = {
        ...activeSession,
        endedAt: endedAt.toISOString(),
        durationSeconds,
        status: "upload-error",
        errorMessage: "No audio was captured. Please start another session.",
      };

      setIsProcessingSession(false);
      setActiveSessionTitle("");
      setRecorderError(emptySession.errorMessage ?? "");
      setWorkflowMessage("No audio was captured.");
      upsertSession(emptySession);
      return;
    }

    const extension = getRecordingExtension(mimeType);
    const recordedFile = new File(
      [recordedBlob],
      `ambient-session-${endedAt.toISOString().replace(/[:.]/g, "-")}.${extension}`,
      {
        type: mimeType,
        lastModified: Date.now(),
      },
    );
    const uploadingSession: AmbientSession = {
      ...activeSession,
      endedAt: endedAt.toISOString(),
      durationSeconds,
      status: "uploading",
      fileName: recordedFile.name,
      fileSize: recordedFile.size,
    };

    setIsProcessingSession(true);
    setActiveSessionTitle(uploadingSession.title);
    setWorkflowMessage("Uploading voice note.");
    upsertSession(uploadingSession);

    try {
      const uploadResponse = await uploadVoiceNote(recordedFile);
      const uploadMetadata = getUploadMetadata(uploadResponse);
      const transcriptionRecord = getTranscriptionRecord(uploadResponse);

      if (!transcriptionRecord) {
        throw new Error(
          "Upload completed, but no transcription record was returned.",
        );
      }

      const correctedDialogues = transcriptionRecord.correctedDialogues ?? [];
      const transcribedSession: AmbientSession = {
        ...uploadingSession,
        ...uploadMetadata,
        status: "generating-soap",
        transcriptionRecord,
        correctedDialogues,
        rawText: transcriptionRecord.rawText || transcriptionRecord.description,
      };

      setWorkflowMessage("Getting SOAP notes.");
      upsertSession(transcribedSession);

      if (correctedDialogues.length === 0) {
        const failedSoapSession: AmbientSession = {
          ...transcribedSession,
          status: "soap-error",
          soapSections: EMPTY_SOAP_SECTIONS,
          soapErrorMessage:
            "The transcription response did not include corrected dialogues.",
          limitedResourcesNote: LIMITED_RESOURCES_NOTE,
        };

        setWorkflowMessage("SOAP generation failed.");
        upsertSession(failedSoapSession);
        return;
      }

      try {
        const soapResponse = await requestSoapNotes({
          transcriptionId: transcriptionRecord.id,
          correctedDialogues,
        });
        const soapSections =
          getParsedSoapSections(soapResponse) ||
          buildFallbackSoapSections(transcriptionRecord.description);
        const completeSession: AmbientSession = {
          ...transcribedSession,
          status: "complete",
          soapSections,
          soapErrorMessage: "",
          limitedResourcesNote: "",
        };

        setWorkflowMessage("SOAP notes are ready.");
        upsertSession(completeSession);
      } catch (error) {
        const soapErrorMessage =
          error instanceof Error
            ? error.message
            : "SOAP generation failed. Please try again.";
        const failedSoapSession: AmbientSession = {
          ...transcribedSession,
          status: "soap-error",
          soapSections: EMPTY_SOAP_SECTIONS,
          soapErrorMessage,
          limitedResourcesNote: LIMITED_RESOURCES_NOTE,
        };

        setWorkflowMessage("SOAP generation failed.");
        upsertSession(failedSoapSession);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Upload failed. Please try another session.";
      const failedUploadSession: AmbientSession = {
        ...uploadingSession,
        status: "upload-error",
        errorMessage,
      };

      setWorkflowMessage("Upload failed.");
      upsertSession(failedUploadSession);
    } finally {
      activeSessionRef.current = null;
      setIsProcessingSession(false);
      setActiveSessionTitle("");
    }
  }

  async function retrySoapNotes(session: AmbientSession) {
    const transcriptionRecord = session.transcriptionRecord;
    const correctedDialogues =
      session.correctedDialogues ?? transcriptionRecord?.correctedDialogues ?? [];

    if (!transcriptionRecord || correctedDialogues.length === 0) {
      return;
    }

    setRetryingSessionId(session.id);
    setWorkflowMessage("Retrying SOAP notes.");
    upsertSession({
      ...session,
      status: "generating-soap",
      soapErrorMessage: "",
      limitedResourcesNote: "",
    });

    try {
      const soapResponse = await requestSoapNotes({
        transcriptionId: transcriptionRecord.id,
        correctedDialogues,
      });
      const soapSections =
        getParsedSoapSections(soapResponse) ||
        buildFallbackSoapSections(transcriptionRecord.description);

      upsertSession({
        ...session,
        status: "complete",
        soapSections,
        soapErrorMessage: "",
        limitedResourcesNote: "",
      });
      setWorkflowMessage("SOAP notes are ready.");
    } catch (error) {
      const soapErrorMessage =
        error instanceof Error
          ? error.message
          : "SOAP generation failed. Please try again.";

      upsertSession({
        ...session,
        status: "soap-error",
        soapErrorMessage,
        limitedResourcesNote: LIMITED_RESOURCES_NOTE,
      });
      setWorkflowMessage("SOAP generation failed.");
    } finally {
      setRetryingSessionId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="space-y-3">
        <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
          NeuroICU ambient recording
        </Badge>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Doctor session workspace
            </p>
            <h1
              className="mt-2 text-3xl leading-tight tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ambient recording
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {sessionCountLabel} saved locally
          </p>
        </div>
      </section>

      <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "shrink-0 rounded-full p-4",
                  isRecording
                    ? "bg-[rgba(185,56,47,0.12)] text-[var(--danger)]"
                    : "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]",
                )}
              >
                {isRecording ? (
                  <AudioWaveform className="h-6 w-6" />
                ) : isProcessingSession ? (
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {isRecording
                      ? "Recording"
                      : isProcessingSession
                        ? "Processing"
                        : "Ready"}
                  </p>
                  <Badge className="bg-[rgba(201,108,49,0.12)] text-[var(--accent)]">
                    10 minute limit
                  </Badge>
                </div>
                <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  {formatTime(recordingSeconds)}
                </p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {activeSessionTitle || workflowMessage}
                </p>
              </div>
            </div>

            {isRecording ? (
              <Button
                type="button"
                size="lg"
                className="w-full bg-[var(--danger)] text-[var(--danger-foreground)] shadow-[0_18px_30px_rgba(185,56,47,0.2)] sm:w-auto"
                onClick={stopSession}
              >
                <Square className="mr-2 h-4 w-4" />
                End session
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                disabled={isProcessingSession}
                onClick={startSession}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start session
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Progress value={isRecording ? recordingProgress : 0} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
              <span>{workflowMessage}</span>
              <span>{formatTime(MAX_SESSION_SECONDS)} maximum</span>
            </div>
          </div>

          {recorderError ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.86)] px-4 py-3 text-sm text-[var(--danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{recorderError}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl lg:self-start">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle
                  className="text-xl tracking-[-0.02em] text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Previous sessions
                </CardTitle>
                <CardDescription className="mt-1">
                  {sessions.length > 0
                    ? "Tap a session to review notes."
                    : "Completed sessions will appear here."}
                </CardDescription>
              </div>
              <Badge variant="secondary">{sessionCountLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-3 overflow-auto p-4 pt-0 sm:p-5 sm:pt-0">
            {sessions.length > 0 ? (
              sessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;

                return (
                  <button
                    key={session.id}
                    type="button"
                    className={cn(
                      "w-full rounded-[20px] border bg-white/50 p-4 text-left transition hover:bg-white/75",
                      isSelected
                        ? "border-[rgba(15,118,110,0.34)] shadow-[0_12px_24px_rgba(15,118,110,0.1)]"
                        : "border-white/55",
                    )}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--foreground)]">
                          {session.title}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {formatDateTime(session.startedAt)} -{" "}
                          {formatTime(session.durationSeconds)}
                        </p>
                      </div>
                      <Badge className={getStatusClassName(session.status)}>
                        {getStatusLabel(session.status)}
                      </Badge>
                    </div>
                    {session.transcriptionRecord ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        Transcription ID {session.transcriptionRecord.id}
                      </p>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-white/35 p-5 text-sm leading-6 text-[var(--muted)]">
                No previous ambient sessions yet.
              </div>
            )}
          </CardContent>
        </Card>

        {selectedSession ? (
          <SessionDetails
            isRetrying={retryingSessionId === selectedSession.id}
            onRetrySoapNotes={() => void retrySoapNotes(selectedSession)}
            session={selectedSession}
          />
        ) : (
          <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-white/35 p-5 text-sm leading-6 text-[var(--muted)]">
                Start a session to see the transcription and SOAP note here.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface SessionDetailsProps {
  isRetrying: boolean;
  onRetrySoapNotes: () => void;
  session: AmbientSession;
}

function SessionDetails({
  isRetrying,
  onRetrySoapNotes,
  session,
}: SessionDetailsProps) {
  const [activeTabState, setActiveTabState] = useState<{
    sessionId: string;
    tab: SessionDetailTab;
  }>({
    sessionId: session.id,
    tab: "soap",
  });
  const soapSections = session.soapSections ?? EMPTY_SOAP_SECTIONS;
  const hasSoapSections = hasSoapContent(soapSections);
  const dialogueCount = session.correctedDialogues?.length ?? 0;
  const hasTranscript = Boolean(session.rawText);
  const canRetrySoap = Boolean(
    session.transcriptionRecord && session.correctedDialogues?.length,
  );
  const activeTab =
    activeTabState.sessionId === session.id ? activeTabState.tab : "soap";
  const tabs: Array<{
    id: SessionDetailTab;
    label: string;
    meta?: string;
    disabled?: boolean;
  }> = [
    {
      id: "soap",
      label: "SOAP",
      meta: hasSoapSections ? "Ready" : undefined,
    },
    {
      id: "transcript",
      label: "Transcript",
      disabled: !hasTranscript,
    },
    {
      id: "dialogue",
      label: "Dialogue",
      meta: dialogueCount > 0 ? String(dialogueCount) : undefined,
      disabled: dialogueCount === 0,
    },
  ];

  return (
    <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl lg:self-start">
      <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Session review
            </p>
            <CardTitle
              className="mt-2 truncate text-2xl tracking-[-0.03em] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {session.title}
            </CardTitle>
            <CardDescription className="mt-2">
              {session.endedAt
                ? `Ended ${formatDateTime(session.endedAt)}`
                : "Session is being prepared."}
            </CardDescription>
          </div>
          <Badge className={getStatusClassName(session.status)}>
            {getStatusLabel(session.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailMetric
            icon={<Clock3 className="h-4 w-4" />}
            label="Started"
            value={formatDateTime(session.startedAt)}
          />
          <DetailMetric
            icon={<AudioWaveform className="h-4 w-4" />}
            label="Duration"
            value={formatTime(session.durationSeconds)}
          />
          <DetailMetric
            icon={<FileAudio className="h-4 w-4" />}
            label="File"
            value={
              session.fileSize
                ? formatFileSize(session.fileSize)
                : session.fileName
                  ? "Uploaded"
                  : "Pending"
            }
          />
          <DetailMetric
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Transcription"
            value={
              session.transcriptionRecord
                ? String(session.transcriptionRecord.id)
                : "Pending"
            }
          />
        </div>

        {session.uploadUrl ? (
          <a
            className="inline-flex rounded-full border border-[rgba(15,118,110,0.18)] bg-[rgba(241,255,252,0.86)] px-4 py-2 text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
            href={session.downloadUrl || session.uploadUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open uploaded recording
          </a>
        ) : null}

        {session.errorMessage ? (
          <ErrorNotice message={session.errorMessage} />
        ) : null}

        {session.status === "uploading" || session.status === "generating-soap" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/55 bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>
              {session.status === "uploading"
                ? "Uploading recording and waiting for transcription."
                : "Sending corrected dialogues to SOAP generation."}
            </span>
          </div>
        ) : null}

        <div
          aria-label="Session detail sections"
          className="grid grid-cols-3 gap-1 rounded-2xl border border-white/55 bg-white/45 p-1"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                aria-selected={isActive}
                className={cn(
                  "min-h-10 rounded-xl px-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_10px_20px_rgba(15,118,110,0.16)]"
                    : "text-[var(--muted)] hover:bg-white/70",
                  tab.disabled ? "cursor-not-allowed opacity-50" : "",
                )}
                disabled={tab.disabled}
                role="tab"
                type="button"
                onClick={() =>
                  setActiveTabState({
                    sessionId: session.id,
                    tab: tab.id,
                  })
                }
              >
                <span>{tab.label}</span>
                {tab.meta ? (
                  <span className="ml-1 text-xs opacity-75">{tab.meta}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {activeTab === "soap" ? (
          <div className="space-y-4">
            {session.soapErrorMessage ? (
              <div className="space-y-3">
                <ErrorNotice message={session.soapErrorMessage} />
                {session.limitedResourcesNote ? (
                  <div className="rounded-2xl border border-[rgba(201,108,49,0.22)] bg-[rgba(255,248,238,0.88)] px-4 py-3 text-sm leading-6 text-[var(--accent)]">
                    {session.limitedResourcesNote}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/70 bg-white/55 sm:w-auto"
                  disabled={isRetrying || !canRetrySoap}
                  onClick={onRetrySoapNotes}
                >
                  {isRetrying ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Retrying SOAP notes
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retry SOAP notes
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {hasSoapSections ? (
              <div className="grid gap-3">
                <SoapSection
                  title="Subjective"
                  value={soapSections.subjective}
                />
                <SoapSection title="Objective" value={soapSections.objective} />
                <SoapSection
                  title="Assessment"
                  value={soapSections.assessment}
                />
                <SoapSection title="Plan" value={soapSections.plan} />
              </div>
            ) : (
              <EmptyDetailState text="SOAP notes are not available for this session yet." />
            )}
          </div>
        ) : null}

        {activeTab === "transcript" ? (
          hasTranscript ? (
            <div className="max-h-[460px] overflow-auto rounded-[20px] border border-white/55 bg-white/55 p-4 text-sm leading-6 text-[var(--foreground)]">
              {session.rawText}
            </div>
          ) : (
            <EmptyDetailState text="Transcript is not available for this session." />
          )
        ) : null}

        {activeTab === "dialogue" ? (
          dialogueCount > 0 ? (
            <div className="max-h-[520px] space-y-3 overflow-auto rounded-[20px] border border-white/55 bg-white/45 p-3">
              {session.correctedDialogues?.map((dialogue, index) => (
                <div
                  key={`${dialogue.start ?? index}-${dialogue.speaker}`}
                  className="rounded-2xl border border-white/60 bg-white/65 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        dialogue.speaker.toLowerCase() === "doctor"
                          ? "bg-[rgba(15,118,110,0.12)] text-[var(--primary)]"
                          : "bg-[rgba(201,108,49,0.12)] text-[var(--accent)]"
                      }
                    >
                      {dialogue.speaker}
                    </Badge>
                    {typeof dialogue.confidence === "number" ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        {Math.round(dialogue.confidence * 100)}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                    {dialogue.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyDetailState text="Corrected dialogue is not available for this session." />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

interface DetailMetricProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function DetailMetric({ icon, label, value }: DetailMetricProps) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/50 p-4">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </p>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

interface SoapSectionProps {
  title: string;
  value: string;
}

function SoapSection({ title, value }: SoapSectionProps) {
  return (
    <div className="rounded-[20px] border border-white/55 bg-white/55 p-4">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {title}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
        {value || "-"}
      </p>
    </div>
  );
}

interface EmptyDetailStateProps {
  text: string;
}

function EmptyDetailState({ text }: EmptyDetailStateProps) {
  return (
    <div className="rounded-[20px] border border-dashed border-[var(--border)] bg-white/35 p-5 text-sm leading-6 text-[var(--muted)]">
      {text}
    </div>
  );
}

interface ErrorNoticeProps {
  message: string;
}

function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.86)] px-4 py-3 text-sm text-[var(--danger)]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default AmbientRecording;
