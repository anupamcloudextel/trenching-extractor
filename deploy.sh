#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /root/trenching-extractor-fresh

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Check if frontend needs rebuilding
echo "🔨 Checking if frontend needs rebuilding..."
if git diff HEAD~1 --name-only | grep -E "(frontend/|package\.json|tsconfig\.json|tailwind\.config\.ts|next\.config\.js)" > /dev/null; then
    echo "📦 Frontend changes detected, rebuilding..."
    cd frontend
    npm install --legacy-peer-deps
    npm run build
    cd ..
else
    echo "✅ No frontend changes detected, skipping rebuild"
fi

# Check if backend needs updating
echo "🐍 Checking if backend needs updating..."
if git diff HEAD~1 --name-only | grep -E "(backend/|requirements\.txt)" > /dev/null; then
    echo "📦 Backend changes detected, updating dependencies..."
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    echo "✅ No backend changes detected, skipping dependency update"
fi

# Restart PM2 services
echo "🔄 Restarting services..."
pm2 restart all

# Check status
echo "📊 Checking service status..."
pm2 status

echo "✅ Deployment complete!"
