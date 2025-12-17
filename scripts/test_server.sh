#!/bin/bash
# Test server startup
echo "Testing server startup..."
npm run dev &
SERVER_PID=$!
sleep 3
kill $SERVER_PID 2>/dev/null
echo "Server test complete"
