import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Initialize official Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request) {
  try {
    const { sourceLang, targetLang, code } = await request.json();

    if (!code || !sourceLang || !targetLang) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const systemPrompt = `You are an expert compiler and code migration software. 
Convert the provided code snippet from ${sourceLang} to ${targetLang}.
Return strictly a valid JSON object matching this schema without markdown fences:
{
  "convertedCode": "The converted code here",
  "explanation": ["Key change 1", "Key change 2", "Caveat or optimization note"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nCode to convert:\n${code}` }] }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Migration Error:", error);
    return NextResponse.json(
      { error: "Failed to convert code. Check API key or query." },
      { status: 500 }
    );
  }
}
