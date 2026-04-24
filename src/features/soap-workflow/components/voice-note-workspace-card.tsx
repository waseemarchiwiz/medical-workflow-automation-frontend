import type { ChangeEventHandler, DragEventHandler, RefObject } from 'react'
import {
  AudioLines,
  AudioWaveform,
  CloudUpload,
  LoaderCircle,
  Mic,
  Send,
  Trash2,
} from 'lucide-react'

import { formatFileSize, formatTime } from '@/features/soap-workflow/lib/audio'
import type { StatusTone, SubmissionPhase, VoiceSource } from '@/features/soap-workflow/types'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { appConfig } from '@/shared/config/app.config'

interface VoiceNoteWorkspaceCardProps {
  audioPreviewUrl: string
  dragActive: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  hasUploadResponse: boolean
  isRecording: boolean
  isSubmitting: boolean
  onClearAudio: () => void
  onDragEnter: DragEventHandler<HTMLDivElement>
  onDragLeave: DragEventHandler<HTMLDivElement>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
  onFileChange: ChangeEventHandler<HTMLInputElement>
  onStartRecording: () => void
  onStopRecording: () => void
  onSubmitAudio: () => void
  recorderError: string
  recordingSeconds: number
  selectedAudio: File | null
  statusMessage: string
  statusTone: StatusTone
  submissionPhase: SubmissionPhase
  uploadProgress: number
  voiceSource: VoiceSource | null
}

function VoiceNoteWorkspaceCard({
  audioPreviewUrl,
  dragActive,
  fileInputRef,
  hasUploadResponse,
  isRecording,
  isSubmitting,
  onClearAudio,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
  onStartRecording,
  onStopRecording,
  onSubmitAudio,
  recorderError,
  recordingSeconds,
  selectedAudio,
  statusMessage,
  statusTone,
  submissionPhase,
  uploadProgress,
  voiceSource,
}: VoiceNoteWorkspaceCardProps) {
  const showSelectedClip = Boolean(selectedAudio)
  const showProgressRail = submissionPhase !== 'idle' || uploadProgress > 0 || hasUploadResponse
  const progressValue = submissionPhase === 'processing' || hasUploadResponse ? 100 : uploadProgress
  const progressBadgeLabel = hasUploadResponse
    ? 'Ready to review'
    : statusTone === 'error' && uploadProgress >= 100
      ? 'Upload finished, API error'
      : statusTone === 'error' && uploadProgress > 0
        ? 'Upload interrupted'
    : submissionPhase === 'processing'
      ? 'API processing'
      : submissionPhase === 'uploading'
        ? `${uploadProgress}% uploaded`
        : uploadProgress > 0
          ? `${uploadProgress}% uploaded`
          : null
  const statusClassName =
    statusTone === 'error'
      ? 'border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.9)] text-[var(--danger)]'
      : statusTone === 'success'
        ? 'border-[rgba(15,118,110,0.18)] bg-[rgba(241,255,252,0.9)] text-[var(--primary)]'
        : 'border-white/55 bg-white/55 text-[var(--muted)]'

  return (
    <Card className="border-white/50 bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle
              className="text-2xl tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Voice note
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Add one clip, send it to the API, then continue with the transcription review below.
              The intake stays focused so users only see the controls they need right now.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[rgba(201,108,49,0.12)] text-[var(--accent)]">Voice intake</Badge>
            {hasUploadResponse ? (
              <Badge className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
                Transcription ready
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <input
          ref={fileInputRef}
          accept={appConfig.audioAccept}
          className="hidden"
          id="voice-upload"
          type="file"
          onChange={onFileChange}
        />

        {selectedAudio ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-[28px] border border-white/60 bg-white/60 p-5 shadow-[0_16px_32px_rgba(69,45,27,0.08)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-[rgba(15,118,110,0.12)] text-[var(--primary)]">
                      {voiceSource === 'record' ? 'Recorded in browser' : 'Uploaded file'}
                    </Badge>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Active clip
                    </p>
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">{selectedAudio.name}</h3>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    {formatFileSize(selectedAudio.size)}. Keep this clip if it is correct, or replace it
                    before sending.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/70 bg-white/55"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <AudioLines className="mr-2 h-4 w-4" />
                    Replace clip
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={onClearAudio}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>

              {audioPreviewUrl ? (
                <audio
                  controls
                  className="mt-5 w-full rounded-2xl border border-white/60 bg-white/75 p-2"
                  src={audioPreviewUrl}
                />
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/55 bg-white/45 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Next action
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {hasUploadResponse
                  ? 'Your clip is already with the API. Continue in the workflow section below.'
                  : 'Send this clip once. After the API returns the transcription, the review step opens automatically.'}
              </p>
              {!hasUploadResponse ? (
                <Button
                  type="button"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!selectedAudio || isSubmitting}
                  onClick={onSubmitAudio}
                >
                  {submissionPhase === 'uploading' ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Uploading audio
                    </>
                  ) : submissionPhase === 'processing' ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Preparing transcription
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send to API
                    </>
                  )}
                </Button>
              ) : (
                <div className="mt-5 rounded-2xl border border-[rgba(15,118,110,0.18)] bg-[rgba(241,255,252,0.86)] px-4 py-3 text-sm font-medium text-[var(--primary)]">
                  Audio sent successfully. Continue with Step 1 below.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div
              className={`rounded-[32px] border-2 border-dashed p-6 transition ${
                dragActive
                  ? 'border-[var(--primary)] bg-[rgba(15,118,110,0.1)]'
                  : 'border-[rgba(36,28,23,0.12)] bg-white/45'
              }`}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <div className="inline-flex rounded-full bg-[rgba(15,118,110,0.12)] p-4 text-[var(--primary)]">
                    <CloudUpload className="h-6 w-6" />
                  </div>
                  <h3
                    className="mt-5 text-2xl tracking-[-0.03em] text-[var(--foreground)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Upload an existing recording
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                    Drag and drop an audio file or browse from your device. Supported formats:
                    WAV, MP3, M4A, AAC, WebM, and OGG up to 50 MB.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" size="lg" onClick={() => fileInputRef.current?.click()}>
                    <AudioLines className="mr-2 h-4 w-4" />
                    Browse audio
                  </Button>
                  <p className="self-center text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    Drop file anywhere in this panel
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/55 bg-white/45 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    Or record live
                  </p>
                  <h3
                    className="mt-3 text-2xl tracking-[-0.03em] text-[var(--foreground)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {isRecording ? formatTime(recordingSeconds) : 'Ready to record'}
                  </h3>
                </div>
                <Badge
                  variant={isRecording ? 'default' : 'secondary'}
                  className={
                    isRecording
                      ? 'bg-[var(--danger)] text-[var(--danger-foreground)]'
                      : 'bg-[rgba(15,118,110,0.12)] text-[var(--primary)]'
                  }
                >
                  {isRecording ? 'Recording' : 'Standby'}
                </Badge>
              </div>

              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                Start speaking when you are ready. When you stop, the new recording becomes the
                selected clip automatically.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button type="button" size="lg" disabled={isRecording} onClick={onStartRecording}>
                  <Mic className="mr-2 h-4 w-4" />
                  Start recording
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="border-white/70 bg-white/55"
                  disabled={!isRecording}
                  onClick={onStopRecording}
                >
                  Stop recording
                </Button>
              </div>

              {recorderError ? (
                <div className="mt-5 rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[rgba(255,245,243,0.86)] px-4 py-3 text-sm text-[var(--danger)]">
                  {recorderError}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className={`rounded-[24px] border px-4 py-4 ${statusClassName}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                Status
              </p>
              <p className="mt-2 text-sm leading-6">{statusMessage}</p>
            </div>
            {progressBadgeLabel ? (
              <Badge variant="outline" className="border-current/20 bg-white/50 text-current">
                {progressBadgeLabel}
              </Badge>
            ) : null}
          </div>

          {showProgressRail ? (
            <div className="mt-4 space-y-3">
              <Progress value={progressValue} />
              {submissionPhase === 'processing' ? (
                <div className="flex items-center gap-2 text-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>File upload is complete. Waiting for the API response now.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!showSelectedClip ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/55 bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
              <AudioWaveform className="h-5 w-5 text-[var(--muted-foreground)]" />
              <span>Choose a file or make a recording to unlock the next action.</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default VoiceNoteWorkspaceCard
