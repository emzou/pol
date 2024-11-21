const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const BASE_URL = 'https://archive.4plebs.org/pol/search/text/dei/type/op/start/2022-09-30/end/2024-11-01/page/'; // Base URL with page pattern
    const MAX_RETRIES = 3;

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit /537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();

    let pageNum = 1; // Start at the first page
    const allPostsInfo = {}; // Object to store scraped post data

    while (true) {
        let success = false;
        let retries = 0;
        let postCount = 0;

        while (retries < MAX_RETRIES && !success) {
            try {
                const url = `${BASE_URL}${pageNum}/`;
                console.log(`Navigating to ${url}...`);

                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(5000); // Allow time for the page to render

                // Debug selector: count matched post elements
                const postElementCount = await page.evaluate(() => {
                    return document.querySelectorAll('article.post').length; // Adjust selector based on the site's structure
                });

                console.log(`Page ${pageNum}: Found ${postElementCount} post elements.`);

                // Fetch relevant content from posts on the page
                const posts = await page.evaluate(() => {
                    const postElements = document.querySelectorAll('article.post'); // Adjust selector based on site structure
                    return Array.from(postElements).map(post => {
                        const header = post.querySelector('header');
                        const divText = post.querySelector('div.text');

                        return {
                            headerHTML: header ? header.outerHTML.trim() : null,
                            divTextHTML: divText ? divText.outerHTML.trim() : null
                        };
                    });
                });

                postCount = posts.length;
                console.log(`Page ${pageNum}: Extracted ${postCount} posts.`);
                
                // Save the data for this page
                allPostsInfo[`page_${pageNum}`] = posts;

                // If the current page has fewer than 25 posts, stop after this page
                if (postCount < 25) {
                    console.log(`Page ${pageNum} has less than 25 posts (${postCount}). Stopping after this page.`);
                    success = true;
                    break;
                }

                success = true;
            } catch (error) {
                retries++;
                console.log(`Error on page ${pageNum}, retry ${retries}: ${error.message}`);
                await page.waitForTimeout(3000); // Wait before retrying
            }
        }

        if (!success) {
            console.log(`Failed to fetch page ${pageNum} after ${MAX_RETRIES} retries. Stopping.`);
            break;
        }

        if (postCount < 25) {
            break; // Exit the loop since this is the last page with meaningful data
        }

        pageNum++; // Move to the next page
    }

    // Write the collected data to a JSON file
    fs.writeFileSync('dei_mention_thread_content_data.json', JSON.stringify(allPostsInfo, null, 2), 'utf8');
    console.log('All post data saved to dei_mentions_opcontent_data.json');

    await browser.close();
})();