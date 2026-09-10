// src/lib/documentStructure.ts

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type StructuredField = {
  label: string;
  value: string;
};

export type StructuredBlock =
  | {
      type: "heading";
      content: string;
    }
  | {
      type: "fields";
      fields: StructuredField[];
    }
  | {
      type: "paragraph";
      content: string;
    };

export type StructuredSection = {
  id: string;
  title: string | null;
  blocks: StructuredBlock[];
};

export type StructuredDocument = {
  sections: StructuredSection[];
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function createId(
  value: string,
  index: number
): string {
  return `${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}-${index}`;
}

function cleanLine(
  line: string
): string {
  return line
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------
// DETECT HEADING
// --------------------------------------------------

function isHeading(
  line: string
): boolean {
  const cleaned =
    cleanLine(line);

  if (!cleaned) {
    return false;
  }

  // Too long to reasonably be a heading
  if (cleaned.length > 80) {
    return false;
  }

  // Label: Value is not a heading
  if (cleaned.includes(":")) {
    return false;
  }

  // All uppercase heading
  const lettersOnly =
    cleaned.replace(
      /[^a-zA-Z]/g,
      ""
    );

  if (
    lettersOnly.length >= 3 &&
    lettersOnly ===
      lettersOnly.toUpperCase()
  ) {
    return true;
  }

  // Common clinic document headings
  const commonHeadings = [
    "patient information",
    "personal information",
    "clinical information",
    "medical information",
    "visit information",
    "medical history",
    "chief complaint",
    "diagnosis",
    "assessment",
    "treatment",
    "prescription",
    "medication",
    "notes",
    "remarks",
    "recommendation",
    "physical examination",
    "vital signs",
    "emergency contact",
  ];

  return commonHeadings.includes(
    cleaned.toLowerCase()
  );
}

// --------------------------------------------------
// DETECT LABEL + VALUE
// --------------------------------------------------

function parseField(
  line: string
): StructuredField | null {
  const cleaned =
    cleanLine(line);

  if (!cleaned) {
    return null;
  }

  const colonIndex =
    cleaned.indexOf(":");

  if (colonIndex <= 0) {
    return null;
  }

  const label =
    cleaned
      .slice(0, colonIndex)
      .trim();

  const value =
    cleaned
      .slice(colonIndex + 1)
      .trim();

  // Prevent very long sentences
  // from becoming fields
  if (
    label.length > 50 ||
    label.length < 2
  ) {
    return null;
  }

  return {
    label,
    value,
  };
}

// --------------------------------------------------
// DETECT PARAGRAPH
// --------------------------------------------------

function isParagraph(
  line: string
): boolean {
  const cleaned =
    cleanLine(line);

  if (!cleaned) {
    return false;
  }

  if (isHeading(cleaned)) {
    return false;
  }

  if (parseField(cleaned)) {
    return false;
  }

  return true;
}

// --------------------------------------------------
// MAIN DOCUMENT PARSER
// --------------------------------------------------

export function parseDocumentStructure(
  text: string
): StructuredDocument {
  const lines =
    text
      .split(/\r?\n/)
      .map(cleanLine);

  const sections:
    StructuredSection[] = [];

  let currentSection:
    StructuredSection = {
      id: "section-0",
      title: null,
      blocks: [],
    };

  let pendingFields:
    StructuredField[] = [];

  // ------------------------------------------------
  // SAVE PENDING FIELDS
  // ------------------------------------------------

  function flushFields() {
    if (
      pendingFields.length > 0
    ) {
      currentSection.blocks.push({
        type: "fields",
        fields: [
          ...pendingFields,
        ],
      });

      pendingFields = [];
    }
  }

  // ------------------------------------------------
  // SAVE CURRENT SECTION
  // ------------------------------------------------

  function flushSection() {
    flushFields();

    if (
      currentSection.title ||
      currentSection.blocks.length > 0
    ) {
      sections.push(
        currentSection
      );
    }
  }

  // ------------------------------------------------
  // PROCESS LINES
  // ------------------------------------------------

  for (
    let index = 0;
    index < lines.length;
    index++
  ) {
    const line =
      lines[index];

    // Empty line
    if (!line) {
      flushFields();
      continue;
    }

    // ----------------------------------------------
    // HEADING
    // ----------------------------------------------

    if (
      isHeading(line)
    ) {
      flushSection();

      currentSection = {
        id: createId(
          line,
          index
        ),

        title: line,

        blocks: [],
      };

      continue;
    }

    // ----------------------------------------------
    // FIELD
    // ----------------------------------------------

    const field =
      parseField(line);

    if (field) {
      pendingFields.push(
        field
      );

      continue;
    }

    // ----------------------------------------------
    // PARAGRAPH
    // ----------------------------------------------

    if (
      isParagraph(line)
    ) {
      flushFields();

      currentSection.blocks.push({
        type: "paragraph",

        content: line,
      });
    }
  }

  // ------------------------------------------------
  // SAVE LAST SECTION
  // ------------------------------------------------

  flushSection();

  // ------------------------------------------------
  // FALLBACK
  // ------------------------------------------------

  if (
    sections.length === 0 &&
    text.trim()
  ) {
    sections.push({
      id: "section-0",

      title: null,

      blocks: [
        {
          type: "paragraph",

          content:
            text.trim(),
        },
      ],
    });
  }

  return {
    sections,
  };
}

// --------------------------------------------------
// CONVERT STRUCTURE BACK TO TEXT
//
// Useful when saving to database
// --------------------------------------------------

export function structureToText(
  document: StructuredDocument
): string {
  const output: string[] =
    [];

  for (
    const section of document.sections
  ) {
    if (section.title) {
      output.push(
        section.title
      );
    }

    for (
      const block of section.blocks
    ) {
      if (
        block.type ===
        "heading"
      ) {
        output.push(
          block.content
        );
      }

      if (
        block.type ===
        "paragraph"
      ) {
        output.push(
          block.content
        );
      }

      if (
        block.type ===
        "fields"
      ) {
        for (
          const field of block.fields
        ) {
          output.push(
            `${field.label}: ${field.value}`
          );
        }
      }
    }

    output.push("");
  }

  return output
    .join("\n")
    .trim();
}