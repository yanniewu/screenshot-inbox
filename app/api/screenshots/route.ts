
import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let uploadedBlobUrl: string | undefined;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Please upload a non-empty file." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 400 }
      );
    }

    // Limit uploads to 10 MB.
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be 10 MB or smaller." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256")
      .update(buffer)
      .digest("hex");

    const existingScreenshot = await prisma.screenshot.findUnique({
      where: { fileHash },
    });

    if (existingScreenshot) {
      return NextResponse.json(
        {
          error: "This screenshot already exists.",
          duplicate: true,
          screenshot: existingScreenshot,
        },
        { status: 409 }
      );
    }

    const safeFilename = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100) || "screenshot";

    const blob = await put(
      `screenshots/${crypto.randomUUID()}-${safeFilename}`,
      buffer,
      {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
      }
    );

    uploadedBlobUrl = blob.url;

    const screenshot = await prisma.screenshot.create({
      data: {
        imageUrl: blob.url,
        fileHash,
      },
    });

    return NextResponse.json(screenshot);
  } catch (error) {
    console.error("Screenshot upload failed:", error);

    // Avoid leaving an orphaned Blob if the database write fails.
    if (uploadedBlobUrl) {
      try {
        await del(uploadedBlobUrl);
      } catch (cleanupError) {
        console.error("Blob cleanup failed:", cleanupError);
      }
    }

    return NextResponse.json(
      { error: "Failed to upload screenshot." },
      { status: 500 }
    );
  }
}

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
