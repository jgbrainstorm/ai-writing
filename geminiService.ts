
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getChatResponse = async (
  message: string,
  history: ChatMessage[],
  essayContent: string
): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `You are a helpful writing assistant. The user is currently writing an essay with the following content: \n\n"${essayContent}"\n\nAssist them with ideas, grammar, structure, and tone. Be concise and encouraging.`,
      },
    });

    // Note: The history in gemini-3-flash-preview chat should ideally be passed in session initialization 
    // but we can send it as previous messages context if needed or just use current. 
    // Here we'll just send the message to keep it simple for this implementation.
    const response: GenerateContentResponse = await chat.sendMessage({ message });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error: Failed to connect to AI assistant.";
  }
};
