# Assets Folder

This folder contains all the static assets for the 8BP Rewards application.

## Folder Structure

- **`logos/`** - Company logos, brand assets, and main visual identity files
- **`icons/`** - UI icons, favicons, and small graphical elements  
- **`images/`** - Photos, illustrations, and other image assets

## How to Use

### Adding Assets
1. Place your files in the appropriate subfolder
2. Use descriptive filenames (e.g., `logo-dark.png`, `logo-light.png`)
3. Recommended formats:
   - **Logos**: PNG, SVG (preferred for scalability)
   - **Icons**: SVG, PNG
   - **Images**: PNG, JPG, WebP

### Referencing Assets in Code
Since this is in the `public` folder, you can reference assets directly:

```jsx
// Logo example
<img src="/assets/logos/8bp-logo.png" alt="8BP Rewards Logo" />

// Icon example  
<img src="/assets/icons/dark-mode-icon.svg" alt="Dark Mode" />

// Image example
<img src="/assets/images/hero-background.jpg" alt="Hero Background" />
```

### Current Logo Usage
The current logo in the navigation uses a gradient background with "8BP" text. You can replace this by:

1. Adding your logo files to `/assets/logos/`
2. Updating the Layout component to use your logo instead of the current gradient

### File Naming Convention
- Use lowercase with hyphens: `logo-dark.png`
- Include size/type: `icon-16x16.png`, `logo-horizontal.svg`
- Include theme: `logo-light.png`, `logo-dark.png`

## Current Assets
- None yet - add your logos and icons here!
