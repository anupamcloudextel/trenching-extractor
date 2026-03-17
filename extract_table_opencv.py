import cv2
import pytesseract
import numpy as np
import pandas as pd
from pdf2image import convert_from_path
import os

def pdf_page_to_image(pdf_path, page_num=2, dpi=300, out_path='page2.png'):
    pages = convert_from_path(pdf_path, dpi=dpi)
    if page_num-1 < len(pages):
        pages[page_num-1].save(out_path, 'PNG')
        return out_path
    else:
        raise ValueError(f"Page {page_num} not found in PDF.")

def extract_table_from_image(image_path):
    img = cv2.imread(image_path, 0)
    _, img_bin = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    kernel_len = np.array(img).shape[1] // 100
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_len))
    hori_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_len, 1))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    img_temp1 = cv2.erode(img_bin, vert_kernel, iterations=3)
    vert_lines = cv2.dilate(img_temp1, vert_kernel, iterations=3)
    img_temp2 = cv2.erode(img_bin, hori_kernel, iterations=3)
    hori_lines = cv2.dilate(img_temp2, hori_kernel, iterations=3)
    table_mask = cv2.addWeighted(vert_lines, 0.5, hori_lines, 0.5, 0.0)
    table_mask = cv2.erode(~table_mask, kernel, iterations=2)
    _, table_mask = cv2.threshold(table_mask, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 1000]
    boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
    # Group boxes into rows
    rows = []
    current_row = []
    last_y = -1
    for box in boxes:
        x, y, w, h = box
        if last_y == -1 or abs(y - last_y) < 10:
            current_row.append(box)
            last_y = y
        else:
            rows.append(sorted(current_row, key=lambda b: b[0]))
            current_row = [box]
            last_y = y
    if current_row:
        rows.append(sorted(current_row, key=lambda b: b[0]))
    # OCR each cell
    table_data = []
    for row in rows:
        row_data = []
        for box in row:
            x, y, w, h = box
            cell_img = img[y:y+h, x:x+w]
            text = pytesseract.image_to_string(cell_img, config='--psm 6').strip()
            row_data.append(text)
        table_data.append(row_data)
    df = pd.DataFrame(table_data)
    return df

if __name__ == "__main__":
    pdf_path = r"c:\Users\SashwatRavishankar\OneDrive - cloudextel.com\TrenchExtractor\MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    image_path = pdf_page_to_image(pdf_path, page_num=2, out_path="mbmc_page2.png")
    print(f"Saved page image to: {image_path}")
    df = None
    try:
        df = extract_table_from_image(image_path)
    except Exception as e:
        print("Table extraction failed:", e)

    if df is not None:
        print("\nExtracted Table DataFrame:")
        print(df)
        print("\nThird column, from second row onwards:")
        if df.shape[1] >= 3:
            print(df.iloc[1:, 2])
        else:
            print("Less than 3 columns detected.")
        print("\nExtracted Road Types (combined, slash-separated):")
        if df.shape[1] >= 3:
            road_types = [
                str(val).strip()
                for val in df.iloc[:, 2]
                if val and "Type Of Surface" not in str(val) and "None" not in str(val)
            ]
            if road_types:
                print(" / ".join(road_types))
            else:
                print("No road types found.")
        else:
            print("Less than 3 columns detected.")
    else:
        print("No table extracted, df is None.")
