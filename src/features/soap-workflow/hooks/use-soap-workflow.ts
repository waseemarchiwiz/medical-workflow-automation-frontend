import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  DEFAULT_STATUS_MESSAGE,
  EMPTY_SOAP_SECTIONS,
  RESPONSE_TEXT_KEYS,
} from "@/features/soap-workflow/constants";
import { isAudioFile } from "@/features/soap-workflow/lib/audio";
import {
  buildFallbackSoapSections,
  extractPreferredText,
  getParsedSoapSections,
  getTranscriptionRecord,
  hasSoapContent,
  serializeSoapSections,
} from "@/features/soap-workflow/lib/soap-transformers";
import {
  confirmSoapWorkflow,
  requestSoapNotes,
  uploadVoiceNote,
} from "@/features/soap-workflow/services/soap-workflow.services";
import type {
  SoapSections,
  StatusTone,
  SubmissionPhase,
  TranscriptionRecord,
  VoiceSource,
} from "@/features/soap-workflow/types";
import { appConfig } from "@/shared/config/app.config";

function useSoapWorkflow() {
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [voiceSource, setVoiceSource] = useState<VoiceSource | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] =
    useState<SubmissionPhase>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState(DEFAULT_STATUS_MESSAGE);
  const [recorderError, setRecorderError] = useState("");
  const [hasUploadResponse, setHasUploadResponse] = useState(false);
  const [transcriptionRecord, setTranscriptionRecord] =
    useState<TranscriptionRecord | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const [isResponseConfirmed, setIsResponseConfirmed] = useState(false);
  const [isGettingSoaps, setIsGettingSoaps] = useState(false);
  const [soapSections, setSoapSections] =
    useState<SoapSections>(EMPTY_SOAP_SECTIONS);
  const [soapNotesErrorMessage, setSoapNotesErrorMessage] = useState("");
  const [isConfirmingSoap, setIsConfirmingSoap] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const hasGeneratedSoapSections = hasSoapContent(soapSections);
  const showWorkflowStepOne = hasUploadResponse;
  const showWorkflowStepTwo = showWorkflowStepOne && isResponseConfirmed;
  const showWorkflowStepThree =
    showWorkflowStepTwo &&
    (hasGeneratedSoapSections ||
      isConfirmingSoap ||
      Boolean(confirmationMessage));

  useEffect(() => {
    document.title = appConfig.title;
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
      resetRecordingResources();
    };
  }, []);

  function resetWorkflowState() {
    setHasUploadResponse(false);
    setTranscriptionRecord(null);
    setReviewDraft("");
    setIsResponseConfirmed(false);
    setSubmissionPhase("idle");
    setSoapSections(EMPTY_SOAP_SECTIONS);
    setSoapNotesErrorMessage("");
    setConfirmationMessage("");
  }

  function resetRecordingResources() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recordedChunksRef.current = [];

    mediaRecorderRef.current?.stream
      .getTracks()
      .forEach((track) => track.stop());
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

    if (file.size > appConfig.maxAudioSizeBytes) {
      setStatusTone("error");
      setStatusMessage(
        "Audio files larger than 50 MB are not supported in this screen.",
      );
      return;
    }

    resetWorkflowState();
    setSelectedAudio(file);
    setVoiceSource(source);
    setDragActive(false);
    setUploadProgress(0);
    setSubmissionPhase("idle");
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
    setSoapNotesErrorMessage("");
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
    setSoapNotesErrorMessage("");
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
      setSubmissionPhase("idle");
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
    setDragActive(false);
    setUploadProgress(0);
    setSubmissionPhase("idle");
    setRecorderError("");
    resetWorkflowState();
    setStatusTone("idle");
    setStatusMessage(DEFAULT_STATUS_MESSAGE);

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
    setSubmissionPhase("uploading");
    setStatusTone("idle");
    setStatusMessage("Uploading audio to the API...");

    try {
      const response = await uploadVoiceNote(selectedAudio, (progressEvent) => {
        const totalBytes = progressEvent.total ?? selectedAudio.size;

        if (!totalBytes) {
          return;
        }

        const nextProgress = Math.min(
          100,
          Math.round((progressEvent.loaded / totalBytes) * 100),
        );

        setUploadProgress(nextProgress);

        if (nextProgress >= 100) {
          setSubmissionPhase("processing");
          setStatusMessage(
            "Upload complete. Waiting for the API to prepare the transcription...",
          );
          return;
        }

        setSubmissionPhase("uploading");
        setStatusMessage(`Uploading audio to the API... ${nextProgress}%`);
      });

      const nextTranscriptionRecord = getTranscriptionRecord(response);
      const nextReviewDraft =
        nextTranscriptionRecord?.description ||
        extractPreferredText(response, RESPONSE_TEXT_KEYS) ||
        `Uploaded ${selectedAudio.name}. Review or replace this transcription before requesting SOAP notes.`;

      setHasUploadResponse(true);
      setTranscriptionRecord(nextTranscriptionRecord);
      setReviewDraft(nextReviewDraft);
      setIsResponseConfirmed(false);
      setSoapSections(EMPTY_SOAP_SECTIONS);
      setConfirmationMessage("");
      setSubmissionPhase("idle");
      setStatusTone("success");
      setStatusMessage(
        nextTranscriptionRecord
          ? `Upload complete. Transcription #${nextTranscriptionRecord.id} is ready for review.`
          : "Upload complete. Review the returned transcription before requesting SOAP notes.",
      );
      setUploadProgress(100);
    } catch (error) {
      setSubmissionPhase("idle");
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
    setSoapNotesErrorMessage("");
    setStatusTone("success");
    setStatusMessage(
      `Transcription confirmed. You can now request SOAP notes from ${appConfig.api.getSoapPath}.`,
    );
  }

  async function handleGetSoapNotes() {
    if (!reviewDraft.trim()) {
      setSoapNotesErrorMessage(
        "Confirm the transcription before requesting SOAP notes.",
      );
      setStatusTone("error");
      setStatusMessage(
        "Confirm the transcription before requesting SOAP notes.",
      );
      return;
    }

    if (!isResponseConfirmed) {
      setSoapNotesErrorMessage("Please confirm the transcription first.");
      setStatusTone("error");
      setStatusMessage("Please confirm the transcription first.");
      return;
    }

    if (!transcriptionRecord) {
      setSoapNotesErrorMessage(
        "No transcription record was returned from the upload response.",
      );
      setStatusTone("error");
      setStatusMessage(
        "No transcription record was returned from the upload response.",
      );
      return;
    }

    setIsGettingSoaps(true);
    setSoapNotesErrorMessage("");
    setConfirmationMessage("");
    setStatusTone("idle");
    setStatusMessage(
      `Requesting SOAP notes for transcription #${transcriptionRecord.id}...`,
    );

    try {
      const response = await requestSoapNotes({
        transcriptionId: transcriptionRecord.id,
        description: reviewDraft,
      });

      const nextSoapSections =
        getParsedSoapSections(response) ||
        buildFallbackSoapSections(reviewDraft);

      setSoapSections(nextSoapSections);
      setSoapNotesErrorMessage("");
      setStatusTone("success");
      setStatusMessage(
        "SOAP notes received in subjective, objective, assessment, and plan format.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "SOAP retrieval failed. Please try again.";

      setSoapNotesErrorMessage(errorMessage);
      setStatusTone("error");
      setStatusMessage(errorMessage);
    } finally {
      setIsGettingSoaps(false);
    }
  }

  async function handleConfirmSoapNotes() {
    if (!hasGeneratedSoapSections) {
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
      await confirmSoapWorkflow({
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

  return {
    audioPreviewUrl,
    confirmationMessage,
    dragActive,
    fileInputRef,
    handleConfirmSoapNotes,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
    handleGetSoapNotes,
    handleReviewDraftChange,
    handleSoapSectionChange,
    hasGeneratedSoapSections,
    isConfirmingSoap,
    isGettingSoaps,
    isRecording,
    isResponseConfirmed,
    isSubmitting,
    recorderError,
    recordingSeconds,
    reviewDraft,
    selectedAudio,
    submissionPhase,
    showWorkflowStepOne,
    showWorkflowStepThree,
    showWorkflowStepTwo,
    soapNotesErrorMessage,
    soapSections,
    startRecording,
    statusMessage,
    statusTone,
    stopRecording,
    submitAudio,
    transcriptionRecord,
    uploadProgress,
    voiceSource,
    clearAudio,
    confirmReviewedResponse,
  };
}

export { useSoapWorkflow };
