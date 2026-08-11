import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { sourceLang, targetLang, code } = await request.json();

    if (!code || !sourceLang || !targetLang) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Initialize SDK INSIDE the request handler so process.env is populated
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not defined on the server." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

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
      { error: error.message || "Failed to convert code." },
      { status: 500 }
    );
  }
}
