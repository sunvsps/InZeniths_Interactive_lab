-- Custom link name chosen by a paying sender
ALTER TABLE "Gift" ADD COLUMN "alias" TEXT;
CREATE UNIQUE INDEX "Gift_alias_key" ON "Gift"("alias");
