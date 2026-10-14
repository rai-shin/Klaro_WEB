
from paddleocr import PaddleOCR
from pathlib import Path
import json

# Ask the user for an image path
user_path = input("Enter the image path: ").strip().strip('"')

image_path = Path(user_path)

if not image_path.exists():
    print(f"File not found: {image_path}")
    exit()

if not image_path.is_file():
    print("The provided path is not a file.")
    exit()

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle"
)

print(f"\nProcessing: {image_path}")
print("Please wait...\n")

results = ocr.predict(str(image_path))

ocr_output = []

for result in results:
    data = result.json

    if callable(data):
        data = data()

    recognition_texts = data["res"]["rec_texts"]
    confidence_scores = data["res"]["rec_scores"]

    for index, text in enumerate(recognition_texts):
        confidence = confidence_scores[index] * 100

        if confidence >= 90:
            status = "HIGH"
        elif confidence >= 70:
            status = "MODERATE"
        else:
            status = "NEEDS_REVIEW"

        ocr_output.append({
            "text": text,
            "confidence": round(confidence, 2),
            "status": status,
            "flagged": status == "NEEDS_REVIEW"
        })

output_path = Path("ocr_result.json")

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(ocr_output, file, indent=2, ensure_ascii=False)

high_count = 0
moderate_count = 0
needs_review_count = 0

for item in ocr_output:
    if item["status"] == "HIGH":
        high_count += 1
    elif item["status"] == "MODERATE":
        moderate_count += 1
    elif item["status"] == "NEEDS_REVIEW":
        needs_review_count += 1

total_lines = len(ocr_output)

print("\nCONFIDENCE SUMMARY")
print("------------------")
print(f"Total lines: {total_lines}")
print(f"High confidence: {high_count}")
print(f"Moderate confidence: {moderate_count}")
print(f"Needs review: {needs_review_count}")

if total_lines > 0:
    flagged_percentage = (
        needs_review_count / total_lines
    ) * 100

    print(
        f"Needs-review percentage: "
        f"{flagged_percentage:.2f}%"
    )

print("OCR processing completed.")
print(f"Total text lines: {len(ocr_output)}")
print(f"Results saved to: {output_path}")

print("\nOCR RESULTS:\n")

for item in ocr_output:
    print(
        f"[{item['status']}] "
        f"{item['confidence']}% - "
        f"{item['text']}"
    )