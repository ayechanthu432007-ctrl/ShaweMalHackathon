-- Housing agent boost price: 5,000 -> 5,500 MMK per day.
-- Only changes the value if it is still the original 5,000, so a price an admin set is kept.
UPDATE "AppSetting" SET "value" = '5500', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'BOOST_PRICE_PER_DAY_MMK' AND "value" = '5000';
