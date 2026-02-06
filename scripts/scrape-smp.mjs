#!/usr/bin/env node
/**
 * Smart Money People Review Scraper for BSA Member Chat
 * Scrapes reviews from smartmoneypeople.com for all 10 building societies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// SMP slug mapping (confirmed working)
const SOCIETIES = [
  { id: 'nationwide', slug: 'nationwide', name: 'Nationwide Building Society', products: ['instant-access-savings', 'fixed-rate-isa', 'fixed-rate-mortgage', 'tracker-rate-mortgage'] },
  { id: 'yorkshire', slug: 'yorkshire-building-society', name: 'Yorkshire Building Society', products: ['savings', 'fixed-rate-mortgage', 'isa'] },
  { id: 'coventry', slug: 'coventry-building-society', name: 'Coventry Building Society', products: ['savings', 'mortgages'] },
  { id: 'skipton', slug: 'skipton-building-society', name: 'Skipton Building Society', products: ['savings', 'mortgages', 'isa'] },
  { id: 'leeds', slug: 'leeds-building-society', name: 'Leeds Building Society', products: ['savings', 'mortgages'] },
  { id: 'principality', slug: 'principality-building-society', name: 'Principality Building Society', products: ['cash-isa', 'fixed-rate-bond', 'fixed-rate-mortgage', 'instant-access-account', 'e-saver-account'] },
  { id: 'cumberland', slug: 'the-cumberland', name: 'Cumberland Building Society', products: ['savings', 'mortgages'] },
  { id: 'monmouthshire', slug: 'monmouthshire-building-society', name: 'Monmouthshire Building Society', products: ['savings', 'mortgages'] },
  { id: 'bath', slug: 'bath-building-society', name: 'Bath Building Society', products: ['savings', 'mortgages'] },
  { id: 'ecology', slug: 'ecology-building-society', name: 'Ecology Building Society', products: ['savings-account', 'mortgages'] },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
    }
  });
  if (!res.ok) {
    console.log(`  HTTP ${res.status} for ${url}`);
    return null;
  }
  return await res.text();
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseReviewsFromHTML(html, productCategory) {
  const reviews = [];
  
  // Split by review div boundaries using the unique id pattern
  const reviewBlocks = html.split(/id="review-\d+"/);
  
  for (let i = 1; i < reviewBlocks.length; i++) {
    const block = reviewBlocks[i];
    
    // Extract rating from data-rating attribute
    const ratingMatch = block.match(/data-rating="(\d)"/);
    if (!ratingMatch) continue;
    const rating = parseInt(ratingMatch[1]);
    
    // Extract title from h3 tag
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (!titleMatch) continue;
    const title = cleanText(titleMatch[1]);
    if (!title || title.length < 3) continue;
    
    // Extract review text - look for the paragraph span with "hideable" or review text class
    const textMatch = block.match(/<span class="block paragraph[^"]*hyphenate[^"]*">([\s\S]*?)(?:<a[^>]*>Read more|<\/span>)/);
    let text = '';
    if (textMatch) {
      text = cleanText(textMatch[1]);
    } else {
      // Try alternative: direct paragraph
      const altMatch = block.match(/<span class="block paragraph[^"]*">\s*([\s\S]*?)\s*<\/span>/);
      if (altMatch) {
        text = cleanText(altMatch[1]);
      }
    }
    
    // Also check for full text (not truncated) which appears differently
    // Some reviews have full text in a different section
    const fullTextMatch = block.match(/<span class="block mb-3 paragraph[^"]*">([\s\S]*?)<\/span>/);
    if (fullTextMatch) {
      const fullText = cleanText(fullTextMatch[1]);
      if (fullText.length > text.length) text = fullText;
    }
    
    // Extract date
    const dateMatch = block.match(/Reviewed on:<\/strong>\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/);
    const dateStr = dateMatch ? dateMatch[1].trim() : '';
    
    if (title && text && text.length > 15 && rating >= 1 && rating <= 5) {
      // Clean up truncated text (remove "..." at the end if present)
      if (text.endsWith('...')) {
        // This is truncated - still useful but note it
      }
      
      reviews.push({
        title: title.substring(0, 120),
        text,
        rating,
        date: dateStr,
        category: normalizeCategoryName(productCategory),
        sentiment: rating >= 4 ? 'Positive' : (rating === 3 ? 'Mixed' : 'Negative'),
      });
    }
  }
  
  return reviews;
}

function normalizeCategoryName(product) {
  if (['savings', 'isa', 'bond', 'savings-account', 'instant-access-savings', 'fixed-rate-isa', 'cash-isa', 'fixed-rate-bond', 'instant-access-account', 'e-saver-account', 'limited-access-saver', 'loyalty-saver', 'regular-savings', 'promise-saver'].includes(product)) return 'savings';
  if (['mortgages', 'fixed-rate-mortgage', 'tracker-rate-mortgage', 'tracker'].includes(product)) return 'mortgages';
  if (['current-account', 'plus-current-account', 'day2day-current-account'].includes(product)) return 'current account';
  if (['insurance', 'home-insurance', 'life-insurance'].includes(product)) return 'insurance';
  return 'general';
}

async function scrapeProductReviews(slug, productType, maxPages = 4) {
  const allReviews = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://smartmoneypeople.com/${slug}-reviews/product/${productType}?page=${page}`;
    await delay(2000 + Math.random() * 1500); // Be respectful
    
    const html = await fetchPage(url);
    if (!html) break;
    
    const reviews = parseReviewsFromHTML(html, productType);
    if (reviews.length === 0) {
      console.log(`  Page ${page}: no reviews found, stopping`);
      break;
    }
    
    allReviews.push(...reviews);
    console.log(`  Page ${page}: found ${reviews.length} reviews (total: ${allReviews.length})`);
    
    // Check total count and current position
    const showingMatch = html.match(/Showing\s+\d+\s+to\s+(\d+)\s+of\s+(\d+)/);
    if (showingMatch) {
      const current = parseInt(showingMatch[1]);
      const total = parseInt(showingMatch[2]);
      if (current >= total) break;
    } else if (page > 1) {
      // If no pagination indicator on page > 1, likely no more results
      break;
    }
  }
  
  return allReviews;
}

async function scrapeSociety(society) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping ${society.name} (slug: ${society.slug})`);
  console.log(`${'='.repeat(60)}`);
  
  let allReviews = [];
  const seenTitles = new Set();
  
  // Scrape each product page
  for (const product of society.products) {
    console.log(`\n  --- ${product} reviews ---`);
    const reviews = await scrapeProductReviews(society.slug, product);
    
    // Dedup
    for (const r of reviews) {
      if (!seenTitles.has(r.title)) {
        allReviews.push(r);
        seenTitles.add(r.title);
      }
    }
  }
  
  console.log(`\n  Raw total: ${allReviews.length} unique reviews`);
  
  // Filter for quality: prefer reviews with substantial text (>50 chars)
  const quality = allReviews.filter(r => r.text.length >= 50);
  const short = allReviews.filter(r => r.text.length < 50);
  
  // Sort quality reviews by text length (longer = more detailed)
  quality.sort((a, b) => b.text.length - a.text.length);
  
  // Take up to 25 quality reviews, then fill with short ones if needed
  let selected = quality.slice(0, 25);
  if (selected.length < 15 && short.length > 0) {
    selected.push(...short.slice(0, 15 - selected.length));
  }
  
  // Ensure good mix of positive/negative
  const pos = selected.filter(r => r.sentiment === 'Positive');
  const neg = selected.filter(r => r.sentiment === 'Negative');
  const mix = selected.filter(r => r.sentiment === 'Mixed');
  
  console.log(`  Selected: ${selected.length} (${pos.length} positive, ${mix.length} mixed, ${neg.length} negative)`);
  
  return selected;
}

async function main() {
  // Load existing results if any, to allow partial re-scraping
  const resultsPath = path.join(ROOT, 'scripts', 'smp-reviews.json');
  let results = {};
  if (fs.existsSync(resultsPath)) {
    try { results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8')); } catch {}
  }
  
  // Only re-scrape specified societies, or all if --all flag
  const onlyIds = process.argv.slice(2).filter(a => a !== '--all');
  const scrapeAll = process.argv.includes('--all') || onlyIds.length === 0;
  
  for (const society of SOCIETIES) {
    if (!scrapeAll && !onlyIds.includes(society.id)) continue;
    
    const reviews = await scrapeSociety(society);
    results[society.id] = reviews;
    
    // Save intermediate results
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const [id, reviews] of Object.entries(results)) {
    const pos = reviews.filter(r => r.sentiment === 'Positive').length;
    const neg = reviews.filter(r => r.sentiment === 'Negative').length;
    const mix = reviews.filter(r => r.sentiment === 'Mixed').length;
    console.log(`  ${id}: ${reviews.length} reviews (${pos} pos, ${mix} mix, ${neg} neg)`);
  }
  
  console.log('\nResults saved to scripts/smp-reviews.json');
}

main().catch(console.error);
