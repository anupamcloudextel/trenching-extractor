import fitz  # PyMuPDF
import re
import camelot
import pandas as pd

APPLICATION_HEADERS = [
    "Application Number",
    "Application Length (Mtr)",
    "Application Date",
    "From",
    "To",
    "Authority",
    "Ward"
]

def extract_application_number(text):
    match = re.search(r"Application\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_application_length(text, table_dict=None):
    print("🔍 DEBUG: extract_application_length - Starting extraction...")
    
    # 1. Try table: look for 'Total Route Length' column
    if table_dict:
        print("🔍 DEBUG: extract_application_length - Trying table extraction...")
        val = extract_from_table(table_dict, [r"Total Route Length", r"Length.*\(HDD.*Open Trench.*\)", r"Total.*Length"])
        if val:
            print(f"🔍 DEBUG: extract_application_length - Found in table: '{val}'")
            # Extract number from the value
            match = re.search(r'(\d+)', val)
            if match:
                result = match.group(1)
                print(f"✅ DEBUG: extract_application_length - Extracted from table: '{result}'")
                return result
            print(f"✅ DEBUG: extract_application_length - Using table value as-is: '{val}'")
            return val
        else:
            print("❌ DEBUG: extract_application_length - Not found in table")
    
    # 2. Enhanced patterns for text extraction
    patterns = [
        r"require\s+(\d+)\s*Mtrs?\s+Open Trench",  # "require 365 Mtrs Open Trench"
        r"laying\s+(\d+)\s*Mtrs?\s+Open Trench",   # "laying 365 Mtrs Open Trench"
        r"Total Route Length.*?(\d+)",              # From table headers
        r"Reference[^\n\r]*?(\d{2,})\s*Mtrs",      # From reference line
        r"Application Length.*?(\d+)",              # Direct application length
        r"Length of trench[\s\S]*?(\d+(?:\.\d+)?)\s*mtrs"  # Original pattern
    ]
    
    print("🔍 DEBUG: extract_application_length - Trying text patterns...")
    for i, pattern in enumerate(patterns):
        print(f"🔍 DEBUG: extract_application_length - Pattern {i+1}: {pattern}")
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result = match.group(1)
            print(f"✅ DEBUG: extract_application_length - Pattern {i+1} matched: '{result}'")
            return result
        else:
            print(f"❌ DEBUG: extract_application_length - Pattern {i+1} failed")
    
    # 3. Fallback: sum up all numbers after 'Length of trench' in text
    print("🔍 DEBUG: extract_application_length - Trying fallback pattern...")
    matches = re.findall(r"Length of trench[\s\S]*?(\d+(?:\.\d+)?)\s*mtrs", text, re.IGNORECASE)
    if matches:
        total = sum(float(m) for m in matches)
        result = str(int(total))
        print(f"✅ DEBUG: extract_application_length - Fallback matched: '{result}' (sum of {matches})")
        return result
    
    print("❌ DEBUG: extract_application_length - No patterns matched")
    return ""

def extract_application_date(text, table_dict=None):
    print("🔍 DEBUG: extract_application_date - Starting extraction...")
    
    import re
    from datetime import datetime
    if table_dict:
        print("🔍 DEBUG: extract_application_date - Trying table extraction...")
        val = extract_from_table(table_dict, [r"Date"])
        if val:
            print(f"🔍 DEBUG: extract_application_date - Found in table: '{val}'")
            # Try to parse and reformat if possible
            try:
                dt = datetime.strptime(val.strip(), "%d-%m-%Y")
                result = dt.strftime("%d-%m-%Y")
                print(f"✅ DEBUG: extract_application_date - Parsed from table: '{result}'")
                return result
            except Exception as e:
                print(f"⚠️ DEBUG: extract_application_date - Could not parse table date: {e}")
                print(f"✅ DEBUG: extract_application_date - Using table value as-is: '{val}'")
                return val
        else:
            print("❌ DEBUG: extract_application_date - Not found in table")
    
    print("🔍 DEBUG: extract_application_date - Trying text patterns...")
    
    # 1. Robust regex for 'Date' at the start of a line
    pattern1 = r"^\s*Date\s*[:\-]*\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})"
    print(f"🔍 DEBUG: extract_application_date - Pattern 1: {pattern1}")
    match = re.search(pattern1, text, re.IGNORECASE | re.MULTILINE)
    if match:
        date_str = match.group(1)
        date_str = re.sub(r"(st|nd|rd|th)", "", date_str)
        try:
            dt = datetime.strptime(date_str.strip(), "%d %B %Y")
            result = dt.strftime("%d-%m-%Y")
            print(f"✅ DEBUG: extract_application_date - Pattern 1 matched (full month): '{result}'")
            return result
        except Exception as e:
            print(f"⚠️ DEBUG: extract_application_date - Pattern 1 failed full month parse: {e}")
            try:
                dt = datetime.strptime(date_str.strip(), "%d %b %Y")
                result = dt.strftime("%d-%m-%Y")
                print(f"✅ DEBUG: extract_application_date - Pattern 1 matched (abbreviated month): '{result}'")
                return result
            except Exception as e2:
                print(f"⚠️ DEBUG: extract_application_date - Pattern 1 failed abbreviated month parse: {e2}")
                print(f"✅ DEBUG: extract_application_date - Using raw date: '{date_str.strip()}'")
                return date_str.strip()
    
    # 2. Backup: search first 10 lines for a date-like pattern
    print("🔍 DEBUG: extract_application_date - Trying first 10 lines pattern...")
    lines = text.splitlines()[:10]
    pattern2 = r"([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4})"
    print(f"🔍 DEBUG: extract_application_date - Pattern 2: {pattern2}")
    for i, line in enumerate(lines):
        print(f"🔍 DEBUG: extract_application_date - Checking line {i+1}: '{line[:50]}...'")
        m = re.search(pattern2, line)
        if m:
            date_str = m.group(1)
            date_str = re.sub(r"(st|nd|rd|th)", "", date_str)
            try:
                dt = datetime.strptime(date_str.strip(), "%d %B %Y")
                result = dt.strftime("%d-%m-%Y")
                print(f"✅ DEBUG: extract_application_date - Pattern 2 matched line {i+1} (full month): '{result}'")
                return result
            except Exception as e:
                print(f"⚠️ DEBUG: extract_application_date - Pattern 2 failed full month parse line {i+1}: {e}")
                try:
                    dt = datetime.strptime(date_str.strip(), "%d %b %Y")
                    result = dt.strftime("%d-%m-%Y")
                    print(f"✅ DEBUG: extract_application_date - Pattern 2 matched line {i+1} (abbreviated month): '{result}'")
                    return result
                except Exception as e2:
                    print(f"⚠️ DEBUG: extract_application_date - Pattern 2 failed abbreviated month parse line {i+1}: {e2}")
                    print(f"✅ DEBUG: extract_application_date - Using raw date from line {i+1}: '{date_str.strip()}'")
                    return date_str.strip()
    
    # 3. Fallback: try dd/mm/yyyy or dd-mm-yyyy
    print("🔍 DEBUG: extract_application_date - Trying dd/mm/yyyy pattern...")
    pattern3 = r"([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})"
    print(f"🔍 DEBUG: extract_application_date - Pattern 3: {pattern3}")
    match2 = re.search(pattern3, text)
    if match2:
        try:
            dt = datetime.strptime(match2.group(1), "%d/%m/%Y")
            result = dt.strftime("%d-%m-%Y")
            print(f"✅ DEBUG: extract_application_date - Pattern 3 matched (dd/mm/yyyy): '{result}'")
            return result
        except Exception as e:
            print(f"⚠️ DEBUG: extract_application_date - Pattern 3 failed dd/mm/yyyy parse: {e}")
            try:
                dt = datetime.strptime(match2.group(1), "%d-%m-%Y")
                result = dt.strftime("%d-%m-%Y")
                print(f"✅ DEBUG: extract_application_date - Pattern 3 matched (dd-mm-yyyy): '{result}'")
                return result
            except Exception as e2:
                print(f"⚠️ DEBUG: extract_application_date - Pattern 3 failed dd-mm-yyyy parse: {e2}")
                print(f"✅ DEBUG: extract_application_date - Using raw date: '{match2.group(1)}'")
                return match2.group(1)
    
    print("❌ DEBUG: extract_application_date - No patterns matched")
    return ""

def extract_from(text):
    # Look for "2.   Exact location of starting point", then colon, then value on next line
    match = re.search(
        r"2\.\s+Exact location of starting point\s*\n:\n([^\n\r]+)", text, re.IGNORECASE
    )
    return match.group(1).strip() if match else ""

def extract_to(text):
    # Look for "3.   Exact location of end point", then colon, then value on next line
    match = re.search(
        r"3\.\s+Exact location of end point\s*\n:\n([^\n\r]+)", text, re.IGNORECASE
    )
    return match.group(1).strip() if match else ""

def extract_authority(text):
    return "MCGM"

def extract_ward(text):
    # Look for a line with 'Commissioner' and 'Ward', and capture the word(s) before 'Ward'
    match = re.search(r"Commissioner\s+([A-Za-z ]+?)\s+Ward", text)
    return match.group(1).strip() if match else ""

def robust_application_table_parse(pdf_path):
    """
    Given a PDF path, extract the application table robustly for all non-MCGM authorities.
    Tries both lattice and stream, picks the best table, combines data rows, and prints the result.
    """
    tables_lattice = camelot.read_pdf(pdf_path, pages="1-end", flavor="lattice")
    tables_stream = camelot.read_pdf(pdf_path, pages="1-end", flavor="stream")
    all_tables = list(tables_lattice) + list(tables_stream)
    if not all_tables:
        return {}
    best_table = max([t for t in all_tables if t.df.shape[1] >= 5], key=lambda t: t.df.shape[1], default=None)
    if best_table is None:
        return {}
    df = best_table.df
    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')
    df = df.reset_index(drop=True)
    header_rows = df.iloc[:9] if len(df) > 9 else df
    data_rows = df.iloc[9:15] if len(df) > 9 else pd.DataFrame()
    
    header = []
    combined = []
    
    for col in df.columns:
        col_header = []
        for i in range(len(header_rows)):
            val = str(header_rows.iloc[i][col]).strip()
            if val and val != 'nan':
                col_header.append(val)
        header_text = ' '.join(col_header)
        header.append(header_text)
        
        # First try to extract directly from header if it contains complete info
        extracted_from_header = False
        import re
        header_patterns = [
            (r"Location\s+(.+)", "Location"),
            (r"Road Name\s+(.+)", "Road Name"),
            (r"Route Start\s+(.+)", "Route Start"),  # Extract full location from header
            (r"Route End\s+(.+)", "Route End"),    # Extract full location from header
            (r"(?:Open\s+)?Trench\s+Length.*?(\d+)", "Length"),
            (r"Total.*?Length.*?(\d+)", "Length"),
            (r"Number.*?(\d+)", "Number")
        ]
        
        col_vals = []
        for pattern, field_type in header_patterns:
            match = re.search(pattern, header_text, re.IGNORECASE | re.DOTALL)
            if match:
                extracted_text = match.group(1).strip()
                # Clean up newlines and extra spaces but preserve full text
                extracted_text = re.sub(r'\s+', ' ', extracted_text)
                extracted_text = re.sub(r'\n+', ' ', extracted_text)
                col_vals = [extracted_text.strip()]
                extracted_from_header = True
                break
        
        # Only try data rows if we didn't extract from header
        if not extracted_from_header and len(data_rows) > 0:
            col_vals = [str(data_rows.iloc[i][col]).strip() for i in range(len(data_rows))]
            col_vals = [v for v in col_vals if v and v != 'nan']
        
        combined.append(' '.join(col_vals) if col_vals else '')
    
    result = {h.replace('\n', ' ').replace('  ', ' ').strip(): v for h, v in zip(header, combined)}
    print("[UNIVERSAL APPLICATION TABLE HEADER]", header)
    print("[UNIVERSAL APPLICATION TABLE DATA]", combined)
    print("[UNIVERSAL APPLICATION TABLE PARSED]", result)
    return result

def extract_from_table(table_dict, field_patterns):
    """
    Given a table_dict (header: value), and a list of regex patterns for the field,
    return the first value that matches.
    """
    for header, value in table_dict.items():
        for pat in field_patterns:
            if re.search(pat, header, re.IGNORECASE):
                # Try to extract trailing number or text from header if value is empty
                if value.strip():
                    return value.strip()
                # If value is empty, try to extract from header using enhanced patterns
                enhanced_patterns = [
                    rf"{pat}\s+(.+?)(?=\s+\d|\s*$)",  # Pattern followed by content, stopping before numbers or end
                    rf"{pat}\s+(.+)",  # Pattern followed by any content
                    rf"(.+?)\s+{pat}",  # Content followed by pattern (reversed)
                    r"([A-Za-z0-9 ().\/-]+)$"  # Extract trailing content from header
                ]
                for enhanced_pat in enhanced_patterns:
                    m = re.search(enhanced_pat, header, re.IGNORECASE | re.DOTALL)
                    if m:
                        result = m.group(1).strip()
                        # Clean up newlines and extra spaces
                        result = re.sub(r'\s+', ' ', result)
                        result = re.sub(r'\n+', ' ', result)
                        # Filter out the pattern itself if it appears in the result
                        for filter_pat in field_patterns:
                            result = re.sub(filter_pat, '', result, flags=re.IGNORECASE).strip()
                        if result and result.lower() not in ['location', 'road name', 'route start', 'route end']:
                            return result
    return ""

# Updated field extraction using table first, then fallback to text

def extract_application_number(text, table_dict=None):
    print("🔍 DEBUG: extract_application_number - Starting extraction...")
    
    if table_dict:
        print("🔍 DEBUG: extract_application_number - Trying table extraction...")
        val = extract_from_table(table_dict, [r"Application Number", r"Reference"])
        if val:
            print(f"✅ DEBUG: extract_application_number - Found in table: '{val}'")
            return val
        else:
            print("❌ DEBUG: extract_application_number - Not found in table")
    
    # Enhanced patterns for application number extraction
    patterns = [
        r"Reference\s*[:\-]?\s*(.+?)(?=\n\n|\nSir|\nYou|\nThanking|$)",  # Full reference line
        r"Application\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)",
        r"Ref\.?\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)",
        r"([A-Za-z]+\/[A-Za-z0-9\-\/\_]+\/[0-9]{4}\-[0-9]{2}\/[A-Za-z0-9\-\/\_]+)"  # Pattern like Airtel/OSP/2025-26/OT/KDMC/...
    ]
    
    print("🔍 DEBUG: extract_application_number - Trying text patterns...")
    for i, pattern in enumerate(patterns):
        print(f"🔍 DEBUG: extract_application_number - Pattern {i+1}: {pattern}")
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result = match.group(1).strip()
            # Clean up the result
            result = re.sub(r'\s+', ' ', result)  # Replace multiple spaces with single space
            print(f"✅ DEBUG: extract_application_number - Pattern {i+1} matched: '{result}'")
            return result
        else:
            print(f"❌ DEBUG: extract_application_number - Pattern {i+1} failed")
    
    print("❌ DEBUG: extract_application_number - No patterns matched")
    return ""

def extract_application_length(text, table_dict=None):
    print("🔍 DEBUG: extract_application_length - Starting extraction...")
    
    # 1. Try table: look for 'Total Route Length' column
    if table_dict:
        print("🔍 DEBUG: extract_application_length - Trying table extraction...")
        val = extract_from_table(table_dict, [r"Total Route Length", r"Length.*\(HDD.*Open Trench.*\)", r"Total.*Length"])
        if val:
            print(f"🔍 DEBUG: extract_application_length - Found in table: '{val}'")
            # Extract number from the value
            match = re.search(r'(\d+)', val)
            if match:
                result = match.group(1)
                print(f"✅ DEBUG: extract_application_length - Extracted from table: '{result}'")
                return result
            print(f"✅ DEBUG: extract_application_length - Using table value as-is: '{val}'")
            return val
        else:
            print("❌ DEBUG: extract_application_length - Not found in table")
    
    # 2. Enhanced patterns for text extraction
    patterns = [
        r"require\s+(\d+)\s*Mtrs?\s+Open Trench",  # "require 365 Mtrs Open Trench"
        r"laying\s+(\d+)\s*Mtrs?\s+Open Trench",   # "laying 365 Mtrs Open Trench"
        r"Total Route Length.*?(\d+)",              # From table headers
        r"Reference[^\n\r]*?(\d{2,})\s*Mtrs",      # From reference line
        r"Application Length.*?(\d+)",              # Direct application length
        r"Length of trench[\s\S]*?(\d+(?:\.\d+)?)\s*mtrs"  # Original pattern
    ]
    
    print("🔍 DEBUG: extract_application_length - Trying text patterns...")
    for i, pattern in enumerate(patterns):
        print(f"🔍 DEBUG: extract_application_length - Pattern {i+1}: {pattern}")
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result = match.group(1)
            print(f"✅ DEBUG: extract_application_length - Pattern {i+1} matched: '{result}'")
            return result
        else:
            print(f"❌ DEBUG: extract_application_length - Pattern {i+1} failed")
    
    # 3. Fallback: sum up all numbers after 'Length of trench' in text
    print("🔍 DEBUG: extract_application_length - Trying fallback pattern...")
    matches = re.findall(r"Length of trench[\s\S]*?(\d+(?:\.\d+)?)\s*mtrs", text, re.IGNORECASE)
    if matches:
        total = sum(float(m) for m in matches)
        result = str(int(total))
        print(f"✅ DEBUG: extract_application_length - Fallback matched: '{result}' (sum of {matches})")
        return result
    
    print("❌ DEBUG: extract_application_length - No patterns matched")
    return ""

def extract_from(text, table_dict=None, pdf_path=None):
    # First try table_dict directly since table parsing now handles wrapped text correctly
    if table_dict:
        # Look for Route Start in the table_dict keys and return the value directly
        for key, value in table_dict.items():
            if re.search(r"Route Start", key, re.IGNORECASE) and value.strip():
                return value.strip()
    
    # Try robust table extraction by column index if pdf_path is provided
    if pdf_path:
        import camelot
        import pandas as pd
        tables_lattice = camelot.read_pdf(pdf_path, pages="1-end", flavor="lattice")
        tables_stream = camelot.read_pdf(pdf_path, pages="1-end", flavor="stream")
        all_tables = list(tables_lattice) + list(tables_stream)
        for table in all_tables:
            df = table.df.dropna(axis=1, how='all').dropna(axis=0, how='all').reset_index(drop=True)
            # Find column index for 'Route Start'
            for col in df.columns:
                header = ' '.join(str(df.iloc[i][col]).strip() for i in range(min(9, len(df))))
                if re.search(r"Route Start", header, re.IGNORECASE):
                    # Try to extract from header if data rows are empty
                    match = re.search(r"Route Start\s+(.+)", header, re.IGNORECASE)
                    if match:
                        return match.group(1).strip()
                    # Otherwise get from data rows - check multiple rows for wrapped text
                    vals = []
                    for i in range(9, min(20, len(df))):  # Extended range to capture wrapped text
                        cell_val = str(df.iloc[i][col]).strip()
                        if cell_val and cell_val != 'nan':
                            vals.append(cell_val)
                    if vals:
                        return ' '.join(vals)
    
    # Enhanced text patterns - capture full phrases including multiple words
    patterns = [
        r"Route Start\s+(.+?)(?=\n\n|\nRoute End|\n[A-Z][a-z]+:|\n\d+|$)",  # Capture until next section or end
        r"starting point\s*:?\s*(.+?)(?=\n|$)",
        r"From\s*:?\s*(.+?)(?=\n|$)",
        r"2\.\s+Exact location of starting point\s*\n:?\n?([^\-\n\r]+)"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result = match.group(1).strip()
            # Clean up the result but preserve full location names
            result = re.sub(r'\s+', ' ', result)  # Replace multiple spaces with single space
            result = re.sub(r'\n+', ' ', result)  # Replace newlines with space
            return result.strip()
    
    return ""

def extract_to(text, table_dict=None, pdf_path=None):
    # First try table_dict directly since table parsing now handles wrapped text correctly
    if table_dict:
        # Look for Route End in the table_dict keys and return the value directly
        for key, value in table_dict.items():
            if re.search(r"Route End", key, re.IGNORECASE) and value.strip():
                return value.strip()
    
    # Try robust table extraction by column index if pdf_path is provided
    if pdf_path:
        import camelot
        import pandas as pd
        tables_lattice = camelot.read_pdf(pdf_path, pages="1-end", flavor="lattice")
        tables_stream = camelot.read_pdf(pdf_path, pages="1-end", flavor="stream")
        all_tables = list(tables_lattice) + list(tables_stream)
        for table in all_tables:
            df = table.df.dropna(axis=1, how='all').dropna(axis=0, how='all').reset_index(drop=True)
            # Flexible header matching: both 'Route' and 'End' in header
            for col in df.columns:
                header = ' '.join(str(df.iloc[i][col]).strip() for i in range(min(9, len(df))))
                if re.search(r"Route", header, re.IGNORECASE) and re.search(r"End", header, re.IGNORECASE):
                    # Try to extract from header if data rows are empty
                    match = re.search(r"Route End\s+(.+)", header, re.IGNORECASE)
                    if match:
                        return match.group(1).strip()
                    # Otherwise get from data rows - check multiple rows for wrapped text
                    vals = []
                    for i in range(9, min(20, len(df))):  # Extended range to capture wrapped text
                        cell_val = str(df.iloc[i][col]).strip()
                        if cell_val and cell_val != 'nan':
                            vals.append(cell_val)
                    if vals:
                        return ' '.join(vals)
            # Fallback: any column with 'End' in header
            for col in df.columns:
                header = ' '.join(str(df.iloc[i][col]).strip() for i in range(min(9, len(df))))
                if re.search(r"End", header, re.IGNORECASE):
                    match = re.search(r"End\s+(.+)", header, re.IGNORECASE)
                    if match:
                        return match.group(1).strip()
                    # Check multiple rows for wrapped text
                    vals = []
                    for i in range(9, min(20, len(df))):  # Extended range to capture wrapped text
                        cell_val = str(df.iloc[i][col]).strip()
                        if cell_val and cell_val != 'nan':
                            vals.append(cell_val)
                    if vals:
                        return ' '.join(vals)
    
    # Enhanced text patterns - capture full phrases including multiple words
    patterns = [
        r"Route End\s+(.+?)(?=\n\n|\nOpen|\n[A-Z][a-z]+:|\n\d+|$)",  # Capture until next section or end
        r"end point\s*:?\s*(.+?)(?=\n|$)",
        r"To\s*:?\s*(.+?)(?=\n|$)",
        r"3\.\s+Exact location of end point\s*\n:?\n?([^\-\n\r]+)"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            result = match.group(1).strip()
            # Clean up the result but preserve full location names
            result = re.sub(r'\s+', ' ', result)  # Replace multiple spaces with single space
            result = re.sub(r'\n+', ' ', result)  # Replace newlines with space
            return result.strip()
    
    return ""

def extract_authority(text, table_dict=None):
    if table_dict:
        val = extract_from_table(table_dict, [r"Authority"])
        if val:
            return val
    
    # Enhanced patterns for authority extraction
    patterns = [
        r'falling in\s+([A-Za-z\s]+?)\s+Jurisdiction',  # "falling in KDMC Jurisdiction"
        r'Deputy Engineer,\s*\n([A-Za-z\s]+?)\s+Municipal Corporation',  # From addressee
        r'([A-Za-z\s]+?)\s+Municipal Corporation',  # Any Municipal Corporation
        r'Commissioner\s+([A-Za-z ]+?)\s+Ward',  # Commissioner X Ward
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result = match.group(1).strip()
            # Clean up common suffixes
            result = re.sub(r'\s+Municipal Corporation.*$', '', result, flags=re.IGNORECASE)
            return result
    
    # Fallback: try to extract from text
    match = re.search(r"Municipal Corporation,\s*\n([A-Za-z ]+)", text)
    return match.group(1).strip() if match else ""

def extract_ward(text, table_dict=None, pdf_path=None):
    # Try table first
    if pdf_path:
        import camelot
        import pandas as pd
        tables_lattice = camelot.read_pdf(pdf_path, pages="1-end", flavor="lattice")
        tables_stream = camelot.read_pdf(pdf_path, pages="1-end", flavor="stream")
        all_tables = list(tables_lattice) + list(tables_stream)
        for table in all_tables:
            df = table.df.dropna(axis=1, how='all').dropna(axis=0, how='all').reset_index(drop=True)
            # Find column index for 'Location'
            for col in df.columns:
                header = ' '.join(str(df.iloc[i][col]).strip() for i in range(min(9, len(df))))
                if re.search(r"Location", header, re.IGNORECASE):
                    # Try to extract from header
                    match = re.search(r"Location\s+(.+)", header, re.IGNORECASE)
                    if match:
                        return match.group(1).strip()
                    vals = [str(df.iloc[i][col]).strip() for i in range(9, min(15, len(df)))]
                    vals = [v for v in vals if v and v != 'nan']
                    if vals:
                        return ' '.join(vals)
    
    # Fallback to table_dict
    if table_dict:
        val = extract_from_table(table_dict, [r"Location"])
        if val:
            return val
    
    # Enhanced text patterns for ward extraction
    patterns = [
        r'(Zone-[^,]+,[^,]+Ward)',  # Zone-X, Nerul B Ward
        r'([A-Za-z\s]+Ward)',  # Any Ward
        r'Commissioner\s+([A-Za-z ]+?)\s+Ward',  # Commissioner X Ward
        r'Municipal Corporation[,\s]+([A-Za-z\s]+?)(?=\n|,)',  # After Municipal Corporation
        r'falling in\s+([A-Za-z\s]+?)\s+Jurisdiction',  # falling in KDMC Jurisdiction
        r'Deputy Engineer,\s*\n([A-Za-z\s]+?)\s+Municipal Corporation'  # From addressee
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result = match.group(1).strip()
            # Clean up common suffixes
            result = re.sub(r'\s+Municipal Corporation.*$', '', result, flags=re.IGNORECASE)
            return result
    
    return ""

def extract_road_name(text, table_dict=None):
    """
    Robustly extract the road name by searching for the pattern after 'Ward' and before 'Road' (including 'Road'),
    even if the name is split across multiple lines. Falls back to previous logic if not found.
    """
    # Try table first
    if table_dict:
        val = extract_from_table(table_dict, [r"Road Name"])
        if val:
            return val
    
    # Enhanced text patterns
    patterns = [
        r'Road Name\s+(.+?)(?=\n|$)',  # Direct Road Name extraction
        r'at\s+([A-Za-z\s]+?Road)',  # "at Thakurli Station Road"
        r'trench at\s+([A-Za-z\s]+?)(?=\s+area|\s+falling|\n|$)',  # "trench at Thakurli Station Road area"
        r'Open Trench at\s+([A-Za-z\s]+?)(?=\s+falling|\s+area|\n|$)',  # "Open Trench at X"
        r'Ward\s+([A-Za-z\s]+?Road)',  # Ward followed by road name
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            road_name = match.group(1).strip()
            # Clean up the result
            road_name = re.sub(r'\s+', ' ', road_name)  # Replace multiple spaces
            return road_name
    
    # Fallback to original multi-line logic
    lines = text.splitlines()
    road_name_lines = []
    found = False
    collecting = False
    for i, line in enumerate(lines):
        if found:
            if not collecting:
                if line.strip() == "":
                    continue  # skip empty lines after header
                else:
                    collecting = True  # start collecting from first non-empty line
            # Stop if we hit the next header or an empty line after collecting started
            if line.strip() == "" or "route start" in line.lower() or "route end" in line.lower() or "hdd length" in line.lower():
                break
            road_name_lines.append(line.strip())
        if "road name" in line.lower():
            found = True
    road_name = " ".join(road_name_lines).replace("  ", " ").strip().title()
    return road_name

def universal_application_parser(pdf_path):
    print("🔍 DEBUG: Starting universal application parser for:", pdf_path)
    
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()

    print("\n" + "="*80)
    print("📄 FULL EXTRACTED TEXT:")
    print("="*80)
    print(text)
    print("="*80)
    print("END OF EXTRACTED TEXT")
    print("="*80 + "\n")

    # Try robust table extraction first
    print("🔍 DEBUG: Attempting table extraction...")
    table_result = robust_application_table_parse(pdf_path)
    if table_result:
        print("✅ DEBUG: Table extraction successful!")
        print("📊 DEBUG: Table data:", table_result)
        
        # Extract all fields using table first, fallback to text
        print("\n🔍 DEBUG: Extracting fields with table data...")
        
        app_number = extract_application_number(text, table_result)
        print(f"📝 DEBUG: Application Number: '{app_number}'")
        
        app_length = extract_application_length(text, table_result)
        print(f"📏 DEBUG: Application Length: '{app_length}'")
        
        app_date = extract_application_date(text, table_result)
        print(f"📅 DEBUG: Application Date: '{app_date}'")
        
        from_location = extract_from(text, table_result, pdf_path)
        print(f"📍 DEBUG: From: '{from_location}'")
        
        to_location = extract_to(text, table_result, pdf_path)
        print(f"🎯 DEBUG: To: '{to_location}'")
        
        ward = extract_ward(text, table_result, pdf_path)
        print(f"🏛️ DEBUG: Ward: '{ward}'")
        
        road_name = extract_road_name(text, table_result)
        print(f"🛣️ DEBUG: Road Name: '{road_name}'")
        
        extracted = {
            "application_number": app_number,
            "application_length_mtr": app_length,
            "application_date": app_date,
            "from_location": from_location,
            "to_location": to_location,
            "ward": ward,
            "road_name": road_name
        }
        
        print("\n" + "="*80)
        print("📋 FINAL EXTRACTED DATA (WITH TABLE):")
        print("="*80)
        for key, value in extracted.items():
            print(f"{key}: '{value}'")
        print("="*80)
        
        return extracted

    # Fallback: Use text extraction
    print("⚠️ DEBUG: Table extraction failed, using text extraction...")
    print("\n🔍 DEBUG: Extracting fields from text only...")
    
    app_number = extract_application_number(text)
    print(f"📝 DEBUG: Application Number: '{app_number}'")
    
    app_length = extract_application_length(text)
    print(f"📏 DEBUG: Application Length: '{app_length}'")
    
    app_date = extract_application_date(text)
    print(f"📅 DEBUG: Application Date: '{app_date}'")
    
    from_location = extract_from(text)
    print(f"📍 DEBUG: From: '{from_location}'")
    
    to_location = extract_to(text)
    print(f"🎯 DEBUG: To: '{to_location}'")
    
    ward = extract_ward(text)
    print(f"🏛️ DEBUG: Ward: '{ward}'")
    
    road_name = extract_road_name(text)
    print(f"🛣️ DEBUG: Road Name: '{road_name}'")
    
    extracted = {
        "application_number": app_number,
        "application_length_mtr": app_length,
        "application_date": app_date,
        "from_location": from_location,
        "to_location": to_location,
        "ward": ward,
        "road_name": road_name
    }
    
    print("\n" + "="*80)
    print("📋 FINAL EXTRACTED DATA (TEXT ONLY):")
    print("="*80)
    for key, value in extracted.items():
        print(f"{key}: '{value}'")
    print("="*80)
    
    return extracted

if __name__ == "__main__":
    import sys
    pdf_path = sys.argv[1]
    print(universal_application_parser(pdf_path)) 