#!/usr/bin/env node

/**
 * Generate polyfill mappings for web-features
 * 
 * Discovers polyfills by:
 * 1. Cloning the MDN content repository
 * 2. Looking up MDN docs for each web-feature (via BCD)
 * 3. Parsing markdown "See also" sections for polyfill links
 * 4. Extracting npm package names and GitHub repos
 * 
 * Output: mappings/polyfills.json
 */

import { features } from "web-features";
import bcd from "@mdn/browser-compat-data" with { type: "json" };
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MDN_REPO = "https://github.com/mdn/content.git";
const MDN_TEMP = path.join(__dirname, "..", "mdn-content-temp");
const MDN_DOCS_MAPPING_URL = "https://raw.githubusercontent.com/web-platform-dx/web-features-mappings/refs/heads/main/mappings/mdn-docs.json";

// Fetch MDN docs mapping
async function fetchMDNDocsMapping() {
  console.log("Fetching MDN docs mapping...");
  const response = await fetch(MDN_DOCS_MAPPING_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch MDN docs mapping: ${response.status}`);
  }
  const mapping = await response.json();
  console.log(`✓ Loaded mapping for ${Object.keys(mapping).length} features\n`);
  return mapping;
}

// Clone MDN content repo if needed
async function ensureMDNContent() {
  try {
    await fs.access(MDN_TEMP);
    console.log("Using cached MDN content\n");
  } catch {
    console.log("Cloning MDN content repository...");
    execSync(`git clone --depth 1 ${MDN_REPO} ${MDN_TEMP}`, { stdio: 'inherit' });
    console.log("✓ Cloned\n");
  }
}

// Convert MDN slug to file path
function slugToPath(slug) {
  return slug
    .toLowerCase()
    .replace(/::/g, "_doublecolon_")
    .replace(/:/g, "_colon_")
    .replace(/\*/g, "_star_");
}

// Get MDN slug from BCD for a feature
function getMDNSlug(featureId) {
  const feature = features[featureId];
  if (!feature?.compat_features?.[0]) return null;
  
  const bcdKey = feature.compat_features[0];
  const parts = bcdKey.split(".");
  
  let data = bcd;
  for (const part of parts) {
    data = data?.[part];
    if (!data) return null;
  }
  
  const url = data?.__compat?.mdn_url;
  if (!url) return null;
  
  // Extract slug from URL - handle both formats:
  // https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
  // https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Set/difference
  return url
    .replace(/^https:\/\/developer\.mozilla\.org\/(en-US\/)?docs\//, '');
}

// Parse markdown file for polyfill links in "See also" section
async function findPolyfills(slug) {
  const filePath = path.join(MDN_TEMP, "files/en-us", slugToPath(slug), "index.md");
  
  try {
    const content = await fs.readFile(filePath, "utf-8");
    
    // Find "See also" section
    const seeAlsoMatch = content.match(/## See also\s*\n([\s\S]*?)(\n## |$)/i);
    if (!seeAlsoMatch) return [];
    
    const seeAlsoSection = seeAlsoMatch[1];
    
    // Split into list items (lines starting with - or *)
    const listItems = seeAlsoSection.split(/\n(?=[-*]\s)/).map(item => item.trim());
    
    const links = [];
    for (const item of listItems) {
      // Extract all links from this list item
      const linkMatches = item.match(/\[([^\]]+)\]\((https?:[^\)]+)\)/g);
      if (!linkMatches) continue;
      
      for (const match of linkMatches) {
        const [, linkText, url] = match.match(/\[([^\]]+)\]\((https?:[^\)]+)\)/);
        
        // Skip MDN links
        if (url.includes('developer.mozilla.org')) continue;
        
        // Look for polyfill indicators
        const isPolyfill = 
          url.toLowerCase().includes('polyfill') ||
          item.toLowerCase().includes('polyfill') ||
          url.includes('npmjs.com/package/');
        
        if (isPolyfill) {
          // Extract full list item text, removing the leading bullet and cleaning up
          const fullText = item
            .replace(/^[-*]\s+/, '') // Remove bullet
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Replace [text](url) with text
            .trim();
          
          links.push({ url, text: fullText });
        }
      }
    }
    
    return links;
  } catch (error) {
    // File doesn't exist or can't be read - skip silently
    return [];
  }
}

// Extract npm package from URL
function extractNpmPackage(url) {
  // Match package name after /package/, handling scoped packages like @scope/package
  const match = url.match(/npmjs\.com\/package\/(@?[^\/\?#]+(?:\/[^\/\?#]+)?)/);
  return match ? match[1] : null;
}

// Extract GitHub repo from URL
function extractGithubRepo(url) {
  const match = url.match(/github\.com\/([^\/]+\/[^\/\?#]+)/);
  return match ? match[1].replace(/\.git$/, '') : null;
}

// Generate mappings
async function generateMappings(mdnDocsMapping) {
  const mappings = {};
  let processed = 0;
  let found = 0;
  
  for (const featureId in features) {
    // Try MDN docs mapping first (includes API overview pages)
    let slugs = [];
    if (mdnDocsMapping[featureId]) {
      slugs = mdnDocsMapping[featureId].map(doc => doc.slug);
    } else {
      // Fall back to BCD lookup
      const slug = getMDNSlug(featureId);
      if (slug) slugs = [slug];
    }
    
    if (slugs.length === 0) continue;
    
    processed++;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed} features, found ${found} with polyfills...`);
    }
    
    // Check all slugs for this feature
    const allPolyfillLinks = [];
    for (const slug of slugs) {
      const polyfillLinks = await findPolyfills(slug);
      allPolyfillLinks.push(...polyfillLinks);
    }
    
    if (allPolyfillLinks.length === 0) continue;
    
    // Deduplicate by URL
    const uniqueLinks = Array.from(
      new Map(allPolyfillLinks.map(link => [link.url, link])).values()
    );
    
    const fallbacks = uniqueLinks.map(link => {
      const fallback = {
        type: "polyfill",
        url: link.url
      };
      
      const npm = extractNpmPackage(link.url);
      if (npm) fallback.npm = npm;
      
      const github = extractGithubRepo(link.url);
      if (github) fallback.github = github;
      
      if (link.text) fallback.description = link.text;
      
      return fallback;
    });
    
    mappings[featureId] = {
      fallbacks
    };
    
    found++;
    console.log(`✓ ${featureId}: ${fallbacks.length} polyfill(s)`);
  }
  
  // Sort by feature ID
  return Object.keys(mappings)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = mappings[key];
      return sorted;
    }, {});
}

// Main
async function main() {
  const mdnDocsMapping = await fetchMDNDocsMapping();
  await ensureMDNContent();
  
  console.log("Discovering polyfills from MDN documentation...\n");
  const mappings = await generateMappings(mdnDocsMapping);
  
  // Load and merge manual overrides
  const overridesPath = path.join(__dirname, "../mappings/polyfills-overrides.json");
  let overrides = {};
  try {
    const overridesContent = await fs.readFile(overridesPath, "utf-8");
    const parsed = JSON.parse(overridesContent);
    // Filter out metadata keys starting with _
    overrides = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => !key.startsWith("_"))
    );
    console.log(`\n✓ Loaded ${Object.keys(overrides).length} manual overrides`);
  } catch (error) {
    console.log("\n✓ No manual overrides found (this is fine)");
  }
  
  // Merge overrides into mappings
  for (const [featureId, override] of Object.entries(overrides)) {
    if (override.exclude) {
      delete mappings[featureId];
      console.log(`  - Excluded: ${featureId}`);
    } else if (override.fallbacks !== undefined) {
      if (override.replace) {
        // Replace mode: completely override auto-generated data
        mappings[featureId] = { fallbacks: override.fallbacks };
        console.log(`  ↻ Replaced: ${featureId} (${override.fallbacks.length} fallback(s))`);
      } else {
        // Augment mode (default): append to existing fallbacks
        if (mappings[featureId]) {
          mappings[featureId].fallbacks = [
            ...mappings[featureId].fallbacks,
            ...override.fallbacks
          ];
          console.log(`  + Augmented: ${featureId} (added ${override.fallbacks.length} fallback(s))`);
        } else {
          // No existing entry, create new one
          mappings[featureId] = { fallbacks: override.fallbacks };
          console.log(`  + Added: ${featureId}`);
        }
      }
    }
  }
  
  const outputPath = path.join(__dirname, "../mappings/polyfills.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(mappings, null, 2));
  
  console.log(`\n✓ Generated ${Object.keys(mappings).length} mappings`);
  console.log(`✓ Output: ${outputPath}`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
