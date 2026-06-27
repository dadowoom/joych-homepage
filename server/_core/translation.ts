import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { invokeLLM, type MessageContent } from "./llm";

type SupportedTranslationLocale = "ja";

function extractText(content: string | MessageContent | MessageContent[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => extractText(part)).join("\n");
  }
  if (content.type === "text") return content.text;
  return "";
}

function parseJsonFromModel(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed) as unknown;
}

export async function translateJsonContentToLocale({
  content,
  targetLocale,
}: {
  content: unknown;
  targetLocale: SupportedTranslationLocale;
}) {
  if (targetLocale !== "ja") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "지원하지 않는 번역 언어입니다." });
  }

  try {
    const result = await invokeLLM({
      model: ENV.translationModel,
      maxTokens: 16000,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a professional Korean-to-Japanese church website translator.",
            "Translate only user-facing Korean text values into natural, warm, respectful Japanese.",
            "Preserve the exact JSON structure, keys, arrays, numbers, booleans, URLs, image paths, icon names, phone numbers, and church names unless a natural Japanese rendering is required.",
            "Do not add commentary. Return valid JSON only.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLocale,
            glossary: {
              "기쁨의교회": "喜びの教会",
              "조이풀TV": "ジョイフルTV",
              "새가족": "新来者",
              "순": "スン",
              "생선": "センソン",
            },
            content,
          }),
        },
      ],
    });

    const translated = parseJsonFromModel(extractText(result.choices[0]?.message.content ?? ""));
    if (
      translated &&
      typeof translated === "object" &&
      "content" in translated &&
      (translated as { content?: unknown }).content
    ) {
      return (translated as { content: unknown }).content;
    }
    return translated;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "AI 번역 초안 생성에 실패했습니다.",
    });
  }
}
