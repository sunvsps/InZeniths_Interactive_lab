-- Language for emails and the checkout page (th / en)
ALTER TABLE "Gift" ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'th';
ALTER TABLE "Payment" ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'th';
