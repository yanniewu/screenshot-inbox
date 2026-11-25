
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser, unauthorized } from "@/lib/session";

export const runtime = "nodejs";


export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return unauthorized();
    const body = await request.json();
    const imageUrl = body?.imageUrl;
    const fileHash = body?.fileHash;

    if (
      typeof imageUrl !== "string" ||
      typeof fileHash !== "string" ||
      !/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(imageUrl) ||
      !/^[a-f0-9]{64}$/.test(fileHash)
    ) {
      return NextResponse.json(
        { error: "Invalid image URL or file hash." },
        { status: 400 }
      );
    }
    if (!new URL(imageUrl).pathname.startsWith(`/screenshots/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
    }

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

    const screenshot = await prisma.screenshot.create({
      data: {
        imageUrl,
        fileHash,
        userID: user.id,
      },
    });

    return NextResponse.json(screenshot);
  } catch (error) {
    console.error("Screenshot registration failed:", error);

    return NextResponse.json(
      { error: "Failed to register screenshot." },
      { status: 500 }
    );
  }
}
