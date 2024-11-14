const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
    const threadNumbers = fs.readFileSync('thread_jun22_sep23.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit /537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();
    const maxRetries = 3;
    const allThreadsData = {}; // Object to store all threads data

    for (const threadNumber of threadNumbers) {
        let allArticlesForThread = [];
        let retries = 0;
        let success = false;

        while (retries < maxRetries && !success) {
            try {
                const url = `https://archive.4plebs.org/pol/thread/${threadNumber}/#${threadNumber}`;
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(10000);

                const articlesOnPage = await page.$$eval('body.theme_default div.container-fluid > div[role="main"] > article.clearfix.thread > aside.posts article[data-doc-id]', elements =>
                    elements.map(el => el.innerText) // You can adjust this to collect other data if needed
                );

                if (articlesOnPage.length === 0) break;

                allArticlesForThread = allArticlesForThread.concat(articlesOnPage);
                console.log(`Thread ${threadNumber}: Fetched ${articlesOnPage.length} articles`);

                success = true;
            } catch (error) {
                retries++;
                console.log(`Error with thread ${threadNumber}, retry ${retries}`);
                await page.waitForTimeout(3000);
            }
        }

        if (allArticlesForThread.length > 0) {
            allThreadsData[threadNumber] = allArticlesForThread; // Store articles under the thread number
            console.log(`Saved ${allArticlesForThread.length} articles for thread ${threadNumber}`);
        } else {
            console.log(`No articles found for thread ${threadNumber}.`);
        }
    }

    // Write the collected data to a JSON file
    fs.writeFileSync('all_articles.json', JSON.stringify(allThreadsData, null, 2), 'utf8');
    console.log('All threads data saved to all_articles.json');

    await browser.close();
})();
