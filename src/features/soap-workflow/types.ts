export type VoiceSource = 'upload' | 'record'
export type StatusTone = 'idle' | 'success' | 'error'
export type SubmissionPhase = 'idle' | 'uploading' | 'processing'
export type RecordIdentifier = number | string

export interface DialogueTurn {
  speaker: string
  text: string
  confidence?: number
  start?: number
  end?: number
  sourceUtteranceIndexes?: number[]
}

export interface TranscriptionRecord {
  id: RecordIdentifier
  description: string
  voiceId?: RecordIdentifier
  transcriptId?: RecordIdentifier
  rawText?: string
  correctedDialogues?: DialogueTurn[]
  originalDialogues?: DialogueTurn[]
  approved?: boolean
  needsHumanReview?: boolean
}

export interface SoapSections {
  subjective: string
  objective: string
  assessment: string
  plan: string
}
