import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

export const generateAIResponse = async (
  history: Message[],
  context: string
): Promise<string> => {
  try {
    // Safely access process.env.API_KEY avoiding crash if process is undefined
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
    
    if (!apiKey) {
      console.warn("API Key is missing for Gemini");
      return "System: API Key is missing. Please configure it to use AI features.";
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format history for the prompt
    const conversation = history.map(m => `${m.senderName}: ${m.text}`).join('\n');
    
    const prompt = `
      You are a helpful, cute, and professional AI Chatbot named "AI Bot".
      You are managing a chat room called "${context}".
      
      Here is the recent conversation history:
      ${conversation}

      Please provide a helpful, polite, and concise response to the last user message as the administrator of this room.
      Keep the tone friendly and slightly cute (using emojis is okay).
      Do not include "AI Bot:" in your response, just the message content.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "I'm sorry, I couldn't think of a response right now. 🤖";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating AI response.";
  }
};