# aintern-extension

This repository is a mirror. The source of the AIntern browser extension lives in `extension/` of zyx1121/aintern (private).

## Rules

- Do not edit `extension/` here. Change it in zyx1121/aintern; its release workflow copies it here and pushes a `vX.Y.Z` tag.
- The tag starts `.github/workflows/release.yml`, which zips `extension/` and attaches `aintern-extension.zip` to a release.
- Keep the manifest `key`: it fixes the extension id (`ifbmgcfmalplanmilfnemmalpdnfhlli`), which AIntern instances allow in `AINTERN_EXTENSION_ORIGINS`.
