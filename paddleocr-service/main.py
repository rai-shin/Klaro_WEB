
from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from pathlib import Path
import tempfile
import shutil
import os

app = FastAPI(title="Klaro PaddleOCR API")

print("Loading PaddleOCR model...")

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle"
)

print("PaddleOCR model loaded successfully.")


@app.get("/")
def root():
    return {
        "message": "Klaro PaddleOCR API is running"
    }


@app.post("/ocr")
@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, and WEBP images are supported."
        )

    suffix = Path(file.filename or "").suffix.lower()

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temporary_file:

            shutil.copyfileobj(file.file, temporary_file)
            temporary_path = temporary_file.name

        print(f"Processing file: {file.filename}")

        results = ocr.predict(
            temporary_path,
            return_word_box=True
        )

        ocr_output = []

        for result in results:
            data = result.json

            if callable(data):
                data = data()

            recognition_texts = data["res"]["rec_texts"]
            confidence_scores = data["res"]["rec_scores"]
            text_words = data["res"].get("text_word", [])

            print(
                "PaddleOCR result keys:",
                data["res"].keys()
            )

            for index, text in enumerate(recognition_texts):
                confidence = confidence_scores[index] * 100

                if confidence >= 90:
                    status = "HIGH"
                elif confidence >= 70:
                    status = "MODERATE"
                else:
                    status = "NEEDS_REVIEW"

                words = []

                if index < len(text_words):
                    words = [
                        word.strip()
                        for word in text_words[index]
                        if word.strip()
                    ]

                ocr_output.append({
                    "text": text,
                    "confidence": round(confidence, 2),
                    "status": status,
                    "flagged": status == "NEEDS_REVIEW",
                    "words": words
                })

        high_count = sum(
            item["status"] == "HIGH"
            for item in ocr_output
        )

        moderate_count = sum(
            item["status"] == "MODERATE"
            for item in ocr_output
        )

        needs_review_count = sum(
            item["status"] == "NEEDS_REVIEW"
            for item in ocr_output
        )

        total_lines = len(ocr_output)

        flagged_percentage = (
            needs_review_count / total_lines * 100
            if total_lines > 0
            else 0
        )

        return {
            "success": True,
            "filename": file.filename,
            "total_lines": total_lines,
            "confidence_summary": {
                "high": high_count,
                "moderate": moderate_count,
                "needs_review": needs_review_count,
                "needs_review_percentage": round(
                    flagged_percentage,
                    2
                )
            },
            "results": ocr_output
        }

    except Exception as error:
        print(f"OCR error: {error}")

        raise HTTPException(
            status_code=500,
            detail="OCR processing failed."
        )

    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)

        await file.close()