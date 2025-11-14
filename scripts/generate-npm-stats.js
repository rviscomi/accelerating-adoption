#!/usr/bin/env node

/**
 * Generate npm download statistics
 * 
 * Reads polyfills.json, extracts npm packages, queries the npm API
 * for weekly download counts, and saves to npm-stats.json
 * 
 * Input: mappings/polyfills.json
 * Output: mappings/npm-stats.json
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NPM_API_BASE = "https://api.npmjs.org/downloads/point/last-week";
const DELAY_MS = 750; // Delay between API requests to avoid rate limiting
const MAX_RETRIES = 2; // Retry on rate limit errors

// Load polyfill mappings
async function loadPolyfillMappings() {
  const mappingsPath = path.join(__dirname, "../mappings/polyfills.json");
  const content = await fs.readFile(mappingsPath, "utf-8");
  return JSON.parse(content);
}

// Extract unique npm packages from polyfill mappings
function extractNpmPackages(polyfillMappings) {
  const packages = new Set();
  
  for (const feature of Object.values(polyfillMappings)) {
    for (const fallback of feature.fallbacks) {
      if (fallback.npm) {
        packages.add(fallback.npm);
      }
    }
  }
  
  return Array.from(packages).sort();
}

// Fetch download stats for a single package
async function fetchPackageStats(packageName, retryCount = 0) {
  try {
    // URL encode package name to handle scoped packages like @js-temporal/polyfill
    const encodedName = encodeURIComponent(packageName);
    const response = await fetch(`${NPM_API_BASE}/${encodedName}`);
    
    if (response.status === 404) {
      console.warn(`  ⚠ Package not found: ${packageName}`);
      return null;
    }
    
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      // Rate limited, wait longer and retry
      const waitTime = DELAY_MS * (retryCount + 2);
      console.log(`  ⏳ Rate limited on ${packageName}, waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await delay(waitTime);
      return fetchPackageStats(packageName, retryCount + 1);
    }
    
    if (!response.ok) {
      console.warn(`  ⚠ Failed to fetch stats for ${packageName}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.downloads;
  } catch (error) {
    console.warn(`  ⚠ Error fetching stats for ${packageName}:`, error.message);
    return null;
  }
}

// Add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch stats for all packages
async function fetchAllStats(packages) {
  const stats = {};
  let processed = 0;
  
  console.log(`\nFetching stats for ${packages.length} npm packages...\n`);
  
  for (const packageName of packages) {
    const downloads = await fetchPackageStats(packageName);
    
    if (downloads !== null) {
      stats[packageName] = downloads;
      console.log(`✓ ${packageName}: ${downloads.toLocaleString()} downloads/week`);
    }
    
    processed++;
    if (processed % 10 === 0) {
      console.log(`\nProgress: ${processed}/${packages.length}\n`);
    }
    
    // Add delay to avoid rate limiting
    if (processed < packages.length) {
      await delay(DELAY_MS);
    }
  }
  
  return stats;
}

// Main
async function main() {
  console.log("Loading polyfill mappings...");
  const polyfillMappings = await loadPolyfillMappings();
  
  console.log("Extracting npm packages...");
  const packages = extractNpmPackages(polyfillMappings);
  console.log(`Found ${packages.length} unique npm packages`);
  
  const stats = await fetchAllStats(packages);
  
  const outputPath = path.join(__dirname, "../mappings/npm-stats.json");
  await fs.writeFile(outputPath, JSON.stringify(stats, null, 2));
  
  console.log(`\n✓ Generated npm stats for ${Object.keys(stats).length} packages`);
  console.log(`✓ Output: ${outputPath}`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
