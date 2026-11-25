import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { getUser, unauthorized } from "@/lib/session";

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
    "entertainment",
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
    // Only set once the signed-in user is confirmed to own the screenshot,
    // so the catch block can never mark someone else's screenshot as failed.
    let screenshotId: string | null = null;

    try {
        const formData = await request.formData();

        const file = formData.get("file") as File | null;
        const rawId = formData.get("screenshotId");

        if (!file) {
            return NextResponse.json(
                { error: "No image uploaded" },
                { status: 400 }
            );
        }

        if (typeof rawId !== "string" || !rawId) {
            return NextResponse.json(
                { error: "No screenshot ID provided" },
                { status: 400 }
            );
        }

        const id: string = rawId;

        const user = await getUser(request);
        if (!user) {
            return unauthorized();
        }

        const owned = await prisma.screenshot.findFirst({
            where: { id, userId: user.id },
            select: { id: true },
        });
        if (!owned) {
            return NextResponse.json(
                { error: "Screenshot not found." },
                { status: 404 }
            );
        }

        screenshotId = id;

        await prisma.screenshot.update({
            where: { id },
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
            food, product, shopping, travel, activity, event, article, entertainment, other

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
            where: { id },
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
            WHERE id = ${id}
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