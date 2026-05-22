-- Migration script to add image fields to Product table
-- Run this script after updating the Prisma schema and before running prisma migrate dev

-- Add imageUrl and imagePath columns to the product table
ALTER TABLE "Product" 
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "imagePath" TEXT;

-- Create uploads directory if it doesn't exist (this should be done by the application startup)
-- But we can note it here for reference
-- mkdir -p uploads/products