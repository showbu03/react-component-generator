export type Provider = 'anthropic' | 'google';

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
}

export interface StreamingComponent {
  id: string;
  prompt: string;
  rawChunks: string;
}
