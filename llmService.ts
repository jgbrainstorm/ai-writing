
import { ChatMessage, AppConfig } from "./types";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful writing assistant. Assist the user with ideas, grammar, and tone for their essay.";
const hasUsableAzureConfig = (config?: AppConfig): boolean =>
  !!(
    config?.azure?.endpoint?.trim() &&
    config?.azure?.apiKey?.trim() &&
    config?.azure?.deploymentName?.trim()
  );

const getAppConfig = (): AppConfig => {
  const saved = localStorage.getItem('app_config');
  if (saved) return JSON.parse(saved);
  return {
    provider: 'azure',
    azure: {
      endpoint: '',
      apiKey: '',
      deploymentName: '',
      apiVersion: '2024-02-01'
    },
    writingPrompt: "Write an essay about the impact of artificial intelligence on modern education.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    timeLimit: 30 * 60
  };
};

export const getChatResponse = async (
  message: string,
  history: ChatMessage[],
  essayContent: string,
  currentConfig?: AppConfig
): Promise<string> => {
  const storedConfig = getAppConfig();
  const preferredConfig = currentConfig || storedConfig;
  const config =
    preferredConfig.provider === 'azure' && !hasUsableAzureConfig(preferredConfig) && hasUsableAzureConfig(storedConfig)
      ? storedConfig
      : preferredConfig;
  const sysPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        essayContent,
        systemPrompt: sysPrompt,
        provider: config.provider,
        azure: config.azure,
      }),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.details || data?.error || `Request failed with ${response.status}`);
    }

    return data?.text || "No response.";
  } catch (err) {
    console.error("Chat API Error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown backend connection error.";
    return `Error: ${message}. Make sure backend is running with "npm run dev:api" (or "npm run dev:full").`;
  }
};
