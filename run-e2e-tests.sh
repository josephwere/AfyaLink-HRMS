#!/bin/bash
set -e

# Kill any existing processes on target ports
echo "Cleaning up stale processes..."
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 2

echo "Starting backend server..."
cd backend
pnpm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Waiting for backend to be ready..."
for i in {1..60}; do
  if curl -s http://127.0.0.1:5000/api/health 2>&1 | grep -q '"ok":true'; then
    echo "✓ Backend ready"
    break
  fi
  echo "  Attempt $i/60..."
  sleep 1
done

echo "Starting frontend server..."
cd ../frontend
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "Waiting for frontend to be ready..."
for i in {1..60}; do
  if curl -s http://127.0.0.1:5173/index.html > /dev/null 2>&1; then
    echo "✓ Frontend ready"
    break
  fi
  echo "  Attempt $i/60..."
  sleep 1
done

echo ""
echo "================================"
echo "E2E Servers Ready"
echo "================================"
echo "Backend:  http://127.0.0.1:5000"
echo "Frontend: http://127.0.0.1:5173"
echo "Log files:"
echo "  /tmp/backend.log"
echo "  /tmp/frontend.log"
echo ""

# Clear stale auth
rm -rf test-results/.auth

echo "Running E2E tests..."
npx playwright test --reporter=html

echo ""
echo "Tests completed!"
echo "Report: frontend/playwright-report/index.html"
