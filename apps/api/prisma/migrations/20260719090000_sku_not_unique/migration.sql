-- SKUs in the source price list contain real duplicates (same code used for
-- multiple distinct catalog items) and blanks (to be filled in manually later),
-- so it can no longer be a unique key.
DROP INDEX IF EXISTS "products_sku_key";
