import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { sourceLang, targetLang, code } = await request.json();

    if (!code || !sourceLang || !targetLang) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing. Please check Cloudflare environment variables." },
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

    const textOutput = response.text;
    if (!textOutput) {
      return NextResponse.json({ error: "No response text received from Gemini API." }, { status: 500 });
    }

    const parsedResult = JSON.parse(textOutput);
    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error("Migration Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during conversion." },
      { status: 500 }
    );
  }
}
