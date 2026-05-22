CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = TG_RELNAME AND column_name = 'updatedAt') THEN
    NEW."updatedAt" = NOW();
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = TG_RELNAME AND column_name = 'updated_at') THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;