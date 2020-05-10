const puppeteer = require('puppeteer');
const chromium = require('chrome-aws-lambda');
const { Storage } = require('@google-cloud/storage');


function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

const getHighlights = async ()=>{
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.goto('https://www.goodreads.com/notes/114893734-maitham-deeb?ref=rnlp');
  await delay(5000)

  const books = await page.evaluate(async () => {
    let elements = document.getElementsByClassName('annotatedBookItem');
    elements = Array.from(elements)
    return elements.map((el)=>{
        const title = el.getElementsByClassName("annotatedBookItem__bookInfo__bookTitle")[0].textContent
        const author = el.getElementsByClassName("annotatedBookItem__bookInfo__bookAuthor")[0].textContent
        const link  = el.getElementsByClassName("annotatedBookItem__knhLink")[0].href
        const image = el.getElementsByClassName("annotatedBookItem__imageColumn")[0].children[0].currentSrc
        return {title,author,link,image}
    })
  })

  const getHighlights = async (link)=>{
    const newPage = await browser.newPage();
    await newPage.goto(link)
    await delay(2000)
    return await newPage.evaluate(()=>{
        let elements = document.getElementsByClassName('noteHighlightTextContainer__highlightContainer');
        elements = Array.from(elements)
        return elements.map((el)=>el.textContent.replace(/(\r\n|\n|\r)/gm, ""))
    })
  }

  const highlights = await Promise.all(books.map(async (el) => {
    const bookHighlights = await getHighlights(el.link)
    return {...el, highlights:bookHighlights}
  }))
  return highlights
 }


module.exports = async (req, res) => {
  
  const storage = new Storage(process.env.GCLOUD_CREDENTIALS);
  const highlights = await getHighlights()
  console.log(highlights)
  const bucket =  storage.bucket("maitham_io")
  var file = bucket.file('highlights.json');
  var buf = Buffer.from(JSON.stringify(highlights));
  await file.save(buf,{ metadata: { contentType: "application/json" }})
  res.status(200).send(JSON.stringify(highlights))
}
