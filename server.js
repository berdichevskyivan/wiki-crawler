const puppeteer = require('puppeteer');
const fs = require('fs');
const { BASE_URL, STARTING_URL } = require('./constants');
const { parse } = require('node-html-parser');

const uwords = require('uwords');

let globalWords = [];
let alreadyVisitedUrls = [];

const getLinksAndWords = async (browser, page, url) => {
    try{
        console.log(`Navigating to ${url}`);
        alreadyVisitedUrls.push(url);
        let currentLinks = [];

        await page.goto(url);

        // Now I want to retrieve every single link from the go there.
        let bodyHtml = await page.evaluate(()=>document.body.innerHTML);

        const parsedHTMLBody = parse(bodyHtml);

        const allLinks = parsedHTMLBody.querySelector('ul.mw-allpages-chunk').childNodes

        for(let i = 0 ; i < allLinks.length ; i++){
            const li = allLinks[i];
            if(li.childNodes.length > 0){
                let href = li.childNodes[0].rawAttrs.match(/href="([^"]*)/)[1];
                currentLinks.push(BASE_URL + href);
            }
        }

        // Now we have all the links in the page and all the words in such page

        console.log(currentLinks);

        for(const link of currentLinks){
            await page.goto(link);
            let bodyHtml = await page.evaluate(()=>document.body.innerHTML);

            const parsedHTMLBody = parse(bodyHtml);

            let mainHtmlContent = parsedHTMLBody.querySelector('div.mw-parser-output').innerHTML

            let wordsFound = uwords(mainHtmlContent).filter(word => /^[\u0590-\u05FF]*$/.test(word));

            wordsFound = wordsFound.filter(w=>w.length > 1);

            console.log(wordsFound);

            for(const word of wordsFound){
                let wordFound = globalWords.find(w => w.word === word);
                if(wordFound){
                    wordFound.count = wordFound.count + 1;
                }else{
                    globalWords.push({
                        word: word,
                        count: 1,
                    });
                }
            }
        }

        globalWords = globalWords.sort( (a,b) => ( a.count < b.count ) ? 1 : -1 );

        // Storing all the words
        fs.writeFile('./words/wordCount.json',JSON.stringify(globalWords,null,2),function(err){
            if(err)return console.log(err);
            console.log('Word count was stored...');
        })

        // now we need to go to next page and do the same, which is next page let's see
        
        const nextPageLinks = parsedHTMLBody.querySelector('div.mw-allpages-nav').childNodes;

        const nextPage = nextPageLinks[nextPageLinks.length-1];

        let href = decodeURI(nextPage.rawAttrs.match(/href="([^"]*)/)[1]).replace('amp;','');

        let nextPageUrl = BASE_URL + href;
        console.log(nextPageUrl);

        if(alreadyVisitedUrls.length < 10000){
            getLinksAndWords(browser, page, nextPageUrl);
        } else {
            await browser.close();
            console.log('Connection closed');
        }

    }catch(err){
        console.log(err);
    }
}

( async () => {
    try {

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        getLinksAndWords(browser, page, STARTING_URL);

    } catch (err) {
        console.log(err);
    }
})();
