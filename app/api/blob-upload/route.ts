
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getUser(request);
        if (!user) throw new Error("Unauthorized");

        // Uploads must go into the signed-in user's own folder.
        if (!pathname.startsWith(`screenshots/${user.id}/`)) {
          throw new Error("Invalid upload path.");
        }
        
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
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json(
      { error: unauthorized ? "Sign in required." : "Could not authorize image upload." },
      { status: unauthorized ? 401 : 400 }
    );
  }
}
