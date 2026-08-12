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
        { error: "GEMINI_API_KEY is not defined on the server." },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert compiler and code migration software. 
Convert the provided code snippet from ${sourceLang} to ${targetLang}.
Return strictly a valid JSON object matching this schema without markdown fences:
{
  "convertedCode": "The converted code here",
  "explanation": ["Key change 1", "Key change 2", "Caveat or optimization note"]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nCode to convert:\n${code}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Google API request failed." },
        { status: apiResponse.status }
      );
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: "No response text received from Gemini." }, { status: 500 });
    }

    const parsedResult = JSON.parse(rawText);
    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error("Migration Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
