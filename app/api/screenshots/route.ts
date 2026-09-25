import { NextResponse } from "next/server";
import { unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const existingScreenshot = await prisma.screenshot.findUnique({
      where: {
        fileHash,
      },
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

    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(
      process.cwd(),
      "public",
      "uploads",
      filename
    );

    await writeFile(filepath, buffer);

    const screenshot = await prisma.screenshot.create({
      data: {
        imageUrl: `/uploads/${filename}`,
        fileHash,
      },
    });

    return NextResponse.json(screenshot);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to upload screenshot" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const screenshots = await prisma.screenshot.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(screenshots);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch screenshots" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Screenshot ID is required" },
        { status: 400 }
      );
    }

    const screenshot = await prisma.screenshot.findUnique({
      where: {
        id,
      },
    });

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      );
    }

    const filepath = path.join(
      process.cwd(),
      "public",
      screenshot.imageUrl
    );

    try {
      await unlink(filepath);
    } catch (error) {
      console.log("Image file could not be deleted:", error);
    }

    await prisma.screenshot.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    );
  }
}