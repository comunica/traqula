# Breaking Changes Report

## M3 — CJS moduleResolution cannot be changed to `nodenext`

**Audit recommendation:** Change `moduleResolution` from `"bundler"` to `"nodenext"` in CJS configs.

**Status:** Cannot be resolved without a breaking change to the build pipeline.

**Reason:** TypeScript 6 enforces that `moduleResolution: "nodenext"` requires
`module: "NodeNext"`. The CJS build needs `module: "CommonJS"` to produce
CommonJS output. These two settings are mutually exclusive.

The only compatible `moduleResolution` options for `module: "CommonJS"` are:
- `"bundler"` (current) — does not validate CJS resolution, but works
- `"node10"` — classic Node.js resolution, does not understand `exports` maps

Neither option provides the CJS resolution validation that `"nodenext"` would
offer. Fixing this properly would require restructuring the dual ESM/CJS build
strategy (e.g., using `module: "NodeNext"` with file-level CJS detection, or
dropping the CJS build entirely).

**Mitigation:** The `skipLibCheck: true` removal (H3) was applied successfully,
which means the CJS `.d.ts` files from ESM are now validated. The remaining gap
is only in CJS-specific module resolution validation, which is a narrow concern
since all source files already use `.js` extensions.
