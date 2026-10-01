-- Re-adds a per-product image_url.
--
-- 0001_schema.sql dropped products.image_url when price and stock moved onto
-- product_variants, leaving image_url on product_variants only. That is the
-- right slot for per-colourway photography, but not for a single shop image
-- picked per product: a product has 2-4 variants that would all repeat the
-- same picture.
--
-- Nullable and added back, so this is safe to re-run and safe for products that
-- have no photo yet — ProductImage falls back to the inline SVG artwork when
-- imageUrl is null.

begin;

alter table public.products add column if not exists image_url text;

comment on column public.products.image_url is
  'Primary shop image for the product. Null means fall back to the generated SVG artwork.';

commit;