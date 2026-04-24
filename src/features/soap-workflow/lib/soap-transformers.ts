import type { SoapSections, TranscriptionRecord } from '@/features/soap-workflow/types'

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

export function getTranscriptionRecord(value: unknown): TranscriptionRecord | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const response = value as {
    data?: {
      transcription?: {
        record?: Record<string, unknown>
      }
    }
    transcription?: {
      record?: Record<string, unknown>
    }
  }

  const record = response.data?.transcription?.record ?? response.transcription?.record

  if (!record) {
    return null
  }

  const id = record.id
  const description = typeof record.description === 'string' ? record.description.trim() : ''

  if ((typeof id === 'number' || typeof id === 'string') && description) {
    return {
      id,
      description,
      ...(typeof record.voiceId === 'number' || typeof record.voiceId === 'string'
        ? { voiceId: record.voiceId }
        : {}),
    }
  }

  return null
}
