import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

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
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const patientIdValue = formData.get("patientId");
    const documentTypeValue = formData.get("documentType");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          message: "No file was uploaded.",
        },
        { status: 400 }
      );
    }

    if (!patientIdValue) {
      return NextResponse.json(
        {
          message: "Patient is required.",
        },
        { status: 400 }
      );
    }

    const patientId = Number(patientIdValue);

    if (Number.isNaN(patientId)) {
      return NextResponse.json(
        {
          message: "Invalid patient ID.",
        },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
      },
    });

    if (!patient) {
      return NextResponse.json(
        {
          message: "Patient not found.",
        },
        { status: 404 }
      );
    }

    // Get extension
    const extension = path.extname(file.name);

    // Clean filename
    const safeName = path
      .basename(file.name, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-");

    // Unique filename
    const uniqueName = `${safeName}-${crypto.randomUUID()}${extension}`;

    // Storage path
    const storagePath = `documents/${patientId}/${uniqueName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Upload original file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("klaro-documents")
      .upload(storagePath, arrayBuffer, {
        contentType:
          file.type || "application/octet-stream",
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

    // Save metadata to PostgreSQL
    const document = await prisma.document.create({
      data: {
        patientId,
        fileName: file.name,
        fileType:
          file.type || "application/octet-stream",
        fileSize: file.size,
        filePath: storagePath,
        documentType:
          typeof documentTypeValue === "string" &&
          documentTypeValue.trim()
            ? documentTypeValue
            : "General Document",
      },
    });

    return NextResponse.json(
      {
        message:
          "Original file uploaded successfully.",
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Document upload error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Failed to upload document.",
      },
      { status: 500 }
    );
  }
}