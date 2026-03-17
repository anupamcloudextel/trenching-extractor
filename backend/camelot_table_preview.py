import camelot

pdf_path = r"C:\Users\SashwatRavishankar\TrenchExtractor\MCGM Type 1\testfile.PDF"
tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')  # switched to 'lattice'

print(f"Total tables extracted: {len(tables)}")
for i, table in enumerate(tables):
    print(f"\n--- Table {i+1} ---")
    if hasattr(table, 'df') and table.df is not None:
        print(table.df)
    else:
        print("No DataFrame extracted for this table.")
