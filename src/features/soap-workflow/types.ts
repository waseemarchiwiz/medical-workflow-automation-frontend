export type VoiceSource = 'upload' | 'record'
export type StatusTone = 'idle' | 'success' | 'error'
export type SubmissionPhase = 'idle' | 'uploading' | 'processing'
export type RecordIdentifier = number | string

export interface TranscriptionRecord {
  id: RecordIdentifier
  description: string
  voiceId?: RecordIdentifier
}

export interface SoapSections {
  subjective: string
  objective: string
  assessment: string
  plan: string
}
