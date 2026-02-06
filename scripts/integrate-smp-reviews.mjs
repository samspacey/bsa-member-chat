#!/usr/bin/env node
/**
 * Integrate Smart Money People reviews into knowledge files
 * - Rename "## Specific Trustpilot Reviews" to "## Specific Customer Reviews"
 * - Add "(Trustpilot)" labels to existing review titles
 * - Append new SMP reviews formatted in the same markdown style
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');

// Load scraped reviews
const reviews = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'smp-reviews.json'), 'utf-8'));

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const match = dateStr.match(/(\w+)\s+(\d{4})/);
  return match ? `${match[1]} ${match[2]}` : dateStr;
}

function starsEmoji(rating) {
  return '⭐'.repeat(rating);
}

function contextFromCategory(category) {
  switch(category) {
    case 'savings': return 'Savings product review';
    case 'mortgages': return 'Mortgage product review';
    case 'insurance': return 'Insurance product review';
    case 'current account': return 'Current account review';
    default: return 'General review';
  }
}

function formatReviewMd(review) {
  return `### ${review.sentiment} - ${review.title} (Smart Money People)
> "${review.text}"
- **Rating:** ${starsEmoji(review.rating)}
- **Date:** ${formatDate(review.date)}
- **Context:** ${contextFromCategory(review.category)}`;
}

function addTrustpilotLabels(content) {
  // Add (Trustpilot) to existing review titles that don't already have a source label
  // Matches lines like: ### Positive - Title here
  // But NOT: ### Positive - Title (Trustpilot) or ### Positive - Title (Smart Money People)
  return content.replace(
    /^(### (?:Positive|Negative|Mixed) - .+?)$/gm,
    (match) => {
      // Skip if already has a source label
      if (match.includes('(Trustpilot)') || match.includes('(Smart Money People)')) {
        return match;
      }
      // Skip theme section headings
      if (match.includes('Themes')) {
        return match;
      }
      return `${match} (Trustpilot)`;
    }
  );
}

function processKnowledgeFile(societyId) {
  const filePath = path.join(KNOWLEDGE_DIR, `${societyId}.md`);
  if (!fs.existsSync(filePath)) {
    console.log(`  WARNING: ${filePath} not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const smpReviews = reviews[societyId] || [];
  
  if (smpReviews.length === 0) {
    console.log(`  No SMP reviews for ${societyId}, only updating labels`);
  }
  
  // Step 1: Rename section heading
  content = content.replace(
    '## Specific Trustpilot Reviews',
    '## Specific Customer Reviews'
  );
  
  // Step 2: Add (Trustpilot) labels to existing review titles
  content = addTrustpilotLabels(content);
  
  // Step 3: Append SMP reviews before the final divider/footer
  if (smpReviews.length > 0) {
    // Format all SMP reviews
    const smpSection = smpReviews.map(r => formatReviewMd(r)).join('\n\n');
    
    // Find where to insert - before the final "---" or at end of file
    const lastDividerIndex = content.lastIndexOf('\n---\n');
    
    if (lastDividerIndex !== -1) {
      // Insert before the final divider
      content = content.substring(0, lastDividerIndex) + 
        '\n\n' + smpSection + '\n' +
        content.substring(lastDividerIndex);
    } else {
      // Append at end
      content = content.trimEnd() + '\n\n' + smpSection + '\n';
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  Updated ${societyId}.md: ${smpReviews.length} SMP reviews added`);
}

// Process all societies
const societyIds = ['nationwide', 'yorkshire', 'coventry', 'skipton', 'leeds', 'principality', 'cumberland', 'monmouthshire', 'bath', 'ecology'];

console.log('Integrating Smart Money People reviews into knowledge files...\n');

for (const id of societyIds) {
  console.log(`Processing ${id}...`);
  processKnowledgeFile(id);
}

console.log('\nDone!');
