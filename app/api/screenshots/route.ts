import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { getUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 60, 200);
    const cursor = searchParams.get("cursor");

    const screenshots = await prisma.screenshot.findMany({
      where: { userId: user.id },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        imageUrl: true,
        createdAt: true,
        category: true,
        intent: true,
        title: true,
        description: true,
        processingStatus: true,
      },
    });

    return NextResponse.json(screenshots);
  } catch (error) {
    console.error("Fetching screenshots failed:", error);

    return NextResponse.json(
      { error: "Failed to fetch screenshots." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const id = body?.id;

    if (typeof id !== "string" || !id) {
      return NextResponse.json(
        { error: "Screenshot ID is required." },
        { status: 400 }
      );
    }

    // Only find screenshots that belong to the signed-in user.
    const screenshot = await prisma.screenshot.findFirst({
      where: { id, userId: user.id },
    });

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found." },
        { status: 404 }
      );
    }

    // Remove the database record and the persistent Blob.
    // Legacy local /uploads URLs are not Vercel Blob URLs.
    await prisma.screenshot.deleteMany({
      where: { id, userId: user.id },
    });

    if (screenshot.imageUrl.startsWith("https://")) {
      try {
        await del(screenshot.imageUrl);
      } catch (blobError) {
        console.error("Blob deletion failed:", blobError);

        return NextResponse.json({
          success: true,
          warning:
            "Screenshot record was deleted, but its stored image could not be removed.",
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Screenshot deletion failed:", error);

    return NextResponse.json(
      { error: "Failed to delete screenshot." },
      { status: 500 }
    );
  }
}