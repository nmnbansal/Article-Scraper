const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const port = 3000;

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({ msg: "Server is up!" });
});

const scrapeMedium = async (query) => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    const searchUrl = `https://medium.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    const articles = await page.evaluate(() => {
      const articlesArray = [];
      const articleElements = document.querySelectorAll('article');

      articleElements.forEach((article) => {
        const titleElement = article.querySelector('h2');
        const authorElement = article.querySelector('p');
        const publishDateElement = article.querySelector('span');
        const urlElement = article.querySelector('div[data-href]');

        if (titleElement && authorElement && publishDateElement && urlElement) {
          articlesArray.push({
            title: titleElement.textContent.trim(),
            author: authorElement.textContent.trim(),
            publicationDate: publishDateElement.textContent.trim() || "Unknown date",
            link: urlElement.getAttribute('data-href')
          });
        }
      });

      return articlesArray.slice(0, 5);
    });

    await browser.close();
    return articles;
  } catch (error) {
    console.error("Error scraping Medium articles:", error);
    await browser.close();
    throw error;
  }
};

app.post("/scrape", async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const articles = await scrapeMedium(topic);
    const filePath = path.join(__dirname, 'articles.json');

    await fs.writeFile(filePath, JSON.stringify(articles, null, 2));

    res.json(articles);
  } catch (error) {
    console.error("Error scraping Medium articles:", error);
    res.status(500).json({ error: "Failed to scrape Medium articles" });
  }
});

app.get("/articles", async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'articles.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const articles = JSON.parse(fileContent);
    res.json(articles);
  } catch (error) {
    console.error("Error reading articles file:", error);
    res.status(500).json({ error: "Failed to read articles file" });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
