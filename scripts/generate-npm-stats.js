#!/usr/bin/env node

/**
 * Generate npm download statistics
 * 
 * Reads polyfills.json, extracts npm packages, queries the npm API
 * for weekly download counts, and saves to npm-stats.json
 * 
 * By default, only refreshes packages that are older than 1 week or
 * have never been queried. Use --force to refresh all packages.
 * 
 * Input: mappings/polyfills.json
 * Output: mappings/npm-stats.json
 * 
 * Usage:
 *   node generate-npm-stats.js          # Refresh only stale packages
 *   node generate-npm-stats.js --force  # Refresh all packages
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NPM_API_BASE = "https://api.npmjs.org/downloads/point/last-week";
const DELAY_MS = 750; // Delay between API requests to avoid rate limiting
const MAX_RETRIES = 2; // Retry on rate limit errors
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

// Parse command line arguments
const FORCE_REFRESH = process.argv.includes('--force') || process.argv.includes('-f');

// Load existing npm stats
async function loadExistingStats() {
  try {
    const statsPath = path.join(__dirname, "../mappings/npm-stats.json");
    const content = await fs.readFile(statsPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid, start fresh
    return {};
  }
}

// Check if a package needs to be refreshed
function needsRefresh(packageName, existingStats) {
  // Force refresh all packages if --force flag is set
  if (FORCE_REFRESH) {
    return true;
  }
  
  // Package has never been queried
  if (!existingStats[packageName]) {
    return true;
  }
  
  // Package stats are missing timestamp (legacy format)
  if (!existingStats[packageName].lastModified) {
    return true;
  }
  
  // Check if stats are older than 1 week
  const lastModified = new Date(existingStats[packageName].lastModified);
  const now = new Date();
  const timeDiff = now - lastModified;
  
  return timeDiff > ONE_WEEK_MS;
}

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
async function fetchAllStats(packages, existingStats) {
  const stats = { ...existingStats }; // Start with existing stats
  const packagesToRefresh = packages.filter(pkg => needsRefresh(pkg, existingStats));
  let processed = 0;
  
  console.log(`\nTotal packages: ${packages.length}`);
  console.log(`Packages needing refresh: ${packagesToRefresh.length}`);
  console.log(`Packages up-to-date: ${packages.length - packagesToRefresh.length}\n`);
  
  if (packagesToRefresh.length === 0) {
    console.log("All packages are up-to-date! No API requests needed.\n");
    return stats;
  }
  
  console.log(`Fetching stats for ${packagesToRefresh.length} packages...\n`);
  
  for (const packageName of packagesToRefresh) {
    const downloads = await fetchPackageStats(packageName);
    
    if (downloads !== null) {
      stats[packageName] = {
        downloads: downloads,
        lastModified: new Date().toISOString()
      };
      console.log(`✓ ${packageName}: ${downloads.toLocaleString()} downloads/week`);
    } else if (!stats[packageName]) {
      // Package not found, but we should track that we tried
      stats[packageName] = {
        downloads: null,
        lastModified: new Date().toISOString()
      };
    }
    
    processed++;
    if (processed % 10 === 0) {
      console.log(`\nProgress: ${processed}/${packagesToRefresh.length}\n`);
    }
    
    // Add delay to avoid rate limiting
    if (processed < packagesToRefresh.length) {
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
  
  console.log("\nLoading existing stats...");
  const existingStats = await loadExistingStats();
  
  if (FORCE_REFRESH) {
    console.log("Force refresh enabled - all packages will be updated");
  }
  
  const stats = await fetchAllStats(packages, existingStats);
  
  const outputPath = path.join(__dirname, "../mappings/npm-stats.json");
  await fs.writeFile(outputPath, JSON.stringify(stats, null, 2));
  
  const refreshedCount = packages.filter(pkg => needsRefresh(pkg, existingStats)).length;
  console.log(`\n✓ Refreshed stats for ${refreshedCount} packages`);
  console.log(`✓ Total packages tracked: ${Object.keys(stats).length}`);
  console.log(`✓ Output: ${outputPath}`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
