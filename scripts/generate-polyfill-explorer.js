#!/usr/bin/env node

/**
 * Generate polyfill explorer HTML
 * 
 * Creates an HTML page that displays all web features with polyfills
 * sorted by Baseline availability date.
 * 
 * Input: mappings/polyfills.json (from generate-polyfill-mappings.js)
 * Output: polyfill-explorer.html
 */

import { features } from "web-features";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load polyfill mappings
async function loadPolyfillMappings() {
  const mappingsPath = path.join(__dirname, "../mappings/polyfills.json");
  const content = await fs.readFile(mappingsPath, "utf-8");
  return JSON.parse(content);
}

// Get baseline status badge
function getBaselineBadge(feature) {
  if (!feature.status || feature.status.baseline === undefined) {
    throw new Error(`Feature ${feature.name} has no baseline status`);
  }
  
  if (feature.status.baseline === "high") {
    return { class: "badge-widely", text: "Widely Available" };
  }
  if (feature.status.baseline === "low") {
    return { class: "badge-newly", text: "Newly Available" };
  }
  if (feature.status.baseline === false) {
    return { class: "badge-limited", text: "Limited Availability" };
  }
  
  throw new Error(`Unknown baseline status: ${feature.status.baseline}`);
}

// Format baseline date
function formatBaselineDate(feature) {
  if (!feature.status?.baseline_high_date && !feature.status?.baseline_low_date) {
    return null;
  }
  
  const date = feature.status.baseline_high_date || feature.status.baseline_low_date;
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Get sort date (for ordering features)
function getSortDate(feature) {
  return feature.status?.baseline_high_date || 
         feature.status?.baseline_low_date || 
         "9999-12-31"; // Future date for features without baseline
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate polyfill item HTML
function generatePolyfillHtml(polyfill) {
  const badges = [];
  
  if (polyfill.npm) {
    badges.push(`<span class="polyfill-badge badge-npm" title="npm package">npm</span>`);
  }
  if (polyfill.github) {
    badges.push(`<span class="polyfill-badge badge-github" title="GitHub repository">GitHub</span>`);
  }
  
  const meta = [];
  if (polyfill.npm) {
    meta.push(`Package: <code>${escapeHtml(polyfill.npm)}</code>`);
  }
  if (polyfill.github) {
    meta.push(`Repo: <code>${escapeHtml(polyfill.github)}</code>`);
  }
  
  const description = polyfill.description || polyfill.url;
  
  return `
          <li class="polyfill-item">
            <div class="polyfill-header">
              <a href="${escapeHtml(polyfill.url)}" target="_blank" rel="noopener noreferrer" class="polyfill-link">
                ${escapeHtml(description)}
              </a>
              ${badges.join("\n              ")}
            </div>
            ${meta.length > 0 ? `<div class="polyfill-meta">${meta.join(" · ")}</div>` : ""}
            
          </li>
        `;
}

// Generate feature card HTML
function generateFeatureCardHtml(featureId, feature, polyfillData) {
  const badge = getBaselineBadge(feature);
  const baselineDate = formatBaselineDate(feature);
  
  const polyfillsHtml = polyfillData.fallbacks
    .map(p => generatePolyfillHtml(p))
    .join("");
  
  return `
        <div class="feature-card">
          <div class="feature-header">
            <h2 class="feature-name">
              ${escapeHtml(feature.name)}
              <span class="badge ${badge.class}">${badge.text}</span>
            </h2>
            <div class="feature-meta">
              <span class="feature-id">${escapeHtml(featureId)}</span>
              ${baselineDate ? `<span class="feature-date">Baseline: ${baselineDate}</span>` : ""}
            </div>
          </div>
          ${feature.description ? `<p class="feature-description">${escapeHtml(feature.description)}</p>` : ""}
          <div class="polyfills-section">
            <h3 class="polyfills-heading">Polyfills (${polyfillData.fallbacks.length})</h3>
            <ul class="polyfills-list">
              ${polyfillsHtml}
            </ul>
          </div>
        </div>
      `;
}

// Generate HTML
async function generateHtml(polyfillMappings) {
  // Get features with polyfills and sort by baseline date (oldest first by default)
  const featuresWithPolyfills = Object.entries(polyfillMappings)
    .filter(([featureId]) => features[featureId])
    .map(([featureId, polyfillData]) => ({
      id: featureId,
      feature: features[featureId],
      polyfillData,
      sortDate: getSortDate(features[featureId]),
    }))
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  
  const featureCards = featuresWithPolyfills
    .map(({ id, feature, polyfillData }) => generateFeatureCardHtml(id, feature, polyfillData))
    .join("\n    ");
  
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Features Polyfill Explorer</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    
    header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1 {
      margin: 0 0 10px 0;
      color: #1a1a1a;
    }
    
    .subtitle {
      color: #666;
      font-size: 1.1em;
      margin: 0;
    }
    
    .stats {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666;
    }
    
    .filters {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .filter-label {
      font-weight: 600;
      color: #333;
    }
    
    .filter-btn {
      padding: 8px 16px;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: white;
      color: #333;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .filter-btn:hover {
      border-color: #0066cc;
      color: #0066cc;
    }
    
    .filter-btn.active {
      background: #0066cc;
      border-color: #0066cc;
      color: white;
    }
    
    .sort-controls {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .sort-btn {
      padding: 8px 16px;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: white;
      color: #333;
      font-size: 0.9em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .sort-btn:hover {
      border-color: #0066cc;
      color: #0066cc;
    }
    
    .sort-btn.active {
      background: #0066cc;
      border-color: #0066cc;
      color: white;
    }
    
    .feature-card {
      background: white;
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: box-shadow 0.2s;
    }
    
    .feature-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .feature-header {
      margin-bottom: 15px;
    }
    
    .feature-name {
      margin: 0 0 10px 0;
      color: #1a1a1a;
      font-size: 1.5em;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .feature-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      font-size: 0.9em;
      color: #666;
    }
    
    .feature-id {
      font-family: monospace;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .feature-date {
      color: #0066cc;
    }
    
    .feature-description {
      margin: 15px 0;
      color: #555;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-widely {
      background: #00aa00;
      color: white;
    }
    
    .badge-newly {
      background: #0066cc;
      color: white;
    }
    
    .badge-limited {
      background: #ff9900;
      color: white;
    }
    
    .polyfills-section {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-widely {
      background: #00aa00;
      color: white;
    }
    
    .badge-newly {
      background: #0066cc;
      color: white;
    }
    
    .badge-limited {
      background: #ff9900;
      color: white;
    }
    
    .badge-none {
      background: #999;
      color: white;
    }
    
    .polyfills-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .polyfills-heading {
      margin: 0 0 15px 0;
      font-size: 1.1em;
      color: #333;
    }
    
    .polyfills-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .polyfill-item {
      margin-bottom: 15px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 6px;
      border-left: 3px solid #0066cc;
    }
    
    .polyfill-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 5px;
    }
    
    .polyfill-link {
      color: #0066cc;
      text-decoration: none;
      font-weight: 500;
      flex: 1;
      min-width: 200px;
    }
    
    .polyfill-link:hover {
      text-decoration: underline;
    }
    
    .polyfill-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.7em;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge-npm {
      background: #cc3534;
      color: white;
    }
    
    .badge-github {
      background: #24292e;
      color: white;
    }
    
    .polyfill-meta {
      font-size: 0.85em;
      color: #666;
      margin-top: 5px;
    }
    
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
      font-size: 0.9em;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .feature-card {
        padding: 15px;
      }
      
      .feature-name {
        font-size: 1.2em;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Web Features Polyfill Explorer</h1>
    <p class="subtitle">Browse web platform features with available polyfills, sorted by Baseline availability date</p>
    <div class="stats">
      <span id="feature-count">Showing ${featuresWithPolyfills.length} features with polyfills</span> · 
      Generated on ${today}
    </div>
    <div class="filters">
      <label class="filter-label">Filter by Baseline status:</label>
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="widely">Widely Available</button>
      <button class="filter-btn" data-filter="newly">Newly Available</button>
      <button class="filter-btn" data-filter="limited">Limited Availability</button>
    </div>
    <div class="sort-controls">
      <label class="filter-label">Sort by date:</label>
      <button class="sort-btn" data-sort="desc">Newest First</button>
      <button class="sort-btn active" data-sort="asc">Oldest First</button>
    </div>
  </header>
  
  <main>
    ${featureCards}
  </main>

  <script>
    // Filter and sort functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const sortButtons = document.querySelectorAll('.sort-btn');
    const featureCards = document.querySelectorAll('.feature-card');
    const featureCount = document.getElementById('feature-count');
    const mainContainer = document.querySelector('main');
    
    function updateCount() {
      const visibleCards = document.querySelectorAll('.feature-card:not([style*="display: none"])');
      const count = visibleCards.length;
      featureCount.textContent = \`Showing \${count} feature\${count !== 1 ? 's' : ''} with polyfills\`;
    }
    
    function sortCards(order) {
      // Get all cards as an array with their baseline dates
      const cardsArray = Array.from(featureCards).map(card => {
        // Extract date from the feature-date span
        const dateSpan = card.querySelector('.feature-date');
        let sortDate = '9999-12-31'; // Default for features without date
        
        if (dateSpan) {
          const dateText = dateSpan.textContent.replace('Baseline: ', '');
          sortDate = new Date(dateText).toISOString().split('T')[0];
        }
        
        return { card, sortDate };
      });
      
      // Sort based on order
      cardsArray.sort((a, b) => {
        if (order === 'desc') {
          return b.sortDate.localeCompare(a.sortDate);
        } else {
          return a.sortDate.localeCompare(b.sortDate);
        }
      });
      
      // Reorder the cards in the DOM
      cardsArray.forEach(({ card }) => {
        mainContainer.appendChild(card);
      });
    }
    
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter;
        
        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Filter cards
        featureCards.forEach(card => {
          if (filter === 'all') {
            card.style.display = '';
          } else {
            const badge = card.querySelector('.badge');
            const matchesFilter = 
              (filter === 'widely' && badge.classList.contains('badge-widely')) ||
              (filter === 'newly' && badge.classList.contains('badge-newly')) ||
              (filter === 'limited' && badge.classList.contains('badge-limited'));
            
            card.style.display = matchesFilter ? '' : 'none';
          }
        });
        
        updateCount();
      });
    });
    
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        const order = button.dataset.sort;
        
        // Update active button
        sortButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Sort cards
        sortCards(order);
      });
    });
  </script>
</body>
</html>`;
}

// Main
async function main() {
  console.log("Loading polyfill mappings...");
  const polyfillMappings = await loadPolyfillMappings();
  
  console.log("Generating HTML...");
  const html = await generateHtml(polyfillMappings);
  
  const outputPath = path.join(__dirname, "../docs/index.html");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html);
  
  console.log(`✓ Generated polyfill explorer`);
  console.log(`✓ Output: ${outputPath}`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
