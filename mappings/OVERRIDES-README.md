# Polyfill Overrides

This file (`polyfills-overrides.json`) allows you to manually add or augment polyfill information that won't be overwritten when regenerating from MDN documentation.

## How It Works

When you run `npm run generate-polyfills`, the script:
1. Auto-discovers polyfills from MDN documentation
2. Loads this overrides file
3. **Augments** the auto-generated data by appending your manual fallbacks to any existing ones
4. For features not found in MDN, creates new entries

Your manual additions will persist across regenerations.

## Usage

### Augmenting fallbacks (default behavior)

Add your fallbacks to any auto-discovered ones:

```json
{
  "intersection-observer": {
    "fallbacks": [
      {
        "type": "polyfill",
        "url": "https://www.npmjs.com/package/intersection-observer",
        "npm": "intersection-observer",
        "description": "Polyfill for IntersectionObserver API"
      }
    ]
  }
}
```

### Replacing auto-generated fallbacks

Use `"replace": true` to completely override the auto-discovered data. Useful for fixing incorrect auto-discoveries:

```json
{
  "intersection-observer-v2": {
    "replace": true,
    "fallbacks": []
  }
}
```

This will replace the auto-generated fallbacks with an empty array (no polyfills).

### Excluding a feature entirely

Remove a feature from the output completely:

```json
{
  "feature-id": {
    "exclude": true
  }
}
```

## Fields

- `type`: Always "polyfill"
- `url`: Link to the polyfill (required)
- `npm`: npm package name (optional, extracted from URL if it's an npmjs.com link)
- `github`: GitHub repo in format "owner/repo" (optional, extracted from URL if it's a github.com link)
- `description`: Human-readable description (optional)
- `replace`: Set to `true` to replace auto-generated fallbacks instead of augmenting (optional, default: `false`)
- `exclude`: Set to `true` to remove the feature from the output entirely (optional)

## Notes

- Keys starting with `_` are ignored (used for comments/documentation)
- **Default behavior**: Manual fallbacks are appended to auto-generated ones
- **Replace mode** (`"replace": true`): Completely replaces auto-generated fallbacks
- **Exclude mode** (`"exclude": true`): Removes the feature entirely
- For features not auto-discovered, your entry creates a new mapping
- Changes here are preserved when regenerating polyfills
