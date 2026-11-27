# @vt-labs/notification-preview

## 0.1.0

### Minor Changes

- First release: a registry-bound preview for email and push notifications. The core entry holds the registry and refuses an unregistered id before any provider runs; `./react` ships the preview page, `PreviewClient` and `createFetchClient`; `./style.css` themes it through `--np-*` variables.
