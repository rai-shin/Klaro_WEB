import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not defined.");
}

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not defined."
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    const documentId = Number(id);

    if (Number.isNaN(documentId)) {
      return NextResponse.json(
        {
          message: "Invalid document ID.",
        },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
      },
    });

    if (!document) {
      return NextResponse.json(
        {
          message: "Document not found.",
        },
        { status: 404 }
      );
    }

    if (!document.filePath) {
      return NextResponse.json(
        {
          message: "Document file path is missing.",
        },
        { status: 404 }
      );
    }

    const { data, error } = await supabase.storage
      .from("klaro-documents")
      .createSignedUrl(document.filePath, 60);

    if (error || !data?.signedUrl) {
      console.error(
        "Supabase signed URL error:",
        error
      );

      return NextResponse.json(
        {
          message:
            "Unable to create a secure document URL.",
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error(
      "Document file route error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Failed to open the document.",
      },
      { status: 500 }
    );
  }
}