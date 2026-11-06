
from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from pathlib import Path
import tempfile
import shutil
import os
import cv2
import time
import math
import statistics

app = FastAPI(title="Klaro PaddleOCR API")


# ==========================================
# PREPROCESSING CONFIGURATION
# ==========================================

# False = Use original uploaded image.
# True  = Apply all six preprocessing techniques.
USE_PREPROCESSING = True

MAX_IMAGE_SIDE = 2000
DENOISE_STRENGTH = 10

MAX_SKEW_ANGLE = 15
MIN_DESKEW_ANGLE = 0.3

CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID_SIZE = (8, 8)

ADAPTIVE_BLOCK_SIZE = 11
ADAPTIVE_C = 2


# ==========================================
# PADDLEOCR INITIALIZATION
# ==========================================

print("Loading PaddleOCR model...")

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle"
)

print("PaddleOCR model loaded successfully.")


# ==========================================
# TERMINAL LOGGING HELPERS
# ==========================================

def print_separator(char="=", length=64):
    print(char * length)


def print_section(title):
    print()
    print(title)
    print("-" * 64)


def log_time(label: str, elapsed: float):

    if elapsed >= 60:
        minutes = int(elapsed // 60)
        seconds = elapsed % 60

        value = (
            f"{minutes} min {seconds:.2f} sec "
            f"({elapsed * 1000:.2f} ms)"
        )
    else:
        value = (
            f"{elapsed:.3f} seconds "
            f"({elapsed * 1000:.2f} ms)"
        )

    print(f"{label:<30}: {value}")


def get_image_dimensions(image_path: str):
    image = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)

    if image is None:
        raise ValueError("Unable to read the uploaded image.")

    height, width = image.shape[:2]

    return width, height


def display_recognized_text(ocr_output):

    if not ocr_output:
        print("No text was recognized.")
        return

    for index, item in enumerate(ocr_output, start=1):

        text = str(item["text"]).replace("\n", " ").replace("\r", " ")

        confidence = item["confidence"]
        status = item["status"]

        print(
            f"[{index:03d}] "
            f"[{status:<12}] "
            f"[{confidence:6.2f}%] "
            f"{text}"
        )


# ==========================================
# IMAGE PREPROCESSING FUNCTION
# ==========================================

def preprocess_image(input_path: str, output_path: str):
    """
    Klaro preprocessing pipeline:

    1. Grayscale conversion
    2. Resize oversized images
    3. Denoising
    4. Deskewing
    5. Contrast enhancement using CLAHE
    6. Adaptive thresholding
    """

    timings = {}

    preprocessing_start = time.perf_counter()

    # IMAGE LOADING
    stage_start = time.perf_counter()

    image = cv2.imread(input_path, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Unable to read the uploaded image.")

    original_height, original_width = image.shape[:2]

    timings["image_loading"] = time.perf_counter() - stage_start

    print(
        f"Original image dimensions: "
        f"{original_width}x{original_height}"
    )

    log_time("Image loading", timings["image_loading"])

    # TECHNIQUE 1: GRAYSCALE
    stage_start = time.perf_counter()

    processed_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    timings["grayscale"] = time.perf_counter() - stage_start

    print("Step 1: Grayscale conversion completed.")
    log_time("Grayscale conversion", timings["grayscale"])

    # TECHNIQUE 2: RESIZE
    stage_start = time.perf_counter()

    height, width = processed_image.shape[:2]
    longest_side = max(width, height)

    if longest_side > MAX_IMAGE_SIDE:

        scale = MAX_IMAGE_SIDE / longest_side

        new_width = int(width * scale)
        new_height = int(height * scale)

        processed_image = cv2.resize(
            processed_image,
            (new_width, new_height),
            interpolation=cv2.INTER_AREA
        )

        print(
            f"Step 2: Image resized to "
            f"{new_width}x{new_height}"
        )

    else:

        print(
            "Step 2: Resize skipped. "
            "Image is already within the maximum dimensions."
        )

    timings["resize"] = time.perf_counter() - stage_start

    log_time("Resize", timings["resize"])

    # TECHNIQUE 3: DENOISING
    stage_start = time.perf_counter()

    processed_image = cv2.fastNlMeansDenoising(
        processed_image,
        None,
        h=DENOISE_STRENGTH,
        templateWindowSize=7,
        searchWindowSize=21
    )

    timings["denoising"] = time.perf_counter() - stage_start

    print(
        f"Step 3: Denoising completed "
        f"(strength={DENOISE_STRENGTH})."
    )

    log_time("Denoising", timings["denoising"])

    # TECHNIQUE 4: DESKEWING
    stage_start = time.perf_counter()

    _, binary_image = cv2.threshold(
        processed_image,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    edges = cv2.Canny(binary_image, 50, 150)

    height, width = processed_image.shape[:2]

    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=math.pi / 1800,
        threshold=80,
        minLineLength=max(40, width // 10),
        maxLineGap=20
    )

    detected_angles = []

    if lines is not None:

        for line in lines:

            x1, y1, x2, y2 = line[0]

            angle = math.degrees(
                math.atan2(y2 - y1, x2 - x1)
            )

            if angle > 90:
                angle -= 180

            elif angle < -90:
                angle += 180

            if abs(angle) <= MAX_SKEW_ANGLE:
                detected_angles.append(angle)

    if detected_angles:

        skew_angle = statistics.median(detected_angles)

        if abs(skew_angle) >= MIN_DESKEW_ANGLE:

            center = (width // 2, height // 2)

            rotation_matrix = cv2.getRotationMatrix2D(
                center,
                -skew_angle,
                1.0
            )

            processed_image = cv2.warpAffine(
                processed_image,
                rotation_matrix,
                (width, height),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=255
            )

            print(
                f"Step 4: Deskewing completed. "
                f"Detected angle: {skew_angle:.2f} degrees."
            )

        else:

            print(
                f"Step 4: Deskewing skipped. "
                f"Detected angle ({skew_angle:.2f} degrees) "
                "is too small to correct."
            )

    else:

        print(
            "Step 4: Deskewing skipped. "
            "No suitable horizontal text lines detected."
        )

    timings["deskewing"] = time.perf_counter() - stage_start

    log_time("Deskewing", timings["deskewing"])

    # TECHNIQUE 5: CONTRAST ENHANCEMENT
    stage_start = time.perf_counter()

    clahe = cv2.createCLAHE(
        clipLimit=CLAHE_CLIP_LIMIT,
        tileGridSize=CLAHE_TILE_GRID_SIZE
    )

    processed_image = clahe.apply(processed_image)

    timings["contrast_enhancement"] = (
        time.perf_counter() - stage_start
    )

    print(
        "Step 5: Contrast enhancement completed using CLAHE "
        f"(clipLimit={CLAHE_CLIP_LIMIT}, "
        f"tileGridSize={CLAHE_TILE_GRID_SIZE})."
    )

    log_time(
        "Contrast enhancement",
        timings["contrast_enhancement"]
    )

    # TECHNIQUE 6: ADAPTIVE THRESHOLDING
    stage_start = time.perf_counter()

    processed_image = cv2.adaptiveThreshold(
        processed_image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        ADAPTIVE_BLOCK_SIZE,
        ADAPTIVE_C
    )

    timings["adaptive_thresholding"] = (
        time.perf_counter() - stage_start
    )

    print(
        "Step 6: Adaptive thresholding completed "
        f"(blockSize={ADAPTIVE_BLOCK_SIZE}, "
        f"C={ADAPTIVE_C})."
    )

    log_time(
        "Adaptive thresholding",
        timings["adaptive_thresholding"]
    )

    # SAVE PREPROCESSED IMAGE
    stage_start = time.perf_counter()

    success = cv2.imwrite(
        output_path,
        processed_image
    )

    if not success:
        raise ValueError("Unable to save the preprocessed image.")

    timings["saving"] = time.perf_counter() - stage_start

    final_height, final_width = processed_image.shape[:2]

    print(
        f"Preprocessed image dimensions: "
        f"{final_width}x{final_height}"
    )

    log_time("Saving preprocessed image", timings["saving"])

    timings["total_preprocessing"] = (
        time.perf_counter() - preprocessing_start
    )

    print_section("PREPROCESSING TIME SUMMARY")

    for name in [
        "image_loading",
        "grayscale",
        "resize",
        "denoising",
        "deskewing",
        "contrast_enhancement",
        "adaptive_thresholding",
        "saving"
    ]:

        log_time(
            name.replace("_", " ").title(),
            timings[name]
        )

    log_time(
        "Total preprocessing",
        timings["total_preprocessing"]
    )

    return {
        "original_width": original_width,
        "original_height": original_height,
        "processed_width": final_width,
        "processed_height": final_height,
        "timings": timings
    }


# ==========================================
# API ROOT
# ==========================================

@app.get("/")
@app.get("/api")
def root():

    return {
        "message": "Klaro PaddleOCR API is running"
    }


# ==========================================
# OCR PROCESSING ENDPOINT
# ==========================================

@app.post("/ocr")
@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):

    request_start = time.perf_counter()

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

    temporary_path = None
    preprocessed_path = None

    try:

        # ==========================================
        # START EVALUATION LOG
        # ==========================================

        print("\n")
        print_separator("=")
        print("                    KLARO OCR EVALUATION")
        print_separator("=")

        print_section("DOCUMENT INFORMATION")

        print(f"{'Filename':<30}: {file.filename}")
        print(
            f"{'Preprocessing':<30}: "
            f"{'ENABLED' if USE_PREPROCESSING else 'DISABLED'}"
        )

        # ==========================================
        # SAVE ORIGINAL UPLOADED IMAGE
        # ==========================================

        stage_start = time.perf_counter()

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=Path(file.filename or "").suffix.lower()
        ) as temporary_file:

            shutil.copyfileobj(file.file, temporary_file)
            temporary_path = temporary_file.name

        upload_save_time = time.perf_counter() - stage_start

        # ==========================================
        # IMAGE DIMENSIONS
        # ==========================================

        dimension_start = time.perf_counter()

        original_width, original_height = get_image_dimensions(
            temporary_path
        )

        dimension_inspection_time = (
            time.perf_counter() - dimension_start
        )

        print(
            f"{'Image Dimensions':<30}: "
            f"{original_width} x {original_height}"
        )

        # ==========================================
        # SELECT OCR INPUT
        # ==========================================

        image_info = {
            "timings": {
                "total_preprocessing": 0.0
            }
        }

        ocr_input_path = temporary_path

        if USE_PREPROCESSING:

            print(
                f"{'OCR Input':<30}: Preprocessed Image"
            )

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".png"
            ) as processed_file:

                preprocessed_path = processed_file.name

            image_info = preprocess_image(
                temporary_path,
                preprocessed_path
            )

            ocr_input_path = preprocessed_path

        else:

            print(
                f"{'OCR Input':<30}: Original Uploaded Image"
            )

        # ==========================================
        # PADDLEOCR RECOGNITION
        # ==========================================

        print_section("OCR RECOGNITION")

        print("Running PaddleOCR...")

        ocr_start = time.perf_counter()

        results = ocr.predict(
            ocr_input_path,
            return_word_box=True
        )

        ocr_time = time.perf_counter() - ocr_start

        print("PaddleOCR recognition completed.")

        # ==========================================
        # FORMAT OCR RESULTS
        # ==========================================

        formatting_start = time.perf_counter()

        ocr_output = []

        for result in results:

            data = result.json

            if callable(data):
                data = data()

            recognition_texts = data["res"]["rec_texts"]
            confidence_scores = data["res"]["rec_scores"]
            text_words = data["res"].get("text_word", [])

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

        formatting_time = time.perf_counter() - formatting_start

        # ==========================================
        # CONFIDENCE SUMMARY
        # ==========================================

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

        # ==========================================
        # TOTAL PROCESSING TIME
        # ==========================================

        total_time = time.perf_counter() - request_start

        # ==========================================
        # DOCUMENT INFORMATION AND TIMINGS
        # ==========================================

        print_section("PROCESSING TIME")

        log_time("Image Upload and Saving", upload_save_time)
        log_time("Image Dimension Inspection", dimension_inspection_time)

        log_time(
            "Image Preprocessing",
            image_info["timings"]["total_preprocessing"]
        )

        log_time("PaddleOCR Recognition", ocr_time)
        log_time("OCR Result Formatting", formatting_time)
        log_time("Total Processing Time", total_time)

        # ==========================================
        # RECOGNITION SUMMARY
        # ==========================================

        print_section("OCR RECOGNITION SUMMARY")

        print(f"{'Total Recognized Lines':<30}: {total_lines}")
        print(f"{'HIGH Confidence':<30}: {high_count}")
        print(f"{'MODERATE Confidence':<30}: {moderate_count}")
        print(f"{'NEEDS REVIEW':<30}: {needs_review_count}")
        print(
            f"{'Needs Review Percentage':<30}: "
            f"{flagged_percentage:.2f}%"
        )

        # ==========================================
        # RECOGNIZED TEXT
        # ==========================================

        print_section("RECOGNIZED TEXT")

        display_recognized_text(ocr_output)

        # ==========================================
        # OCR EVALUATION METRICS
        # ==========================================

        print_section("OCR EVALUATION METRICS")

        print(
            f"{'Character Accuracy':<30}: "
            "Pending Ground Truth"
        )

        print(
            f"{'Character Error Rate (CER)':<30}: "
            "Pending Ground Truth"
        )

        print(
            f"{'Word Error Rate (WER)':<30}: "
            "Pending Ground Truth"
        )

        print(
            f"{'Readability Score':<30}: "
            "Pending Manual Evaluation (1-5)"
        )

        print_separator("=")
        print("                 OCR EVALUATION COMPLETED")
        print_separator("=")
        print("\n")

        # ==========================================
        # API RESPONSE
        # ==========================================

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

    except HTTPException:
        raise

    except Exception as error:

        print(f"\nKLARO OCR ERROR: {error}")

        raise HTTPException(
            status_code=500,
            detail="OCR processing failed."
        )

    finally:

        # DELETE ORIGINAL TEMPORARY IMAGE
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)

        # DELETE PREPROCESSED IMAGE IF IT WAS CREATED
        if preprocessed_path and os.path.exists(preprocessed_path):
            os.remove(preprocessed_path)

        await file.close()
