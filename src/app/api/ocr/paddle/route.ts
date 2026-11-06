
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PADDLEOCR_URL =
  process.env.PADDLEOCR_URL ||
  "http://127.0.0.1:8000/ocr";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "No image file was uploaded.",
        },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG, and WEBP images are supported.",
        },
        { status: 400 }
      );
    }

    const paddleFormData = new FormData();
    paddleFormData.append("file", file);

    const paddleResponse = await fetch(PADDLEOCR_URL, {
      method: "POST",
      body: paddleFormData,
      cache: "no-store",
    });

    const contentType =
      paddleResponse.headers.get("content-type") || "unknown";

    const responseText = await paddleResponse.text();

    let paddleData: Record<string, unknown>;

    try {
      paddleData = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      console.error(
        "[Klaro PaddleOCR] Service returned a non-JSON response:",
        {
          status: paddleResponse.status,
          contentType,
        }
      );

      return NextResponse.json(
        {
          success: false,
          message: "PaddleOCR service returned an invalid response.",
          serviceStatus: paddleResponse.status,
          serviceContentType: contentType,
        },
        { status: 502 }
      );
    }

    if (!paddleResponse.ok) {
      console.error(
        "[Klaro PaddleOCR] Service returned an HTTP error:",
        {
          status: paddleResponse.status,
          contentType,
        }
      );

      const detail =
        typeof paddleData.detail === "string"
          ? paddleData.detail
          : typeof paddleData.message === "string"
            ? paddleData.message
            : "PaddleOCR processing failed.";

      return NextResponse.json(
        {
          success: false,
          message: detail,
        },
        { status: paddleResponse.status }
      );
    }

    return NextResponse.json(paddleData, {
      status: 200,
    });
  } catch (error) {
    console.error(
      "[Klaro PaddleOCR] Processing error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to connect to the PaddleOCR service.",
      },
      { status: 502 }
    );
  }
}
