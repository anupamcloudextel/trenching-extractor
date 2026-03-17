#!/bin/bash
cd /root/trenching-extractor-fresh/backend
source venv/bin/activate
if [ -f "main.py" ]; then
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
else
    python -m uvicorn app:app --host 0.0.0.0 --port 8000
fi
