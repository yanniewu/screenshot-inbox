import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request: Request) {
    try {
        const { query } = await request.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Search query is required" },
                { status: 400 }
            );
        }

        // Turn the user's search query into the same kind of
        // 768-dimensional vector we stored for screenshots.
        const embeddingResponse = await ai.models.embedContent({
            model: "gemini-embedding-2",
            contents: query,
            config: {
                outputDimensionality: 768,
            },
        });

        const queryEmbedding =
            embeddingResponse.embeddings?.[0]?.values;

        if (!queryEmbedding) {
            throw new Error("Gemini returned no query embedding");
        }

        const vectorString = `[${queryEmbedding.join(",")}]`;

        const results = await prisma.$queryRaw`
      SELECT
        id,
        "imageUrl",
        "createdAt",
        category,
        intent,
        title,
        description,
        1 - (embedding <=> ${vectorString}::vector) AS similarity
        FROM "Screenshot"
        WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorString}::vector) >= 0.5
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT 20
    `;

        return NextResponse.json(results);
    } catch (error) {
        console.error("Semantic search error:", error);

        return NextResponse.json(
            { error: "Failed to perform semantic search" },
            { status: 500 }
        );
    }
}