#!/bin/bash
# Script to fix error.message access for unknown type errors

# Replace error.message with getErrorMessage(error) helper
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/error\.message || '\''Internal Server Error'\''/getErrorMessage(error) || '\''Internal Server Error'\''/g' \
  -e 's/error\.message || '\''Erro/getErrorMessage(error) || '\''Erro/g' \
  -e 's/error: error\.message/error: getErrorMessage(error)/g' \
  -e 's/message: error\.message/message: getErrorMessage(error)/g' \
  -e 's/err\.message/getErrorMessage(err)/g' \
  -e 's/setError(getErrorMessage(err))/setError(getErrorMessage(err))/g' \
  {} +

# Add import for getErrorMessage where needed
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "getErrorMessage" {} \; | while read file; do
  if ! grep -q "import.*getErrorMessage" "$file"; then
    sed -i '' "1i\\
import { getErrorMessage } from '@/types/errors';\\
" "$file"
  fi
done

echo "Fixed error.message access patterns"
