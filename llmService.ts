
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, AppConfig } from "./types";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful writing assistant. Assist the user with ideas, grammar, and tone for their essay.";

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
  essayContent: string
): Promise<string> => {
  const config = getAppConfig();
  const sysPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (config.provider === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `${sysPrompt}\n\nCurrent essay context: "${essayContent}"`,
        },
      });
      const response: GenerateContentResponse = await chat.sendMessage({ message });
      return response.text || "No response.";
    } catch (err) {
      console.error("Gemini Error:", err);
      return "Error connecting to Gemini.";
    }
  } else if (config.provider === 'azure' && config.azure) {
    try {
      const { endpoint, apiKey, deploymentName, apiVersion } = config.azure;
      const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `${sysPrompt}\n\nCurrent essay context: ${essayContent}` },
            ...history.map(m => ({ 
                role: m.role === 'model' ? 'assistant' : 'user', 
                content: m.parts[0].text 
            })),
            { role: 'user', content: message }
          ],
          max_tokens: 800,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error(`Azure error: ${response.statusText}`);
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error("Azure OpenAI Error:", err);
      return "Error connecting to Azure OpenAI.";
    }
  }

  return "LLM Provider not configured properly.";
};
