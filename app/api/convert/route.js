import { NextResponse } from "next/server";

// Current Gemini 3 models (August 2026). We try these in order if one is blocked.
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const texts = [];

  for (const step of steps) {
    if (step?.type === "model_output" && Array.isArray(step.content)) {
      for (const part of step.content) {
        if (part?.type === "text" && part.text) {
          texts.push(part.text);
        }
      }
    }
  }

  if (texts.length) return texts.join("\n");
  if (data?.outputs?.[0]?.text) return data.outputs[0].text;
  if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  return "";
}

function parseModelJson(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

export async function POST(request) {
  try {
    const { sourceLang, targetLang, code } = await request.json();

    if (!code || !sourceLang || !targetLang) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is missing. Add it in Cloudflare → Workers & Pages → code-migrator → Settings → Variables and secrets."
        },
        { status: 500 }
      );
    }

    const requestBody = {
      store: false,
      system_instruction:
        "You are an expert code and SQL migration engine. Convert the code accurately. Keep behavior the same. Use idiomatic target syntax. Explain only the important differences.",
      input: `Convert this code from ${sourceLang} to ${targetLang}.\n\nCode:\n${code}`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            convertedCode: { type: "string" },
            explanation: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["convertedCode", "explanation"]
        }
      },
      generation_config: {
        thinking_level: "low"
      }
    };

    let lastError = "Gemini did not return a usable conversion.";
    let lastStatus = 500;

    for (const model of MODELS) {
      const apiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({ ...requestBody, model })
        }
      );

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        lastError = data?.error?.message || JSON.stringify(data);
        lastStatus = apiResponse.status;

        if (
          /no longer available|not found|not supported|not available to new users|is not available/i.test(
            lastError
          )
        ) {
          continue;
        }

        return NextResponse.json({ error: lastError }, { status: lastStatus });
      }

      const rawText = extractText(data);
      if (!rawText) {
        lastError = "Gemini returned no text.";
        continue;
      }

      let parsed;
      try {
        parsed = parseModelJson(rawText);
      } catch {
        parsed = {
          convertedCode: rawText,
          explanation: ["Returned as plain text because JSON parsing failed."]
        };
      }

      if (!parsed.convertedCode) {
        lastError = "Gemini JSON was missing convertedCode.";
        continue;
      }

      return NextResponse.json({
        convertedCode: parsed.convertedCode,
        explanation: Array.isArray(parsed.explanation) ? parsed.explanation : []
      });
    }

    return NextResponse.json({ error: lastError }, { status: lastStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
