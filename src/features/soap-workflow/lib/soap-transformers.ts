import type {
  DialogueTurn,
  RecordIdentifier,
  SoapSections,
  TranscriptionRecord,
} from '@/features/soap-workflow/types'

export function extractPreferredText(value: unknown, keys: string[]): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedText = extractPreferredText(item, keys)

      if (nestedText) {
        return nestedText
      }
    }

    return ''
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    for (const key of keys) {
      const candidate = record[key]

      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }

    for (const candidate of Object.values(record)) {
      const nestedText = extractPreferredText(candidate, keys)

      if (nestedText) {
        return nestedText
      }
    }
  }

  return ''
}

export function buildFallbackSoapSections(description: string): SoapSections {
  return {
    subjective: description.trim() || '-',
    objective: '',
    assessment: '',
    plan: '',
  }
}

function readSoapSections(source: unknown): SoapSections | null {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>

  const sections: SoapSections = {
    subjective: typeof record.subjective === 'string' ? record.subjective.trim() : '',
    objective: typeof record.objective === 'string' ? record.objective.trim() : '',
    assessment: typeof record.assessment === 'string' ? record.assessment.trim() : '',
    plan: typeof record.plan === 'string' ? record.plan.trim() : '',
  }

  return Object.values(sections).some((section) => section) ? sections : null
}

function parseSoapSectionsFromJson(value: unknown): SoapSections | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  try {
    return readSoapSections(JSON.parse(value))
  } catch {
    return null
  }
}

export function getParsedSoapSections(value: unknown): SoapSections | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const response = value as {
    data?: {
      parsed?: unknown
      soapNotes?: unknown
      soap?: {
        parsed?: unknown
        record?: {
          description?: unknown
        }
      }
      record?: {
        description?: unknown
      }
    }
    parsed?: unknown
    soapNotes?: unknown
    soap?: {
      parsed?: unknown
      record?: {
        description?: unknown
      }
    }
    record?: {
      description?: unknown
    }
  }

  const soapPayload = response.data ?? response

  return (
    readSoapSections(soapPayload.soap?.parsed) ||
    readSoapSections(soapPayload.soapNotes) ||
    readSoapSections(soapPayload.parsed) ||
    parseSoapSectionsFromJson(soapPayload.soap?.record?.description) ||
    parseSoapSectionsFromJson(soapPayload.record?.description)
  )
}

export function serializeSoapSections(sections: SoapSections) {
  return [
    `Subjective:\n${sections.subjective.trim() || '-'}`,
    `Objective:\n${sections.objective.trim() || '-'}`,
    `Assessment:\n${sections.assessment.trim() || '-'}`,
    `Plan:\n${sections.plan.trim() || '-'}`,
  ].join('\n\n')
}

export function hasSoapContent(sections: SoapSections) {
  return Object.values(sections).some((section) => section.trim())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readIdentifier(value: unknown): RecordIdentifier | undefined {
  if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
    return value
  }

  return undefined
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readDialogueTurn(value: unknown): DialogueTurn | null {
  if (!isRecord(value)) {
    return null
  }

  const text = readString(value.text)

  if (!text) {
    return null
  }

  const speaker = readString(value.speaker) || 'Speaker'
  const dialogue: DialogueTurn = {
    speaker,
    text,
  }

  if (typeof value.confidence === 'number') {
    dialogue.confidence = value.confidence
  }

  if (typeof value.start === 'number') {
    dialogue.start = value.start
  }

  if (typeof value.end === 'number') {
    dialogue.end = value.end
  }

  if (
    Array.isArray(value.sourceUtteranceIndexes) &&
    value.sourceUtteranceIndexes.every((index) => typeof index === 'number')
  ) {
    dialogue.sourceUtteranceIndexes = value.sourceUtteranceIndexes
  }

  return dialogue
}

function readDialogueArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const dialogues = value
    .map(readDialogueTurn)
    .filter((dialogue): dialogue is DialogueTurn => Boolean(dialogue))

  return dialogues.length > 0 ? dialogues : undefined
}

function buildDialogueDescription(dialogues: DialogueTurn[] | undefined) {
  if (!dialogues?.length) {
    return ''
  }

  return dialogues
    .map((dialogue) => `${dialogue.speaker}: ${dialogue.text}`)
    .join('\n')
}

export function getTranscriptionRecord(value: unknown): TranscriptionRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const payload = isRecord(value.data) ? value.data : value
  const transcription = isRecord(payload.transcription)
    ? payload.transcription
    : undefined
  const record = isRecord(transcription?.record) ? transcription.record : undefined

  if (!transcription || !record) {
    return null
  }

  const correctedDialogues =
    readDialogueArray(record.correctedDialogues) ||
    (isRecord(record.verification)
      ? readDialogueArray(record.verification.correctedDialogues)
      : undefined)
  const originalDialogues = readDialogueArray(record.originalDialogues)
  const rawText = readString(record.rawText)
  const description =
    readString(record.description) ||
    rawText ||
    buildDialogueDescription(correctedDialogues)
  const id =
    readIdentifier(transcription.id) ||
    readIdentifier(record.id) ||
    readIdentifier(record.transcriptId)
  const voiceId = readIdentifier(record.voiceId)
  const transcriptId = readIdentifier(record.transcriptId)

  if (id !== undefined && (description || correctedDialogues?.length)) {
    return {
      id,
      description,
      ...(voiceId !== undefined ? { voiceId } : {}),
      ...(transcriptId !== undefined ? { transcriptId } : {}),
      ...(rawText ? { rawText } : {}),
      ...(correctedDialogues ? { correctedDialogues } : {}),
      ...(originalDialogues ? { originalDialogues } : {}),
      ...(isRecord(record.verification) && typeof record.verification.approved === 'boolean'
        ? { approved: record.verification.approved }
        : {}),
      ...(isRecord(record.verification) &&
      typeof record.verification.needsHumanReview === 'boolean'
        ? { needsHumanReview: record.verification.needsHumanReview }
        : {}),
    }
  }

  return null
}
