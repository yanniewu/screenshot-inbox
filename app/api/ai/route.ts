import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const VALID_CATEGORIES = [
    "food",
    "product",
    "shopping",
    "travel",
    "activity",
    "event",
    "article",
    "place",
    "other",
] as const;

const VALID_INTENTS = [
    "try",
    "buy",
    "do",
    "visit",
    "watch",
    "read",
] as const;

export async function POST(request: Request) {
    let screenshotId: string | null = null;

    try {
        const formData = await request.formData();

        const file = formData.get("file") as File | null;
        screenshotId = formData.get("screenshotId") as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "No image uploaded" },
                { status: 400 }
            );
        }

        if (!screenshotId) {
            return NextResponse.json(
                { error: "No screenshot ID provided" },
                { status: 400 }
            );
        }

        await prisma.screenshot.update({
            where: {
                id: screenshotId,
            },
            data: {
                processingStatus: "processing",
            },
        });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString("base64");

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",

            contents: [
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: file.type || "image/jpeg",
                    },
                },
                {

                    text: `
            Analyze this screenshot for a personal screenshot organizer.

            Determine:
            - category: what type of thing this screenshot is about
            - intent: what the person likely wants to do with it
            - title: the main thing the person would want to remember
            - description: a short description of why this screenshot might be useful

            Category must be one of:
            food, product, shopping, travel, activity, event, article, place, other

            Intent must be one of:
            try, buy, do, visit, watch, read
          `,
                },
            ],

            config: {
                responseMimeType: "application/json",

                responseSchema: {
                    type: Type.OBJECT,

                    properties: {
                        category: {
                            type: Type.STRING,
                        },

                        intent: {
                            type: Type.STRING,
                        },

                        title: {
                            type: Type.STRING,
                        },

                        description: {
                            type: Type.STRING,
                        },
                    },

                    required: [
                        "category",
                        "intent",
                        "title",
                        "description",
                    ],
                },
            },
        });

        if (!response.text) {
            throw new Error("Gemini returned an empty response");
        }
        const analysis = JSON.parse(response.text);

        if (!VALID_CATEGORIES.includes(analysis.category)) {
            throw new Error(
                `Invalid category returned by Gemini: ${analysis.category}`
            );
        }

        if (!VALID_INTENTS.includes(analysis.intent)) {
            throw new Error(
                `Invalid intent returned by Gemini: ${analysis.intent}`
            );
        }

        const embeddingResponse = await ai.models.embedContent({
            model: "gemini-embedding-2",
            contents: `
            Title: ${analysis.title}
            Description: ${analysis.description}
            Category: ${analysis.category}
            Intent: ${analysis.intent}
            `,
            config: {
                outputDimensionality: 768,
            },
        });

        const embedding = embeddingResponse.embeddings?.[0]?.values;

        if (!embedding) {
            throw new Error("Gemini returned no embedding");
        }

        const screenshot = await prisma.screenshot.update({
            where: {
                id: screenshotId,
            },
            data: {
                category: analysis.category,
                intent: analysis.intent,
                title: analysis.title,
                description: analysis.description,
                processingStatus: "complete",
            },
        });

        await prisma.$executeRaw`
            UPDATE "Screenshot"
            SET embedding = ${`[${embedding.join(",")}]`}::vector
            WHERE id = ${screenshotId}
            `;

        return NextResponse.json({
            screenshot,
            analysis,
        });
    } catch (error) {
        console.error("Gemini error:", error);

        if (screenshotId) {
            try {
                await prisma.screenshot.update({
                    where: {
                        id: screenshotId,
                    },
                    data: {
                        processingStatus: "failed",
                    },
                });
            } catch (statusError) {
                console.error(
                    "Failed to update processing status:",
                    statusError
                );
            }
        }

        return NextResponse.json(
            { error: "Failed to analyze image" },
            { status: 500 }
        );
    }
}
