
import cv2
import numpy as np

# ==========================================
# CMDI MASTER TEMPLATE DIMENSIONS
# ==========================================

TEMPLATE_WIDTH = 1339
TEMPLATE_HEIGHT = 2048



def has_slash_mark(image, region):
    """
    Detects a diagonal handwritten mark inside an answer cell.
    Uses the original image and excludes lines near cell borders.
    """

    x_min, y_min, x_max, y_max = scale_template_region(
        region,
        image.shape[1],
        image.shape[0]
    )

    # Keep a small margin to avoid table borders.
    margin = 3
    x_min += margin
    y_min += margin
    x_max -= margin
    y_max -= margin

    cell = image[y_min:y_max, x_min:x_max]

    if cell.size == 0:
        return False

    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)

    _, binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    lines = cv2.HoughLinesP(
        binary,
        rho=1,
        theta=np.pi / 180,
        threshold=3,
        minLineLength=4,
        maxLineGap=3
    )

    cell_height, cell_width = binary.shape


    """
    print(
            f"[SLASH DEBUG] Region={region}, "
            f"Crop={cell.shape}, "
            f"White pixels={cv2.countNonZero(binary)}, "
            f"Lines detected={0 if lines is None else len(lines)}"
        )
    """


    if lines is None:
        return False

    for line in lines:
        x1, y1, x2, y2 = line[0]

        dx = abs(x2 - x1)
        dy = abs(y2 - y1)

        # Reject horizontal and perfectly vertical lines.
        if dx == 0 or dy < 4:
            continue

        slope = dy / dx

        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2

        # Reject candidates close to the cell borders.
        if not (cell_width * 0.20 <= center_x <= cell_width * 0.80):
            continue

        if not (cell_height * 0.10 <= center_y <= cell_height * 0.90):
            continue

        """
        print(
                    f"[LINE DEBUG] Region={region}, "
                    f"Start=({x1}, {y1}), "
                    f"End=({x2}, {y2}), "
                    f"dx={dx}, dy={dy}, "
                    f"slope={slope:.2f}"
                )
        """



        # Accept diagonal handwritten marks, including steep slashes.
        if 0.25 <= slope <= 10.0:
            return True

    return False


def scale_template_region(region, image_width, image_height):
    """
    Scales a region defined on the original CMDI template
    to the actual dimensions of the image processed by OCR.
    """

    x_min, y_min, x_max, y_max = region

    scale_x = image_width / TEMPLATE_WIDTH
    scale_y = image_height / TEMPLATE_HEIGHT

    return (
        round(x_min * scale_x),
        round(y_min * scale_y),
        round(x_max * scale_x),
        round(y_max * scale_y)
    )

def get_text_in_template_region(
    ocr_results,
    region,
    image_width,
    image_height
    ):
        """
        Gets OCR text from a field region defined using
        the original CMDI template coordinates.
        """

        scaled_region = scale_template_region(
            region,
            image_width,
            image_height
        )

        return get_text_in_region(
            ocr_results,
            *scaled_region
        )



def create_empty_structured_record():
    """
    Creates the structured CMDI Health Record layout.

    This module is separate from the PaddleOCR processing logic.
    It does not modify or replace the original OCR results.
    """

    return {
        "part_1": {
            "student_information": {
                "shs_grade_level": None,
                "section": None,
                "college_course": None,
                "level_and_block": None,
                "name": None,
                "civil_status": None,
                "gender": None,
                "preferred_gender": None,
                "address": None,
                "contact_number": None,
                "age": None,
                "birthday": None,
                "birthplace": None,
                "nationality": None,
                "religion": None
            },

            "spouse_information": {
                "name": None,
                "contact_number": None,
                "address": None,
                "occupation": None
            },

            "mother_guardian_information": {
                "name": None,
                "contact_number": None,
                "address": None,
                "occupation": None
            },

            "father_information": {
                "name": None,
                "contact_number": None,
                "address": None,
                "occupation": None
            },

            "medical_history": {
                "allergy": None,
                "anemia": None,
                "asthma": None,
                "behavior_problem": None,
                "bleeding_problem": None,
                "chicken_pox": None,
                "convulsion": None,
                "diabetes": None,
                "dengue": None,
                "ear_problem": None,
                "epilepsy": None,
                "eating_disorder": None,
                "eye_problem": None,
                "fainting": None,
                "fracture": None,
                "hearing_problem": None,
                "heart_problem": None,
                "indigestion": None,
                "insomnia": None,
                "intestinal_worm": None,
                "kidney_disease": None,
                "liver_disease": None,
                "lung_disease": None,
                "measles": None,
                "mumps": None,
                "pneumonia": None,
                "skin_problem": None,
                "speech_problem": None,
                "spine_disorder": None,
                "tonsillitis": None,
                "tuberculosis": None,
                "typhoid_fever": None,
                "others": None
            },

            "family_history": {
                "allergy": None,
                "cancer": None,
                "bleeding_problem": None,
                "diabetes": None,
                "epilepsy": None,
                "heart_problem": None,
                "hypertension": None,
                "kidney_disease": None,
                "mental_problem": None,
                "obesity": None,
                "stroke": None,
                "tuberculosis": None
            },

            "student_experiences": {
                "hospitalization": {
                    "answer": None,
                    "reason": None
                },
                "surgery_operation": {
                    "answer": None,
                    "reason": None
                },
                "special_medication": {
                    "answer": None,
                    "drugs": None
                }
            },

            "boys": {
                "circumcision": None
            },

            "girls": {
                "age_of_menarche": None,
                "last_menstrual_period": None,
                "cycle": None,
                "cycle_days": None,
                "flow": None
            },

            "psychosocial_history": {
                "close_friend": {
                    "answer": None,
                    "number_of_friends": None
                },
                "driving": {
                    "answer": None,
                    "regularly": None
                },
                "alcohol": {
                    "answer": None,
                    "how_often": None,
                    "how_much": None
                },
                "smoking": {
                    "answer": None,
                    "sticks_per_day": None,
                    "since_when": None
                },
                "illicit_drugs": {
                    "answer": None,
                    "kind": None,
                    "regular_use": None
                },
                "abuse": {
                    "experienced": None,
                    "physical": None,
                    "sexual": None,
                    "verbal": None
                }
            },

            "student_certification": {
                "certification_statement": None,
                "date": None
            }
        },

        "part_2": {
            "physical_examination": {
                "date": None,
                "body_mass_index": None,
                "weight": None,
                "height": None,
                "blood_pressure": None,
                "pulse": None,
                "skin": None,
                "head": None,
                "eyes_vision": None,
                "ears_hearing": None,
                "nose": None,
                "mouth": None,
                "gum": None,
                "throat": None,
                "neck": None,
                "chest": None,
                "lungs": None,
                "abdomen": None,
                "limbs": None,
                "neuro": None
            },

            "other_significant_findings": None,

            "fitness_certification": {
                "fit_for_enrollment": None,
                "not_fit_for_enrollment": None,
                "pending": None,
                "pending_reason": None
            },

            "impressions": None,
            "recommendations": None,

            "physician_details": {
                "license_number": None,
                "date_of_examination": None
            }
        }
    }

def get_checkbox_answer(image, no_region, yes_region):
    """
    Determines the selected answer from No and Yes cells.

    Returns:
        "No" if only the No cell is marked.
        "Yes" if only the Yes cell is marked.
        None if neither or both cells are marked.
    """

    no_marked = has_slash_mark(image, no_region)
    yes_marked = has_slash_mark(image, yes_region)

    if no_marked and not yes_marked:
        return "No"

    if yes_marked and not no_marked:
        return "Yes"

    return None


def get_text_in_region(ocr_results, x_min, y_min, x_max, y_max):
    """
    Returns OCR text whose bounding-box center falls inside
    the specified region of the processed form image.
    """

    matches = []

    for item in ocr_results:
        text = (item.get("text") or "").strip()
        box = item.get("bounding_box")

        if not text or not box or len(box) < 4:
            continue

        x1, y1, x2, y2 = box[:4]

        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2

        if (
            x_min <= center_x <= x_max
            and y_min <= center_y <= y_max
        ):
            matches.append(item)

    if not matches:
        return None

    # Prefer the highest-confidence detection if multiple
    # detections fall inside the same field region.
    best_match = max(
        matches,
        key=lambda item: item.get("confidence", 0)
    )

    return best_match.get("text", "").strip() or None


def extract_value_after_colon(text):
    """
    Extracts the value from OCR detections that combine
    a printed label and its filled-in value.
    """

    if not text or ":" not in text:
        return text

    value = text.split(":", 1)[1].strip()

    return value or None



def build_structured_record(
        ocr_results,
        image_width,
        image_height,
        image_path
    ):
    """
    Initializes the structured CMDI Health Record and extracts
    Student Information and Parent/Guardian Information.

    This first extraction pass uses fixed regions from the
    current CMDI Health Record template.

    Original OCR detections remain preserved.
    """

    structured_record = create_empty_structured_record()

    part_1 = structured_record["part_1"]

    # ==========================================
    # LOAD IMAGE FOR CHECKBOX DETECTION
    # ==========================================

    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(
            f"Unable to load image for structured extraction: {image_path}"
        )

    # ==========================================
    # MEDICAL HISTORY - ALLERGY
    # ==========================================

    part_1["medical_history"]["allergy"] = get_checkbox_answer(
        image,
        no_region=(290, 522, 330, 540),
        yes_region=(335, 522, 375, 540)
    )
    # ==========================================
    # MEDICAL HISTORY - ANEMIA
    # ==========================================

    part_1["medical_history"]["anemia"] = get_checkbox_answer(
        image,
        no_region=(290, 540, 330, 558),
        yes_region=(335, 540, 375, 558)
    )
    # ==========================================
    # MEDICAL HISTORY - ASTHMA
    # ==========================================

    part_1["medical_history"]["asthma"] = get_checkbox_answer(
        image,
        no_region=(290, 552, 330, 580),
        yes_region=(335, 552, 375, 580)
    )
    # ==========================================
    # MEDICAL HISTORY - BEHAVIOR PROBLEM
    # ==========================================

    part_1["medical_history"]["behavior_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 566, 330, 602),
        yes_region=(335, 566, 375, 602)
    )
    # ==========================================
    # MEDICAL HISTORY - BLEEDING PROBLEM
    # ==========================================

    part_1["medical_history"]["bleeding_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 584, 330, 620),
        yes_region=(335, 584, 375, 620)
    )
    # ==========================================
    # MEDICAL HISTORY - CHICKEN POX
    # ==========================================

    part_1["medical_history"]["chicken_pox"] = get_checkbox_answer(
        image,
        no_region=(290, 602, 330, 638),
        yes_region=(335, 602, 375, 638)
    )
    # ==========================================
    # MEDICAL HISTORY - CONVULSION
    # ==========================================

    part_1["medical_history"]["convulsion"] = get_checkbox_answer(
        image,
        no_region=(290, 620, 330, 656),
        yes_region=(335, 620, 375, 656)
    )
    # ==========================================
    # MEDICAL HISTORY - DIABETES
    # ==========================================

    part_1["medical_history"]["diabetes"] = get_checkbox_answer(
        image,
        no_region=(290, 630, 330, 674),
        yes_region=(335, 630, 375, 674)
    )
    # ==========================================
    # MEDICAL HISTORY - DENGUE
    # ==========================================

    part_1["medical_history"]["dengue"] = get_checkbox_answer(
        image,
        no_region=(300, 650, 325, 690),
        yes_region=(345, 650, 370, 690)
    )
    # ==========================================
    # MEDICAL HISTORY - EAR PROBLEM
    # ==========================================

    part_1["medical_history"]["ear_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 674, 330, 710),
        yes_region=(335, 674, 375, 710)
    )
    # ==========================================
    # MEDICAL HISTORY - EATING DISORDER
    # ==========================================

    part_1["medical_history"]["eating_disorder"] = get_checkbox_answer(
        image,
        no_region=(295, 688, 330, 730),
        yes_region=(340, 688, 375, 730)
    )
    # ==========================================
    # MEDICAL HISTORY - EYE PROBLEM
    # ==========================================

    part_1["medical_history"]["eye_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 710, 330, 746),
        yes_region=(335, 710, 375, 746)
    )
    # ==========================================
    # MEDICAL HISTORY - FAINTING
    # ==========================================

    part_1["medical_history"]["fainting"] = get_checkbox_answer(
        image,
        no_region=(290, 728, 330, 764),
        yes_region=(335, 728, 375, 764)
    )
    # ==========================================
    # MEDICAL HISTORY - FRACTURE
    # ==========================================

    part_1["medical_history"]["fracture"] = get_checkbox_answer(
        image,
        no_region=(290, 746, 330, 782),
        yes_region=(335, 746, 375, 782)
    )
    # ==========================================
    # MEDICAL HISTORY - HEARING PROBLEM
    # ==========================================

    part_1["medical_history"]["hearing_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 764, 330, 800),
        yes_region=(335, 764, 375, 800)
    )
    # ==========================================
    # MEDICAL HISTORY - HEART PROBLEM
    # ==========================================

    part_1["medical_history"]["heart_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 782, 330, 818),
        yes_region=(335, 782, 375, 818)
    )

    # ==========================================
    # MEDICAL HISTORY - INDIGESTION
    # ==========================================

    part_1["medical_history"]["indigestion"] = get_checkbox_answer(
        image,
        no_region=(290, 800, 330, 836),
        yes_region=(335, 800, 375, 836)
    )

    # ==========================================
    # MEDICAL HISTORY - INSOMNIA
    # ==========================================

    part_1["medical_history"]["insomnia"] = get_checkbox_answer(
        image,
        no_region=(290, 810, 330, 860),
        yes_region=(335, 810, 375, 860)
    )

    # ==========================================
    # MEDICAL HISTORY - INTESTINAL WORM
    # ==========================================

    part_1["medical_history"]["intestinal_worm"] = get_checkbox_answer(
        image,
        no_region=(290, 836, 330, 872),
        yes_region=(335, 836, 375, 872)
    )

    # ==========================================
    # MEDICAL HISTORY - KIDNEY DISEASE
    # ==========================================

    part_1["medical_history"]["kidney_disease"] = get_checkbox_answer(
        image,
        no_region=(290, 854, 330, 890),
        yes_region=(335, 854, 375, 890)
    )

    # ==========================================
    # MEDICAL HISTORY - LIVER DISEASE
    # ==========================================

    part_1["medical_history"]["liver_disease"] = get_checkbox_answer(
        image,
        no_region=(290, 872, 330, 908),
        yes_region=(335, 872, 375, 908)
    )

    # ==========================================
    # MEDICAL HISTORY - LUNG DISEASE
    # ==========================================

    part_1["medical_history"]["lung_disease"] = get_checkbox_answer(
        image,
        no_region=(290, 890, 330, 926),
        yes_region=(335, 890, 375, 926)
    )

    # ==========================================
    # MEDICAL HISTORY - MEASLES
    # ==========================================

    part_1["medical_history"]["measles"] = get_checkbox_answer(
        image,
        no_region=(290, 908, 330, 944),
        yes_region=(335, 908, 375, 944)
    )

    # ==========================================
    # MEDICAL HISTORY - MUMPS
    # ==========================================

    part_1["medical_history"]["mumps"] = get_checkbox_answer(
        image,
        no_region=(290, 918, 330, 970),
        yes_region=(335, 918, 375, 970)
    )

    # ==========================================
    # MEDICAL HISTORY - PNEUMONIA
    # ==========================================

    part_1["medical_history"]["pneumonia"] = get_checkbox_answer(
        image,
        no_region=(290, 936, 330, 988),
        yes_region=(335, 936, 375, 988)
    )

    # ==========================================
    # MEDICAL HISTORY - SKIN PROBLEM
    # ==========================================

    part_1["medical_history"]["skin_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 962, 330, 998),
        yes_region=(335, 962, 375, 998)
    )

    # ==========================================
    # MEDICAL HISTORY - SPEECH PROBLEM
    # ==========================================

    part_1["medical_history"]["speech_problem"] = get_checkbox_answer(
        image,
        no_region=(290, 972, 330, 1024),
        yes_region=(335, 972, 375, 1024)
    )

    # ==========================================
    # MEDICAL HISTORY - SPINE DISORDER
    # ==========================================

    part_1["medical_history"]["spine_disorder"] = get_checkbox_answer(
        image,
        no_region=(290, 998, 330, 1034),
        yes_region=(335, 998, 375, 1034)
    )

    # ==========================================
    # MEDICAL HISTORY - TONSILLITIS
    # ==========================================

    part_1["medical_history"]["tonsillitis"] = get_checkbox_answer(
        image,
        no_region=(290, 1016, 330, 1052),
        yes_region=(335, 1016, 375, 1052)
    )

    # ==========================================
    # MEDICAL HISTORY - TUBERCULOSIS
    # ==========================================

    part_1["medical_history"]["tuberculosis"] = get_checkbox_answer(
        image,
        no_region=(290, 1034, 330, 1070),
        yes_region=(335, 1034, 375, 1070)
    )

    # ==========================================
    # MEDICAL HISTORY - TYPHOID FEVER
    # ==========================================

    part_1["medical_history"]["typhoid_fever"] = get_checkbox_answer(
        image,
        no_region=(290, 1052, 330, 1088),
        yes_region=(335, 1052, 375, 1088)
    )

    # ==========================================
    # MEDICAL HISTORY - OTHERS
    # ==========================================

    part_1["medical_history"]["others"] = get_checkbox_answer(
        image,
        no_region=(290, 1062, 330, 1114),
        yes_region=(335, 1062, 375, 1114)
    )



    # ==========================================
    # STUDENT INFORMATION
    # ==========================================

    student = part_1["student_information"]

    # All regions use the original CMDI template coordinates (1339 x 2048).
    # Regions are positioned around the value areas, excluding printed labels.

    student["shs_grade_level"] = get_text_in_template_region(
        ocr_results, (185, 150, 260, 180),
        image_width, image_height
    )

    student["section"] = get_text_in_template_region(
        ocr_results, (335, 150, 495, 180),
        image_width, image_height
    )

    student["college_course"] = get_text_in_template_region(
        ocr_results, (175, 175, 265, 200),
        image_width, image_height
    )

    student["level_and_block"] = get_text_in_template_region(
        ocr_results, (270, 175, 500, 200),
        image_width, image_height
    )

    student["name"] = get_text_in_template_region(
        ocr_results, (110, 210, 600, 245),
        image_width, image_height
    )

    student["civil_status"] = get_text_in_template_region(
        ocr_results, (705, 210, 815, 245),
        image_width, image_height
    )

    student["gender"] = get_text_in_template_region(
        ocr_results, (890, 210, 990, 245),
        image_width, image_height
    )

    student["preferred_gender"] = get_text_in_template_region(
        ocr_results, (1130, 210, 1310, 245),
        image_width, image_height
    )

    student["address"] = get_text_in_template_region(
        ocr_results, (130, 240, 980, 275),
        image_width, image_height
    )

    student["contact_number"] = get_text_in_template_region(
        ocr_results, (1090, 240, 1310, 275),
        image_width, image_height
    )

    student["age"] = get_text_in_template_region(
        ocr_results, (100, 265, 190, 300),
        image_width, image_height
    )

    student["birthday"] = get_text_in_template_region(
        ocr_results, (270, 265, 380, 300),
        image_width, image_height
    )

    student["birthplace"] = get_text_in_template_region(
        ocr_results, (475, 265, 600, 300),
        image_width, image_height
    )

    student["nationality"] = get_text_in_template_region(
        ocr_results, (600, 265, 800, 300),
        image_width, image_height
    )

    student["religion"] = get_text_in_template_region(
        ocr_results, (1070, 265, 1310, 300),
        image_width, image_height
    )

    # Remove printed field labels when OCR detects them together with values.
    student["level_and_block"] = extract_value_after_colon(
        student["level_and_block"]
    )

    student["nationality"] = extract_value_after_colon(
        student["nationality"]
    )

    # ==========================================
    # SPOUSE INFORMATION
    # ==========================================

    spouse = part_1["spouse_information"]

    spouse["name"] = get_text_in_template_region(
        ocr_results, (230, 290, 600, 315),
        image_width, image_height
    )

    spouse["contact_number"] = get_text_in_template_region(
        ocr_results, (145, 315, 350, 340),
        image_width, image_height
    )

    spouse["address"] = get_text_in_template_region(
        ocr_results, (460, 315, 950, 340),
        image_width, image_height
    )

    spouse["occupation"] = get_text_in_template_region(
        ocr_results, (1090, 315, 1300, 340),
        image_width, image_height
    )

    # ==========================================
    # MOTHER / GUARDIAN INFORMATION
    # ==========================================

    mother = part_1["mother_guardian_information"]

    mother["name"] = get_text_in_template_region(
        ocr_results, (230, 338, 380, 365),
        image_width, image_height
    )

    mother["contact_number"] = get_text_in_template_region(
        ocr_results, (145, 363, 350, 390),
        image_width, image_height
    )

    mother["address"] = get_text_in_template_region(
        ocr_results, (460, 363, 950, 390),
        image_width, image_height
    )

    mother["occupation"] = get_text_in_template_region(
        ocr_results, (1090, 363, 1300, 390),
        image_width, image_height
    )

    # ==========================================
    # FATHER INFORMATION
    # ==========================================

    father = part_1["father_information"]

    father["name"] = get_text_in_template_region(
        ocr_results, (170, 388, 380, 415),
        image_width, image_height
    )

    father["contact_number"] = get_text_in_template_region(
        ocr_results, (145, 412, 350, 440),
        image_width, image_height
    )

    father["address"] = get_text_in_template_region(
        ocr_results, (460, 412, 950, 440),
        image_width, image_height
    )

    father["occupation"] = get_text_in_template_region(
        ocr_results, (1090, 412, 1300, 440),
        image_width, image_height
    )

    # ==========================================
    # PRESERVE UNMAPPED OCR DETECTIONS
    # ==========================================

    return {
        "record": structured_record,
        "unmapped_ocr_text": [
            {
                "text": item.get("text"),
                "confidence": item.get("confidence"),
                "status": item.get("status"),
                "bounding_box": item.get("bounding_box"),
                "polygon": item.get("polygon")
            }
            for item in ocr_results
            if item.get("text")
        ]
    }
