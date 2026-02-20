Place packaging assets in this directory:

- `icon.ico` for Windows NSIS builds
- `icon.icns` for macOS DMG/ZIP builds
- `icon.png` for Linux AppImage builds
- `installer.nsh` for custom NSIS uninstall cleanup behavior

`electron-builder.yml` uses `directories.buildResources: build`, so these files are required for cross-platform packaging.
