-- Add per-shop attribution + order pagination cursor to Conversation
ALTER TABLE "Conversation" ADD COLUMN "shop" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "orderCursor" TEXT;

CREATE INDEX "Conversation_shop_idx" ON "Conversation"("shop");

-- Add Customer Account GraphQL endpoint URL alongside MCP URL
ALTER TABLE "CustomerAccountUrls" ADD COLUMN "graphqlApiUrl" TEXT;
