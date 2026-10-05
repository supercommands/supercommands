export type AutoSubmitKind =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'mistral'
  | 'copilot'
  | 'google'
  | 'calendar';

export interface AutoSubmitImage {
  base64: string;
  mimeType: string;
  filename: string;
}

export interface AutoSubmitRequest {
  kind: AutoSubmitKind;
  prompt: string;
  images?: AutoSubmitImage[];
}
