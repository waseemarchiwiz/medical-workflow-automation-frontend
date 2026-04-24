import type { SoapSections } from '@/features/soap-workflow/types'

export const RESPONSE_TEXT_KEYS = ['transcript', 'text', 'content', 'draft', 'message', 'summary']

export const EMPTY_SOAP_SECTIONS: SoapSections = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
}

export const DEFAULT_STATUS_MESSAGE =
  'Choose a voice note or record one live, then send it to begin the SOAP workflow.'
