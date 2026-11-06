
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth-guard";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

const ALLOWED_FILE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function POST(request: Request) {
  const authError = await requireApiSession();

  if (authError) return authError;

  let uploadedStoragePath: string | null = null;

  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const patientIdValue = formData.get("patientId");
    const documentTypeValue = formData.get("documentType");

    // Validate uploaded file.
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "No file was uploaded." },
        { status: 400 }
      );
    }

    // Reject empty files.
    if (file.size <= 0) {
      return NextResponse.json(
        { message: "The uploaded file is empty." },
        { status: 400 }
      );
    }

    // Enforce the 4 MB application upload limit.
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          message: "File size exceeds the 4 MB upload limit.",
        },
        { status: 413 }
      );
    }

    // Validate patient ID.
    if (
      typeof patientIdValue !== "string" ||
      !patientIdValue.trim()
    ) {
      return NextResponse.json(
        { message: "Patient is required." },
        { status: 400 }
      );
    }

    const patientId = Number(patientIdValue);

    if (
      !Number.isSafeInteger(patientId) ||
      patientId <= 0
    ) {
      return NextResponse.json(
        { message: "Invalid patient ID." },
        { status: 400 }
      );
    }

    // Validate extension and MIME type together.
    const extension = path.extname(file.name).toLowerCase();
    const expectedMimeType = ALLOWED_FILE_TYPES[extension];

    if (!expectedMimeType || file.type !== expectedMimeType) {
      return NextResponse.json(
        {
          message:
            "Unsupported file type. Allowed formats: JPG, JPEG, PNG, WEBP, PDF, and DOCX.",
        },
        { status: 400 }
      );
    }

    // Verify that the patient exists.
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { message: "Patient not found." },
        { status: 404 }
      );
    }

    // Sanitize filename.
    const originalBaseName = path.basename(
      file.name,
      path.extname(file.name)
    );

    const safeName =
      originalBaseName
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "document";

    // Generate unique filename.
    const uniqueName = `${safeName}-${crypto.randomUUID()}${extension}`;

    // Storage path.
    const storagePath = `documents/${patientId}/${uniqueName}`;

    // Convert file to ArrayBuffer.
    const arrayBuffer = await file.arrayBuffer();

    // Upload original file to private Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from("klaro-documents")
      .upload(storagePath, arrayBuffer, {
        contentType: expectedMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Supabase Storage upload error:",
        uploadError
      );

      return NextResponse.json(
        {
          message:
            "Failed to upload document to storage.",
        },
        { status: 500 }
      );
    }

    // Track successful upload so it can be removed
    // if saving its database metadata fails.
    uploadedStoragePath = storagePath;

    // Save document metadata to PostgreSQL.
    const document = await prisma.document.create({
      data: {
        patientId,
        fileName: file.name,
        fileType: expectedMimeType,
        fileSize: file.size,
        filePath: storagePath,
        documentType:
          typeof documentTypeValue === "string" &&
          documentTypeValue.trim()
            ? documentTypeValue.trim()
            : "General Document",
      },
    });

    // Database record was saved successfully.
    uploadedStoragePath = null;

    return NextResponse.json(
      {
        message: "Original file uploaded successfully.",
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Document upload error:", error);

    // Remove uploaded file if the database operation failed.
    if (uploadedStoragePath) {
      const { error: cleanupError } = await supabase.storage
        .from("klaro-documents")
        .remove([uploadedStoragePath]);

      if (cleanupError) {
        console.error(
          "Supabase Storage cleanup error:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        message: "Failed to upload document.",
      },
      { status: 500 }
    );
  }
}
