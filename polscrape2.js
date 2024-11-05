const {chromium} = require ('playwright'); 
const fs = require('fs'); 

(async () => {
    const browser = await chromium.launch({headless: false}); 
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit /537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }); 
    const page = await context.newPage(); 

    let currentDate = "2022-11-01"; // not sure why it timed out at 11/1? link seems fine 
    const endDate = "2024-11-01"; 
    const maxRetries = 3;

    //date getter
    function getDateRange(dateStr) {
        const date = new Date(dateStr); 
        const start = new Date(date.setDate(date.getDate() - 1)).toISOString().split('T')[0]; 
        const end = new Date(date.setDate(date.getDate() + 2)).toISOString().split('T')[0]; 
        return {start, end}; 
    }

    //date incrementer
    function incrementDate(dateStr) {
        const date = new Date(dateStr); 
        date.setDate(date.getDate() + 1); 
        return date.toISOString().split('T')[0];
    }

    while (currentDate <= endDate) {
        const {start: startDate, end: endDateRange } = getDateRange(currentDate);
        console.log (`getting stuff from ${currentDate}`);

        let pageNum = 1;
        let allArticlesForDate = []; 
        let articlesFetched = 0;
        let retries= 0;
        let success =false;

        while (retries< maxRetries && success) 
        {
            try {

        while (true) {
            //go to url 
            await page.goto(`https://archive.4plebs.org/pol/search/text/DEI/start/${startDate}/end/${endDateRange}/page/${pageNum}`, { waitUntil: 'networkidle', timeout: 30000 });

            //wait
            await page.waitForTimeout(10000); 

            //get
            const articles = await page.$$eval('body.theme_default div.container-fluid > div[role="main"] > article.clearfix.thread > aside.posts article[data-doc-id]', elements => {
                return elements.map(el => el.innerText); // can i maybe get rid of the metadata abt images? maybe not worth messing with 
            });

            articlesFetched = articles.length; 
            if (articlesFetched === 0) {
                console.log(`nothing found on page ${pageNum} for ${currentDate}`); 
                break;
            }

            allArticlesForDate = allArticlesForDate.concat(articles); 

            console.log (`page ${pageNum} :fetched ${articlesFetched} articles for ${currentDate}`); 

            if (articlesFetched < 25) {
                console.log(`reached the end for ${currentDate} only ${articlesFetched} articles on page ${pageNum}`); 
                break; 
            }
            
            pageNum++; //next page
        }

        success = true;
    } catch (error) {
        retries++;
        console.log(`error with ${currentDate} retry ${retries}`)
        await page.waitForTimeout(3000); 
    }
}

    if (!success) { 
        console.log(`error with ${currentDate} after ${maxRetries}. moving on.`)
        currentDate = incrementDate(currentDate); 
        continue;
    }

        if (allArticlesForDate.length > 0) {
            const fileName = `${currentDate}_articles.txt`; 
            fs.writeFileSync (fileName, allArticlesForDate.join(`\n\n`), 'utf8'); 
            console.log (`saved ${allArticlesForDate.length} articles for ${currentDate} to ${fileName}`); 
        } else {
            console.log(`nothing found for ${currentDate} which means that somethings probably wrong LOL`); 
        }

        currentDate = incrementDate(currentDate); 
    }

    await browser.close(); 
})(); 