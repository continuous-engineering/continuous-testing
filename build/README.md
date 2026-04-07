# Build Resources

Place your app icons here before running `npm run build`:

- `icon.ico` — Windows taskbar + installer icon (256x256 recommended)
- `icon.png` — macOS / Linux icon (512x512 recommended)

electron-builder will use these automatically based on the platform target.

## Generating a placeholder icon

If you don't have an icon yet:
```
npm install -g electron-icon-builder
electron-icon-builder --input=./icon-source.png --output=./build
```

Or create a 256x256 PNG and convert to ICO using any online converter.
