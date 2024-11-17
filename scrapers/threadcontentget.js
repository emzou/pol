const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const threadNumbers = fs.readFileSync('thread_jun22_sep23_0.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit /537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();
    const maxRetries = 3;
    const allThreadsInfo = {}; // Object to store thread-level information

    for (const threadNumber of threadNumbers) {
        let threadData = null;
        let retries = 0;
        let success = false;

        while (retries < maxRetries && !success) {
            try {
                const url = `https://archive.4plebs.org/pol/thread/${threadNumber}/`;
                console.log(`Navigating to ${url}...`);
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(5000); // Allow extra time for the page to render

                // Fetch both header and div.text content as HTML
                threadData = await page.evaluate(() => {
                    const headerElement = document.querySelector('body.theme_default div.container-fluid > div[role="main"] > article.clearfix.thread > header');
                    const divTextElement = document.querySelector('body.theme_default div.container-fluid > div[role="main"] > article.clearfix.thread > div.text');

                    return {
                        headerHTML: headerElement ? headerElement.outerHTML.trim() : null,
                        divTextHTML: divTextElement ? divTextElement.outerHTML.trim() : null
                    };
                });

                console.log(`Thread ${threadNumber}: Header and div.text fetched.`);
                success = true;
            } catch (error) {
                retries++;
                console.log(`Error with thread ${threadNumber}, retry ${retries}: ${error.message}`);
                await page.waitForTimeout(3000); // Wait before retrying
            }
        }

        if (threadData) {
            // Store the thread data under the thread number
            allThreadsInfo[threadNumber] = threadData;
            console.log(`Saved thread data for thread ${threadNumber}`);
        } else {
            console.log(`No thread data found for thread ${threadNumber}.`);
        }
    }

    // Write the collected thread data to a JSON file
    fs.writeFileSync('thread_jun22_sep23_0_data.json', JSON.stringify(allThreadsInfo, null, 2), 'utf8');
    console.log('All thread data saved to thread_jun22_sep23_0_data.json');

    await browser.close();
})();
