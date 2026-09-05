export interface ModelOption {
  id: string
  label: string
  contextWindow: string // e.g. "200K tokens"
  speed: 'fast' | 'balanced' | 'deep'
  costTier: 'low' | 'medium' | 'high'
}

export interface Provider {
  id: string
  name: string
  logo?: string // Lucide icon or brand initial
  kind: 'hosted' | 'local'
  models: ModelOption[]
}

export const PROVIDERS: Provider[] = [
  {
    id: 'groq',
    name: 'Groq',
    kind: 'hosted',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', contextWindow: '131K', speed: 'fast', costTier: 'low' },
      { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', contextWindow: '131K', speed: 'fast', costTier: 'low' },
      { id: 'groq/compound', label: 'Groq Compound (Agentic)', contextWindow: '131K', speed: 'fast', costTier: 'low' },
      { id: 'groq/compound-mini', label: 'Groq Compound Mini', contextWindow: '131K', speed: 'fast', costTier: 'low' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', contextWindow: '131K', speed: 'fast', costTier: 'low' },
      { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', contextWindow: '131K', speed: 'fast', costTier: 'low' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'hosted',
    models: [
      { id: 'gpt-5', label: 'GPT-5', contextWindow: '400K', speed: 'deep', costTier: 'high' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini', contextWindow: '400K', speed: 'fast', costTier: 'low' },
      { id: 'gpt-4o', label: 'GPT-4o', contextWindow: '128K', speed: 'balanced', costTier: 'medium' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'hosted',
    models: [
      { id: 'claude-opus', label: 'Claude Opus', contextWindow: '200K', speed: 'deep', costTier: 'high' },
      { id: 'claude-sonnet', label: 'Claude Sonnet', contextWindow: '200K', speed: 'balanced', costTier: 'medium' },
      { id: 'claude-haiku', label: 'Claude Haiku', contextWindow: '200K', speed: 'fast', costTier: 'low' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    kind: 'hosted',
    models: [
      { id: 'gemini-pro', label: 'Gemini 1.5 Pro', contextWindow: '1M', speed: 'deep', costTier: 'high' },
      { id: 'gemini-flash', label: 'Gemini 1.5 Flash', contextWindow: '1M', speed: 'fast', costTier: 'low' },
    ],
  },
  {
    id: 'alibaba',
    name: 'Qwen',
    kind: 'hosted',
    models: [
      { id: 'qwen-72b', label: 'Qwen 2.5 72B', contextWindow: '128K', speed: 'balanced', costTier: 'medium' },
      { id: 'qwen-coder', label: 'Qwen 2.5 Coder', contextWindow: '128K', speed: 'fast', costTier: 'low' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'hosted',
    models: [
      { id: 'deepseek-v3', label: 'DeepSeek V3', contextWindow: '128K', speed: 'balanced', costTier: 'low' },
      { id: 'deepseek-r1', label: 'DeepSeek R1 (Reasoning)', contextWindow: '128K', speed: 'deep', costTier: 'medium' },
    ],
  },
  {
    id: 'ollama',
    name: 'Local (Ollama)',
    kind: 'local',
    models: [],
  },
]
