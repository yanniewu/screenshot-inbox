
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const filename = pathname.split("/").pop() ?? "";

        if (!/\.(png|jpe?g|webp|gif)$/i.test(filename)) {
          throw new Error("Only supported image files are allowed.");
        }

        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: clientPayload ?? "",
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Blob upload completed:", blob.pathname);
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Blob upload authorization failed:", error);

    return NextResponse.json(
      { error: "Could not authorize image upload." },
      { status: 400 }
    );
  }
}
