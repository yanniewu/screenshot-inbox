import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";


export async function GET() {
  try {
    const screenshots = await prisma.screenshot.findMany({
      orderBy: { createdAt: "desc" },
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
    const body = await request.json();
    const id = body?.id;

    if (typeof id !== "string" || !id) {
      return NextResponse.json(
        { error: "Screenshot ID is required." },
        { status: 400 }
      );
    }

    const screenshot = await prisma.screenshot.findUnique({
      where: { id },
    });

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found." },
        { status: 404 }
      );
    }

    // Remove the database record and the persistent Blob.
    // Legacy local /uploads URLs are not Vercel Blob URLs.
    await prisma.screenshot.delete({
      where: { id },
    });

    if (screenshot.imageUrl.startsWith("https://")) {
      try {
        await del(screenshot.imageUrl);
      } catch (blobError) {
        console.error("Blob deletion failed:", blobError);

        return NextResponse.json(
          {
            success: true,
            warning:
              "Screenshot record was deleted, but its stored image could not be removed.",
          }
        );
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