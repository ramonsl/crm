-- Migration: Add profile_image column to leads table
-- Date: 2025-11-29
-- Purpose: Support WhatsApp profile picture sync functionality

-- Add profile_image column to store WhatsApp profile picture URLs
ALTER TABLE leads ADD COLUMN profile_image TEXT;

-- Verify the migration
SELECT 'Column profile_image added successfully' as result;
PRAGMA table_info(leads);
