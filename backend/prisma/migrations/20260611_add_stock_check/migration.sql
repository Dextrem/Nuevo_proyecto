-- Add CHECK constraint to prevent negative stock
ALTER TABLE products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
