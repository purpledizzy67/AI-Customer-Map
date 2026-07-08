import { scrapeDisboardViaApify } from "../src/lib/scrapers/apify";

async function main() {
  const result = await scrapeDisboardViaApify({
    keywords: ["saas"],
    maxPerKeyword: 5,
  });
  console.log("count", result.length);
  console.log(JSON.stringify(result.slice(0, 2), null, 2));
}

main().catch(console.error);
