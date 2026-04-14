#!/usr/bin/env node

/**
 * News Tabloid Now - Satirical Article Generator
 *
 * Fetches trending news from RSS feeds, generates satirical articles
 * via Claude API, and publishes them as static HTML pages.
 *
 * Usage:
 *   node generate.js                    # Generate default number of articles
 *   node generate.js --dry-run          # Preview without writing files
 *   node generate.js --count 5          # Generate 5 articles
 *   node generate.js --category tech    # Generate tech articles only
 *   node generate.js --no-push          # Skip git push
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ARTICLES_PER_RUN = parseInt(process.env.ARTICLES_PER_RUN || '3', 10);

const RSS_FEEDS = [
  { name: 'Google News', url: 'https://news.google.com/rss' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'Reddit World News', url: 'https://www.reddit.com/r/worldnews/.rss' },
  { name: 'Reddit Technology', url: 'https://www.reddit.com/r/technology/.rss' },
  { name: 'Reddit Politics', url: 'https://www.reddit.com/r/politics/.rss' },
];

// Internal category IDs
const CATEGORIES = ['politics', 'pop-culture', 'tech', 'world', 'science', 'sports'];

// CSS class suffix for each category (no hyphen in popculture)
const CATEGORY_CSS = {
  'politics': 'politics',
  'pop-culture': 'popculture',
  'tech': 'tech',
  'world': 'world',
  'science': 'science',
  'sports': 'sports',
};

// Display labels
const CATEGORY_LABELS = {
  'politics': 'Politics',
  'pop-culture': 'Pop Culture',
  'tech': 'Tech',
  'world': 'World',
  'science': 'Science',
  'sports': 'Sports',
};

const AUTHORS = [
  'Chad Thunderpen',
  'Diana Clicksworth',
  'Pepper Scoop',
  'Rex Headliner',
  'Blaine Deadline',
];

// Author avatar background colors
const AUTHOR_COLORS = {
  'Chad Thunderpen': '#DC2626',
  'Diana Clicksworth': '#8B5CF6',
  'Pepper Scoop': '#059669',
  'Rex Headliner': '#D97706',
  'Blaine Deadline': '#0891B2',
};

const SITE_ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SITE_ROOT, 'articles');
const DATA_DIR = path.join(SITE_ROOT, 'data');
const CATEGORIES_DIR = path.join(SITE_ROOT, 'categories');
const ARTICLES_JSON = path.join(DATA_DIR, 'articles.json');
const INDEX_HTML = path.join(SITE_ROOT, 'index.html');
const HEADLINE_CACHE = path.join(__dirname, '.headline-cache.json');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_PUSH = args.includes('--no-push');

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

const COUNT = parseInt(getArgValue('--count') || ARTICLES_PER_RUN, 10);
const CATEGORY_FILTER = getArgValue('--category');

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(step, msg) {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  console.log(`[${timestamp}] [${step}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Step 1: Fetch trending news from RSS feeds
// ---------------------------------------------------------------------------

async function fetchHeadlines() {
  log('RSS', 'Fetching trending headlines from RSS feeds...');
  const parser = new RSSParser({
    timeout: 10000,
    headers: {
      'User-Agent': 'NewsTabloidNow/1.0 (RSS Reader)',
    },
  });

  const allHeadlines = [];

  for (const feed of RSS_FEEDS) {
    try {
      log('RSS', `  Fetching ${feed.name}...`);
      const result = await parser.parseURL(feed.url);
      const items = (result.items || []).slice(0, 15);
      for (const item of items) {
        allHeadlines.push({
          title: cleanTitle(item.title || ''),
          source: feed.name,
          link: item.link || '',
          pubDate: item.pubDate || '',
        });
      }
      log('RSS', `  Got ${items.length} headlines from ${feed.name}`);
    } catch (err) {
      log('RSS', `  WARN: Failed to fetch ${feed.name}: ${err.message}`);
    }
  }

  if (allHeadlines.length === 0) {
    log('RSS', 'No headlines from live feeds. Checking cache...');
    if (fs.existsSync(HEADLINE_CACHE)) {
      const cached = JSON.parse(fs.readFileSync(HEADLINE_CACHE, 'utf-8'));
      log('RSS', `Loaded ${cached.length} cached headlines`);
      return cached;
    }
    throw new Error('No headlines available and no cache found. Cannot proceed.');
  }

  // Deduplicate by similarity
  const deduped = deduplicateHeadlines(allHeadlines);
  log('RSS', `${deduped.length} unique headlines after deduplication`);

  // Cache headlines for fallback
  fs.writeFileSync(HEADLINE_CACHE, JSON.stringify(deduped, null, 2));

  return deduped;
}

function cleanTitle(title) {
  return title
    .replace(/\s*[-|]\s*(BBC News|Reuters|AP News|CNN|NPR).*$/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function deduplicateHeadlines(headlines) {
  const seen = new Set();
  const result = [];

  for (const h of headlines) {
    const normalized = h.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const words = normalized.split(' ');
    let isDuplicate = false;

    for (const existing of seen) {
      const existingWords = existing.split(' ');
      const overlap = words.filter((w) => existingWords.includes(w)).length;
      const similarity = overlap / Math.max(words.length, existingWords.length);
      if (similarity > 0.6) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate && normalized.length > 10) {
      seen.add(normalized);
      result.push(h);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 2: Generate satirical articles via Claude API
// ---------------------------------------------------------------------------

async function generateArticles(headlines, count, categoryFilter) {
  log('API', `Generating ${count} satirical article(s)...`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const headlineText = headlines
    .slice(0, 40)
    .map((h, i) => `${i + 1}. ${h.title} (via ${h.source})`)
    .join('\n');

  const categoryInstruction = categoryFilter
    ? `\nIMPORTANT: All articles MUST be in the "${categoryFilter}" category.`
    : '';

  const systemPrompt = `You are the senior editorial AI for "News Tabloid Now" -- the internet's most respected fake news outlet. You write satirical news articles in a deadpan journalistic style, treating completely absurd premises with the utmost seriousness.

VOICE AND STYLE:
- Deadpan. You are a Pulitzer-caliber journalist reporting on insane things with total sincerity.
- Think: The Onion meets Babylon Bee. Dry, sharp, devastating.
- PG-13 content. Adult humor and dark humor are welcome. No explicit sexual content.
- Political satire must mock ALL sides equally. No partisan lean whatsoever.
- Every article must be GENUINELY funny, not just random-for-the-sake-of-random.
- Include fake expert quotes with ridiculous credentials (e.g., "Dr. Harrison Welt, Chair of Predictive Sandwich Studies at MIT")
- Include fake statistics that sound plausible at first glance (e.g., "According to a Gallup poll, 73% of Americans have never read a terms-of-service agreement, including 41% who admit to having signed one in the last hour")
- Use <div class="editors-note"><strong>[CORRECTION]</strong> text</div> or <div class="editors-note"><strong>Editor's Note:</strong> text</div> as humor devices when they add to the joke
- Use <blockquote class="pull-quote">text</blockquote> for dramatic one-liner pull quotes
- NEVER use emojis. Not one. Zero.
- NEVER use em dashes (the long dash character). Use commas, semicolons, parentheses, or restructure sentences instead.
- Article length: 800-1200 words of body content

AUTHORS (randomly assign one per article):
- Chad Thunderpen
- Diana Clicksworth
- Pepper Scoop
- Rex Headliner
- Blaine Deadline

CATEGORIES (pick the most fitting):
- politics (government, elections, policy, legislation)
- pop-culture (entertainment, celebrities, social media, viral trends)
- tech (technology, AI, apps, gadgets, Silicon Valley)
- world (international affairs, diplomacy, global events)
- science (research, studies, space, environment, health)
- sports (athletics, leagues, competitions, fitness)

OUTPUT FORMAT:
Return a JSON array of article objects. Each object must have these exact fields:
{
  "headline": "The main headline (catchy, punchy, max 120 chars)",
  "subheadline": "A one-line deck/subheadline that adds context or another joke (max 200 chars)",
  "category": "one of the categories listed above",
  "author": "one of the authors listed above",
  "content": "The full article body as HTML. Use <p>, <h2>, <blockquote>, <div class=\\"editors-note\\"> tags. No <script> tags. Wrap fake quotes in <blockquote> tags. For dramatic pull quotes use <blockquote class=\\"pull-quote\\">.",
  "excerpt": "A 1-2 sentence teaser for the article (max 200 chars)",
  "readTime": estimated_minutes_as_integer
}

IMPORTANT: Return ONLY the JSON array. No markdown code fences. No preamble. Just the raw JSON.${categoryInstruction}`;

  const userPrompt = `Here are today's real trending headlines. Generate ${count} satirical articles inspired by these topics. Each article should take a real topic and spin it into absurdist territory while remaining topical and sharp.

TRENDING HEADLINES:
${headlineText}

Generate ${count} articles now. Return only the JSON array.`;

  let response;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      log('API', `  Calling Claude API (attempt ${attempts}/${maxAttempts})...`);
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      break;
    } catch (err) {
      log('API', `  ERROR: API call failed: ${err.message}`);
      if (attempts >= maxAttempts) throw err;
      log('API', '  Retrying in 3 seconds...');
      await sleep(3000);
    }
  }

  const text = response.content[0].text.trim();

  // Parse JSON, handling possible markdown fences
  let articles;
  try {
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    articles = JSON.parse(jsonStr);
  } catch (err) {
    log('API', '  ERROR: Failed to parse API response as JSON');
    log('API', `  Response preview: ${text.substring(0, 500)}`);
    throw new Error('Claude API returned invalid JSON. Response: ' + text.substring(0, 200));
  }

  if (!Array.isArray(articles)) {
    throw new Error('Expected JSON array of articles, got: ' + typeof articles);
  }

  log('API', `  Generated ${articles.length} article(s) successfully`);

  // Validate and clean each article
  const today = new Date().toISOString().split('T')[0];
  return articles.map((article, i) => {
    const slug = generateSlug(article.headline);
    return {
      headline: article.headline || `Untitled Article ${i + 1}`,
      subheadline: article.subheadline || '',
      category: CATEGORIES.includes(article.category) ? article.category : 'world',
      author: AUTHORS.includes(article.author) ? article.author : AUTHORS[Math.floor(Math.random() * AUTHORS.length)],
      content: sanitizeContent(article.content || '<p>Article content unavailable.</p>'),
      excerpt: (article.excerpt || '').substring(0, 200),
      readTime: parseInt(article.readTime, 10) || 4,
      slug: slug,
      date: today,
      filename: `${today}-${slug}.html`,
      url: `/articles/${today}-${slug}.html`,
    };
  });
}

function generateSlug(headline) {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)
    .replace(/-$/, '');
}

function sanitizeContent(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

// ---------------------------------------------------------------------------
// Shared HTML fragments (matching the existing site design exactly)
// ---------------------------------------------------------------------------

function headerHtml(pathPrefix) {
  // pathPrefix: '' for root, '../' for subpages
  const p = pathPrefix;
  return `  <a href="#main-content" class="skip-nav">Skip to main content</a>

  <!-- Top Bar -->
  <div class="top-bar">
    <div class="container">
      <time class="top-bar__date" datetime="${new Date().toISOString().split('T')[0]}">${formatDateLong(new Date())}</time>
      <button class="theme-toggle" aria-label="Toggle dark and light mode">
        <span class="theme-toggle__icon" aria-hidden="true">&#9790;</span>
        <span class="theme-toggle__label">Light Mode</span>
      </button>
    </div>
  </div>

  <!-- Masthead -->
  <header class="masthead">
    <div class="container">
      <a href="${p}index.html">
        <h1 class="masthead__title">NEWS TABLOID NOW</h1>
      </a>
      <p class="masthead__tagline">Seriously Hilarious. Unbelievably True.</p>
      <div class="masthead__accent-line" aria-hidden="true"></div>
    </div>
  </header>

  <!-- Navigation -->
  <nav class="main-nav" aria-label="Main navigation">
    <div class="container">
      <button class="hamburger" aria-label="Open navigation menu" aria-expanded="false" aria-controls="nav-links">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="nav-links" id="nav-links" role="menubar">
        <a href="${p}categories/politics.html" role="menuitem">Politics</a>
        <a href="${p}categories/pop-culture.html" role="menuitem">Pop Culture</a>
        <a href="${p}categories/tech.html" role="menuitem">Tech</a>
        <a href="${p}categories/world.html" role="menuitem">World</a>
        <a href="${p}categories/science.html" role="menuitem">Science</a>
        <a href="${p}categories/sports.html" role="menuitem">Sports</a>
      </div>
    </div>
  </nav>`;
}

function footerHtml(pathPrefix) {
  const p = pathPrefix;
  return `  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer__grid">

        <div class="footer__section">
          <h3 class="footer__section-title">About</h3>
          <p class="footer__about-text">News Tabloid Now is the internet's most trusted source of completely fabricated news. We believe in the power of satire to make you laugh, think, and wonder if maybe our version of events is actually more plausible than what's really happening.</p>
        </div>

        <div class="footer__section">
          <h3 class="footer__section-title">Categories</h3>
          <div class="footer__links">
            <a href="${p}categories/politics.html">Politics</a>
            <a href="${p}categories/pop-culture.html">Pop Culture</a>
            <a href="${p}categories/tech.html">Tech</a>
            <a href="${p}categories/world.html">World</a>
            <a href="${p}categories/science.html">Science</a>
            <a href="${p}categories/sports.html">Sports</a>
          </div>
        </div>

        <div class="footer__section">
          <h3 class="footer__section-title">Follow Us</h3>
          <div class="footer__links">
            <a href="#" aria-label="Twitter">Twitter / X</a>
            <a href="#" aria-label="Facebook">Facebook</a>
            <a href="#" aria-label="Instagram">Instagram</a>
            <a href="#" aria-label="Reddit">Reddit</a>
          </div>
        </div>

        <div class="footer__section">
          <h3 class="footer__section-title">Legal</h3>
          <div class="footer__links">
            <a href="${p}about.html">About Us</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="${p}about.html#contact">Contact</a>
          </div>
        </div>

      </div>

      <div class="footer__bottom">
        <span>Copyright ${new Date().getFullYear()} News Tabloid Now. All rights reserved. None of this is real.</span>
        <span>Built by <a href="https://forgedev.studio" target="_blank" rel="noopener noreferrer">Forge Dev.studio</a></span>
      </div>
    </div>
  </footer>

  <!-- Back to Top -->
  <button class="back-to-top" aria-label="Back to top" title="Back to top">&#8593;</button>`;
}

// ---------------------------------------------------------------------------
// Step 3: Build HTML article pages
// ---------------------------------------------------------------------------

function buildArticlePage(article) {
  const catCss = CATEGORY_CSS[article.category] || 'world';
  const catLabel = CATEGORY_LABELS[article.category] || 'World';
  const formattedDate = formatDate(article.date);
  const initial = article.author.charAt(0);
  const avatarColor = AUTHOR_COLORS[article.author] || '#DC2626';
  const articleUrl = `https://newstabloidnow.com/articles/${article.filename}`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.headline)} - News Tabloid Now</title>
  <meta name="description" content="${escapeHtml(article.excerpt)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${articleUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(article.headline)}">
  <meta property="og:description" content="${escapeHtml(article.excerpt)}">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:site_name" content="News Tabloid Now">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.headline)}">
  <meta name="twitter:description" content="${escapeHtml(article.excerpt)}">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">

  <!-- Styles -->
  <link rel="stylesheet" href="../css/styles.css">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": ${JSON.stringify(article.headline)},
    "description": ${JSON.stringify(article.excerpt)},
    "datePublished": "${article.date}",
    "author": {
      "@type": "Person",
      "name": ${JSON.stringify(article.author)}
    },
    "publisher": {
      "@type": "Organization",
      "name": "News Tabloid Now",
      "url": "https://newstabloidnow.com"
    },
    "mainEntityOfPage": "${articleUrl}",
    "genre": "Satire"
  }
  </script>
</head>
<body>

${headerHtml('../')}

  <!-- Main Content -->
  <main id="main-content">

    <!-- Article Hero -->
    <div class="article-hero">
      <div class="gradient-img gradient-img--${catCss}" role="img" aria-label="${catLabel} illustration"></div>
    </div>

    <!-- Article Header -->
    <div class="article-header">
      <div class="article-header__inner">
        <span class="category-tag category-tag--${catCss}">${catLabel}</span>
        <h1 class="article-header__headline">${escapeHtml(article.headline)}</h1>
        <p class="article-header__deck">${escapeHtml(article.subheadline)}</p>

        <div class="article-meta">
          <div class="article-meta__avatar" style="background: ${avatarColor}">${initial}</div>
          <div class="article-meta__info">
            <span class="article-meta__author">${escapeHtml(article.author)}</span>
            <span class="article-meta__details">${formattedDate} / ${article.readTime} min read</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Buttons -->
    <div class="article-body">
      <div class="share-buttons">
        <button class="share-btn share-btn--twitter" aria-label="Share on Twitter">Twitter / X</button>
        <button class="share-btn share-btn--facebook" aria-label="Share on Facebook">Facebook</button>
        <button class="share-btn share-btn--reddit" aria-label="Share on Reddit">Reddit</button>
        <button class="share-btn share-btn--copy" aria-label="Copy link">Copy Link</button>
      </div>
    </div>

    <!-- Article Body -->
    <div class="article-body">
      ${article.content}

      <div class="disclaimer">
        <p>This is a satirical article. All quotes, statistics, and expert credentials are entirely fictional. Any resemblance to actual events is purely for comedic purposes. If you believed any of this, we are both flattered and concerned.</p>
      </div>
    </div>

    <!-- Related Articles -->
    <section class="related-articles">
      <div class="section-header">
        <h2 class="section-header__title">More Nonsense</h2>
        <div class="section-header__line" aria-hidden="true"></div>
      </div>
      <div class="related-articles__grid" id="related-articles">
        <!-- Populated by JS or at build time -->
      </div>
    </section>

  </main>

${footerHtml('../')}

  <script src="../js/main.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Step 4: Update the homepage
// ---------------------------------------------------------------------------

function buildHomepage(articles) {
  // articles = full list newest-first, capped at 20
  const featured = articles[0];
  const sideStories = articles.slice(1, 4);
  const trendingArticles = articles.slice(0, 4);
  const latestArticles = articles.slice(0, 20);
  const tickerItems = articles.slice(0, 6);

  const featuredCss = CATEGORY_CSS[featured.category] || 'world';
  const featuredLabel = CATEGORY_LABELS[featured.category] || 'World';

  // Side stories
  const sideStoriesHtml = sideStories.map((a) => {
    const css = CATEGORY_CSS[a.category] || 'world';
    const label = CATEGORY_LABELS[a.category] || 'World';
    return `            <a href="articles/${a.filename}" class="hero__side-story">
              <div class="hero__side-img gradient-img gradient-img--${css}" role="img" aria-label="${label} illustration"></div>
              <div class="hero__side-content">
                <span class="category-tag category-tag--${css}">${label}</span>
                <h3 class="hero__side-headline">${escapeHtml(a.headline)}</h3>
                <p class="hero__side-meta">${escapeHtml(a.author)} / ${a.readTime} min</p>
              </div>
            </a>`;
  }).join('\n\n');

  // Trending cards
  const trendingHtml = trendingArticles.map((a) => {
    const css = CATEGORY_CSS[a.category] || 'world';
    const label = CATEGORY_LABELS[a.category] || 'World';
    return `          <a href="articles/${a.filename}" class="trending-card">
            <div class="trending-card__img">
              <div class="gradient-img gradient-img--${css}" role="img" aria-label="${label} illustration"></div>
            </div>
            <div class="trending-card__body">
              <span class="category-tag category-tag--${css}">${label}</span>
              <h3 class="trending-card__headline">${escapeHtml(a.headline)}</h3>
              <p class="trending-card__meta">${escapeHtml(a.author)} / ${a.readTime} min read</p>
            </div>
          </a>`;
  }).join('\n\n');

  // Latest article cards
  const latestHtml = latestArticles.map((a) => {
    const css = CATEGORY_CSS[a.category] || 'world';
    const label = CATEGORY_LABELS[a.category] || 'World';
    return `          <a href="articles/${a.filename}" class="article-card">
            <div class="article-card__img">
              <div class="gradient-img gradient-img--${css}" role="img" aria-label="${label} illustration"></div>
            </div>
            <div class="article-card__body">
              <span class="category-tag category-tag--${css}">${label}</span>
              <h3 class="article-card__headline">${escapeHtml(a.headline)}</h3>
              <p class="article-card__excerpt">${escapeHtml(a.excerpt)}</p>
              <div class="article-card__footer">
                <span>${escapeHtml(a.author)}</span>
                <span>${a.readTime} min read</span>
              </div>
            </div>
          </a>`;
  }).join('\n\n');

  // Ticker
  const tickerHtml = tickerItems.map((a) =>
    `        <span class="breaking-ticker__item">${escapeHtml(a.headline)}</span>
        <span class="breaking-ticker__separator" aria-hidden="true">|</span>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>News Tabloid Now - Seriously Hilarious. Unbelievably True.</title>
  <meta name="description" content="News Tabloid Now is the internet's most trusted source of satirical news. Deadpan journalism meets absurdist humor.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://newstabloidnow.com/">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="News Tabloid Now - Seriously Hilarious. Unbelievably True.">
  <meta property="og:description" content="The internet's most trusted source of satirical news. Deadpan journalism meets absurdist humor.">
  <meta property="og:url" content="https://newstabloidnow.com/">
  <meta property="og:site_name" content="News Tabloid Now">
  <meta property="og:locale" content="en_US">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="News Tabloid Now - Seriously Hilarious. Unbelievably True.">
  <meta name="twitter:description" content="The internet's most trusted source of satirical news. Deadpan journalism meets absurdist humor.">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">

  <!-- Styles -->
  <link rel="stylesheet" href="css/styles.css">

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "name": "News Tabloid Now",
    "url": "https://newstabloidnow.com",
    "description": "The internet's most trusted source of satirical news.",
    "foundingDate": "2026",
    "sameAs": [],
    "logo": {
      "@type": "ImageObject",
      "url": "https://newstabloidnow.com/images/logo.png"
    }
  }
  </script>
</head>
<body>

${headerHtml('')}

  <!-- Breaking News Ticker -->
  <div class="breaking-ticker" aria-label="Breaking news ticker">
    <span class="breaking-ticker__label" aria-hidden="true">BREAKING</span>
    <div class="breaking-ticker__track">
      <div class="breaking-ticker__content">
${tickerHtml}
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <main id="main-content">

    <!-- Hero Section -->
    <section class="hero" aria-label="Featured stories">
      <div class="container">
        <div class="hero__grid">

          <!-- Featured Article -->
          <div class="hero__featured">
            <a href="articles/${featured.filename}" class="hero__featured-link">
              <div class="gradient-img gradient-img--${featuredCss}" role="img" aria-label="${featuredLabel} illustration"></div>
              <div class="hero__featured-content">
                <span class="category-tag category-tag--${featuredCss}">${featuredLabel}</span>
                <h2 class="hero__featured-headline">${escapeHtml(featured.headline)}</h2>
                <p class="hero__featured-excerpt">${escapeHtml(featured.excerpt)}</p>
                <div class="hero__featured-meta">
                  <span>${escapeHtml(featured.author)}</span>
                  <span>${featured.readTime} min read</span>
                  <span>${formatDate(featured.date)}</span>
                </div>
              </div>
            </a>
          </div>

          <!-- Sidebar Stories -->
          <aside class="hero__sidebar">
${sideStoriesHtml}
          </aside>

        </div>
      </div>
    </section>

    <!-- Trending Now -->
    <section class="trending" aria-label="Trending stories">
      <div class="container">
        <div class="section-header">
          <h2 class="section-header__title">Trending Now</h2>
          <div class="section-header__line" aria-hidden="true"></div>
        </div>
        <div class="trending__grid">

${trendingHtml}

        </div>
      </div>
    </section>

    <!-- Latest Articles -->
    <section class="latest" aria-label="Latest articles">
      <div class="container">
        <div class="section-header">
          <h2 class="section-header__title">Latest</h2>
          <div class="section-header__line" aria-hidden="true"></div>
        </div>
        <div class="latest__grid">

${latestHtml}

        </div>
      </div>
    </section>

    <!-- Newsletter -->
    <section class="newsletter" aria-label="Newsletter signup">
      <div class="container">
        <h2 class="newsletter__title">Get the Nonsense Delivered Fresh</h2>
        <p class="newsletter__subtitle">Join 47 readers who can't look away. New satirical takes every weekday.</p>
        <form class="newsletter__form" aria-label="Newsletter subscription form">
          <label for="newsletter-email" class="sr-only">Email address</label>
          <input type="email" id="newsletter-email" class="newsletter__input" placeholder="your@email.com" required aria-label="Enter your email address">
          <button type="submit" class="newsletter__button">Subscribe</button>
        </form>
        <p class="newsletter__disclaimer">We promise to only spam you with the truth. The very, very fake truth.</p>
        <p class="newsletter__success" aria-live="polite"></p>
      </div>
    </section>

  </main>

${footerHtml('')}

  <script src="js/main.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Step 5: Update category pages
// ---------------------------------------------------------------------------

function buildCategoryPage(category, articles) {
  const catCss = CATEGORY_CSS[category] || 'world';
  const catLabel = CATEGORY_LABELS[category] || 'World';
  const catArticles = articles.filter((a) => a.category === category);

  const articleCards = catArticles.map((a) => {
    const css = CATEGORY_CSS[a.category] || 'world';
    const label = CATEGORY_LABELS[a.category] || 'World';
    return `          <a href="../articles/${a.filename}" class="article-card">
            <div class="article-card__img">
              <div class="gradient-img gradient-img--${css}" role="img" aria-label="${label} illustration"></div>
            </div>
            <div class="article-card__body">
              <span class="category-tag category-tag--${css}">${label}</span>
              <h3 class="article-card__headline">${escapeHtml(a.headline)}</h3>
              <p class="article-card__excerpt">${escapeHtml(a.excerpt)}</p>
              <div class="article-card__footer">
                <span>${escapeHtml(a.author)}</span>
                <span>${a.readTime} min read</span>
              </div>
            </div>
          </a>`;
  }).join('\n\n');

  const noArticlesMsg = catArticles.length === 0
    ? '          <p style="color: var(--text-secondary); font-size: 1.1rem; grid-column: 1 / -1; text-align: center; padding: 3rem 0;">No articles in this category yet. Our writers are probably on strike again.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${catLabel} - News Tabloid Now</title>
  <meta name="description" content="The latest satirical ${catLabel.toLowerCase()} news from News Tabloid Now.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://newstabloidnow.com/categories/${category}.html">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${catLabel} - News Tabloid Now">
  <meta property="og:description" content="The latest satirical ${catLabel.toLowerCase()} news from News Tabloid Now.">
  <meta property="og:url" content="https://newstabloidnow.com/categories/${category}.html">
  <meta property="og:site_name" content="News Tabloid Now">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">

  <!-- Styles -->
  <link rel="stylesheet" href="../css/styles.css">
</head>
<body>

${headerHtml('../')}

  <!-- Main Content -->
  <main id="main-content">

    <!-- Category Hero -->
    <div class="category-hero">
      <div class="gradient-img gradient-img--${catCss}" role="img" aria-label="${catLabel} illustration"></div>
      <div class="category-hero__overlay">
        <div class="container">
          <h1 class="category-hero__title">${catLabel}</h1>
          <p class="category-hero__subtitle">The finest fabricated ${catLabel.toLowerCase()} coverage on the internet.</p>
        </div>
      </div>
    </div>

    <!-- Articles -->
    <section class="latest" aria-label="${catLabel} articles">
      <div class="container">
        <div class="section-header">
          <h2 class="section-header__title">All ${catLabel} Articles</h2>
          <div class="section-header__line" aria-hidden="true"></div>
        </div>
        <div class="latest__grid">

${articleCards || noArticlesMsg}

        </div>
      </div>
    </section>

  </main>

${footerHtml('../')}

  <script src="../js/main.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Step 6: Update articles.json manifest
// ---------------------------------------------------------------------------

function loadArticlesManifest() {
  if (fs.existsSync(ARTICLES_JSON)) {
    try {
      return JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveArticlesManifest(articles) {
  const manifest = articles.map((a) => ({
    headline: a.headline,
    subheadline: a.subheadline,
    slug: a.slug,
    filename: a.filename,
    url: a.url,
    date: a.date,
    category: a.category,
    author: a.author,
    excerpt: a.excerpt,
    readTime: a.readTime,
  }));
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(manifest, null, 2));
}

// ---------------------------------------------------------------------------
// Step 7: Git commit and push
// ---------------------------------------------------------------------------

function gitCommitAndPush(articleCount) {
  const date = new Date().toISOString().split('T')[0];
  const message = `content: add ${articleCount} new articles - ${date}`;

  try {
    log('GIT', 'Staging changes...');
    execSync('git add articles/ data/ categories/ index.html', {
      cwd: SITE_ROOT,
      stdio: 'pipe',
    });

    log('GIT', `Committing: "${message}"`);
    execSync(`git commit -m "${message}"`, {
      cwd: SITE_ROOT,
      stdio: 'pipe',
    });

    if (!NO_PUSH) {
      log('GIT', 'Pushing to origin main...');
      execSync('git push origin main', {
        cwd: SITE_ROOT,
        stdio: 'pipe',
      });
      log('GIT', 'Push complete');
    } else {
      log('GIT', 'Skipping push (--no-push flag set)');
    }
  } catch (err) {
    log('GIT', `WARN: Git operation failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDateLong(dateObj) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  console.log('==============================================');
  console.log('  NEWS TABLOID NOW - Content Generator');
  console.log('==============================================');
  console.log('');

  if (DRY_RUN) log('INIT', 'DRY RUN MODE - no files will be written');
  if (NO_PUSH) log('INIT', 'No-push mode enabled');
  if (CATEGORY_FILTER) log('INIT', `Category filter: ${CATEGORY_FILTER}`);
  log('INIT', `Articles to generate: ${COUNT}`);

  // Validate API key
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_key_here') {
    console.error('\nERROR: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.\n');
    process.exit(1);
  }

  // Ensure directories exist
  [ARTICLES_DIR, DATA_DIR, CATEGORIES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Step 1: Fetch headlines
  const headlines = await fetchHeadlines();

  // Step 2: Generate articles
  const newArticles = await generateArticles(headlines, COUNT, CATEGORY_FILTER);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN OUTPUT ---\n');
    for (const article of newArticles) {
      console.log(`HEADLINE: ${article.headline}`);
      console.log(`CATEGORY: ${article.category}`);
      console.log(`AUTHOR: ${article.author}`);
      console.log(`SLUG: ${article.slug}`);
      console.log(`EXCERPT: ${article.excerpt}`);
      console.log(`READ TIME: ${article.readTime} min`);
      console.log(`SUBHEADLINE: ${article.subheadline}`);
      console.log('---');
      console.log(article.content);
      console.log('\n========================================\n');
    }
    log('DONE', 'Dry run complete. No files written.');
    return;
  }

  // Step 3: Write article HTML files
  log('BUILD', 'Writing article HTML files...');
  for (const article of newArticles) {
    const html = buildArticlePage(article);
    const filePath = path.join(ARTICLES_DIR, article.filename);
    fs.writeFileSync(filePath, html);
    log('BUILD', `  Created: articles/${article.filename}`);
    await sleep(100);
  }

  // Step 6 (run before 4/5 so manifest is ready): Update articles.json
  log('DATA', 'Updating articles manifest...');
  const existingArticles = loadArticlesManifest();

  // Deduplicate by filename to avoid duplicates on re-runs
  const existingFilenames = new Set(newArticles.map((a) => a.filename));
  const filteredExisting = existingArticles.filter((a) => !existingFilenames.has(a.filename));
  const allArticles = [...newArticles, ...filteredExisting].slice(0, 100);
  saveArticlesManifest(allArticles);
  log('DATA', `  Manifest now contains ${allArticles.length} article(s)`);

  // Step 4: Build/update homepage
  log('HOME', 'Rebuilding homepage...');
  const homepageArticles = allArticles.slice(0, 20);
  if (homepageArticles.length > 0) {
    const homepageHtml = buildHomepage(homepageArticles);
    fs.writeFileSync(INDEX_HTML, homepageHtml);
    log('HOME', '  Homepage updated with latest articles');
  }

  // Step 5: Update category pages
  log('CATS', 'Updating category pages...');
  for (const cat of CATEGORIES) {
    const catHtml = buildCategoryPage(cat, allArticles);
    const catPath = path.join(CATEGORIES_DIR, `${cat}.html`);
    fs.writeFileSync(catPath, catHtml);
    const count = allArticles.filter((a) => a.category === cat).length;
    log('CATS', `  ${CATEGORY_LABELS[cat]}: ${count} article(s)`);
  }

  // Step 7: Git commit and push
  log('GIT', 'Committing changes...');
  gitCommitAndPush(newArticles.length);

  // Summary
  console.log('\n==============================================');
  console.log('  GENERATION COMPLETE');
  console.log('==============================================');
  console.log(`  Articles generated: ${newArticles.length}`);
  console.log(`  Total in manifest: ${allArticles.length}`);
  console.log('  New articles:');
  for (const a of newArticles) {
    console.log(`    - [${a.category}] ${a.headline}`);
  }
  console.log('==============================================\n');
}

main().catch((err) => {
  console.error(`\nFATAL ERROR: ${err.message}\n`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
