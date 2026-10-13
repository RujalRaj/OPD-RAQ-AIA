# Third-party notices and dependency inventory

Recorded from the project lockfiles and installed package metadata on 13 October 2026. This file credits third-party work; it is not a replacement for the upstream licence terms. See the [README acknowledgements](README.md#acknowledgements-and-use-of-existing-work) for source documents, AI assistance, models, audio, hosting and development tools.

## Bundled fonts and icons

The following notices are retained verbatim from installed packages:

- `@fontsource/dm-sans`: [licence and copyright notice](docs/licenses/dm-sans-LICENSE.txt).
- `@fontsource/manrope`: [licence and copyright notice](docs/licenses/manrope-LICENSE.txt).
- `@fontsource/noto-sans-devanagari`: [licence and copyright notice](docs/licenses/noto-sans-devanagari-LICENSE.txt).
- `lucide-react`: [licence and copyright notice](docs/licenses/lucide-react-LICENSE.txt).

## Frontend: direct dependencies

| Package | Locked version | Use | Declared licence |
| --- | --- | --- | --- |
| `@fontsource/dm-sans` | 5.3.0 | Runtime | OFL-1.1 |
| `@fontsource/manrope` | 5.3.0 | Runtime | OFL-1.1 |
| `@fontsource/noto-sans-devanagari` | 5.3.0 | Runtime | OFL-1.1 |
| `lucide-react` | 0.468.0 | Runtime | ISC |
| `react` | 19.3.0 | Runtime | MIT |
| `react-dom` | 19.3.0 | Runtime | MIT |
| `@axe-core/playwright` | 4.13.0 | Development / tests | MPL-2.0 |
| `@playwright/test` | 1.64.0 | Development / tests | Apache-2.0 |
| `@testing-library/jest-dom` | 6.9.1 | Development / tests | MIT |
| `@testing-library/react` | 16.3.3 | Development / tests | MIT |
| `@types/node` | 22.20.5 | Development / tests | MIT |
| `@types/react` | 19.3.0 | Development / tests | MIT |
| `@types/react-dom` | 19.3.0 | Development / tests | MIT |
| `@vitejs/plugin-react` | 5.2.0 | Development / tests | MIT |
| `jsdom` | 26.1.0 | Development / tests | MIT |
| `prettier` | 3.9.10 | Development / tests | MIT |
| `typescript` | 5.8.3 | Development / tests | Apache-2.0 |
| `vite` | 7.3.7 | Development / tests | MIT |
| `vitest` | 5.0.3 | Development / tests | MIT |

## Frontend: full locked dependency tree

Includes optional/platform-specific and transitive packages; listing a package does not mean it is bundled into the browser. The lockfile is the source of exact package resolution.

| Lockfile path | Version | Declared licence |
| --- | --- | --- |
| `node_modules/@adobe/css-tools` | 4.5.0 | MIT |
| `node_modules/@asamuzakjp/css-color` | 3.2.0 | MIT |
| `node_modules/@asamuzakjp/css-color/node_modules/lru-cache` | 10.4.3 | ISC |
| `node_modules/@axe-core/playwright` | 4.13.0 | MPL-2.0 |
| `node_modules/@babel/code-frame` | 7.29.7 | MIT |
| `node_modules/@babel/compat-data` | 7.29.7 | MIT |
| `node_modules/@babel/core` | 7.29.7 | MIT |
| `node_modules/@babel/generator` | 7.29.8 | MIT |
| `node_modules/@babel/helper-compilation-targets` | 7.29.7 | MIT |
| `node_modules/@babel/helper-globals` | 7.29.7 | MIT |
| `node_modules/@babel/helper-module-imports` | 7.29.7 | MIT |
| `node_modules/@babel/helper-module-transforms` | 7.29.7 | MIT |
| `node_modules/@babel/helper-plugin-utils` | 7.29.7 | MIT |
| `node_modules/@babel/helper-string-parser` | 7.29.7 | MIT |
| `node_modules/@babel/helper-validator-identifier` | 7.29.7 | MIT |
| `node_modules/@babel/helper-validator-option` | 7.29.7 | MIT |
| `node_modules/@babel/helpers` | 7.29.10 | MIT |
| `node_modules/@babel/parser` | 7.29.9 | MIT |
| `node_modules/@babel/plugin-transform-react-jsx-self` | 7.29.7 | MIT |
| `node_modules/@babel/plugin-transform-react-jsx-source` | 7.29.7 | MIT |
| `node_modules/@babel/runtime` | 7.29.10 | MIT |
| `node_modules/@babel/template` | 7.29.7 | MIT |
| `node_modules/@babel/traverse` | 7.29.10 | MIT |
| `node_modules/@babel/types` | 7.29.8 | MIT |
| `node_modules/@csstools/color-helpers` | 5.1.0 | MIT-0 |
| `node_modules/@csstools/css-calc` | 2.1.4 | MIT |
| `node_modules/@csstools/css-color-parser` | 3.1.0 | MIT |
| `node_modules/@csstools/css-parser-algorithms` | 3.0.5 | MIT |
| `node_modules/@csstools/css-tokenizer` | 3.0.4 | MIT |
| `node_modules/@esbuild/aix-ppc64` | 0.28.2 | MIT |
| `node_modules/@esbuild/android-arm` | 0.28.2 | MIT |
| `node_modules/@esbuild/android-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/android-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/darwin-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/darwin-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/freebsd-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/freebsd-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-arm` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-ia32` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-loong64` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-mips64el` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-ppc64` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-riscv64` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-s390x` | 0.28.2 | MIT |
| `node_modules/@esbuild/linux-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/netbsd-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/netbsd-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/openbsd-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/openbsd-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/openharmony-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/sunos-x64` | 0.28.2 | MIT |
| `node_modules/@esbuild/win32-arm64` | 0.28.2 | MIT |
| `node_modules/@esbuild/win32-ia32` | 0.28.2 | MIT |
| `node_modules/@esbuild/win32-x64` | 0.28.2 | MIT |
| `node_modules/@fontsource/dm-sans` | 5.3.0 | OFL-1.1 |
| `node_modules/@fontsource/manrope` | 5.3.0 | OFL-1.1 |
| `node_modules/@fontsource/noto-sans-devanagari` | 5.3.0 | OFL-1.1 |
| `node_modules/@jridgewell/gen-mapping` | 0.3.13 | MIT |
| `node_modules/@jridgewell/remapping` | 2.3.5 | MIT |
| `node_modules/@jridgewell/resolve-uri` | 3.1.2 | MIT |
| `node_modules/@jridgewell/sourcemap-codec` | 1.6.0 | MIT |
| `node_modules/@jridgewell/trace-mapping` | 0.3.31 | MIT |
| `node_modules/@napi-rs/lzma-linux-x64-gnu` | 1.5.1 | MIT |
| `node_modules/@playwright/test` | 1.64.0 | Apache-2.0 |
| `node_modules/@rolldown/pluginutils` | 1.0.0-rc.3 | MIT |
| `node_modules/@rollup/rollup-android-arm-eabi` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-android-arm64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-darwin-arm64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-darwin-x64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-freebsd-arm64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-freebsd-x64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-arm-gnueabihf` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-arm-musleabihf` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-arm64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-arm64-musl` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-loong64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-loong64-musl` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-ppc64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-ppc64-musl` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-riscv64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-riscv64-musl` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-s390x-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-x64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-linux-x64-musl` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-openbsd-x64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-openharmony-arm64` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-win32-arm64-msvc` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-win32-ia32-msvc` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-win32-x64-gnu` | 4.64.5 | MIT |
| `node_modules/@rollup/rollup-win32-x64-msvc` | 4.64.5 | MIT |
| `node_modules/@testing-library/dom` | 10.4.2 | MIT |
| `node_modules/@testing-library/jest-dom` | 6.9.1 | MIT |
| `node_modules/@testing-library/jest-dom/node_modules/dom-accessibility-api` | 0.6.3 | MIT |
| `node_modules/@testing-library/react` | 16.3.3 | MIT |
| `node_modules/@types/aria-query` | 5.0.4 | MIT |
| `node_modules/@types/babel__core` | 7.20.5 | MIT |
| `node_modules/@types/babel__generator` | 7.27.0 | MIT |
| `node_modules/@types/babel__template` | 7.4.4 | MIT |
| `node_modules/@types/babel__traverse` | 7.28.0 | MIT |
| `node_modules/@types/chai` | 5.2.3 | MIT |
| `node_modules/@types/deep-eql` | 4.0.2 | MIT |
| `node_modules/@types/estree` | 1.0.9 | MIT |
| `node_modules/@types/node` | 22.20.5 | MIT |
| `node_modules/@types/react` | 19.3.0 | MIT |
| `node_modules/@types/react-dom` | 19.3.0 | MIT |
| `node_modules/@vitejs/plugin-react` | 5.2.0 | MIT |
| `node_modules/@vitest/mocker` | 5.0.3 | MIT |
| `node_modules/@vitest/spy` | 5.0.3 | MIT |
| `node_modules/agent-base` | 7.1.4 | MIT |
| `node_modules/ansi-regex` | 5.0.1 | MIT |
| `node_modules/ansi-styles` | 5.2.0 | MIT |
| `node_modules/aria-query` | 5.3.0 | Apache-2.0 |
| `node_modules/assertion-error` | 2.0.1 | MIT |
| `node_modules/axe-core` | 4.13.0 | MPL-2.0 |
| `node_modules/baseline-browser-mapping` | 2.11.28 | Apache-2.0 |
| `node_modules/browserslist` | 4.29.3 | MIT |
| `node_modules/caniuse-lite` | 1.0.30001815 | CC-BY-4.0 |
| `node_modules/chai` | 6.3.0 | MIT |
| `node_modules/convert-source-map` | 2.0.0 | MIT |
| `node_modules/css.escape` | 1.5.1 | MIT |
| `node_modules/cssstyle` | 4.6.0 | MIT |
| `node_modules/csstype` | 3.2.3 | MIT |
| `node_modules/data-urls` | 5.0.0 | MIT |
| `node_modules/debug` | 4.4.3 | MIT |
| `node_modules/decimal.js` | 10.6.0 | MIT |
| `node_modules/dequal` | 2.0.3 | MIT |
| `node_modules/dom-accessibility-api` | 0.5.16 | MIT |
| `node_modules/electron-to-chromium` | 1.5.452 | ISC |
| `node_modules/entities` | 6.0.1 | BSD-2-Clause |
| `node_modules/es-module-lexer` | 2.3.2 | MIT |
| `node_modules/esbuild` | 0.28.2 | MIT |
| `node_modules/escalade` | 3.2.0 | MIT |
| `node_modules/estree-walker` | 3.0.3 | MIT |
| `node_modules/expect-type` | 1.4.0 | Apache-2.0 |
| `node_modules/fdir` | 6.5.0 | MIT |
| `node_modules/fsevents` | 2.3.3 | MIT |
| `node_modules/gensync` | 1.0.0-beta.2 | MIT |
| `node_modules/html-encoding-sniffer` | 4.0.0 | MIT |
| `node_modules/http-proxy-agent` | 7.0.2 | MIT |
| `node_modules/https-proxy-agent` | 7.0.6 | MIT |
| `node_modules/iconv-lite` | 0.6.3 | MIT |
| `node_modules/indent-string` | 4.0.0 | MIT |
| `node_modules/is-potential-custom-element-name` | 1.0.1 | MIT |
| `node_modules/js-tokens` | 4.0.0 | MIT |
| `node_modules/jsdom` | 26.1.0 | MIT |
| `node_modules/jsesc` | 3.1.0 | MIT |
| `node_modules/json5` | 2.2.3 | MIT |
| `node_modules/lru-cache` | 5.1.1 | ISC |
| `node_modules/lucide-react` | 0.468.0 | ISC |
| `node_modules/lz-string` | 1.5.0 | MIT |
| `node_modules/magic-string` | 1.4.3 | MIT |
| `node_modules/min-indent` | 1.0.1 | MIT |
| `node_modules/ms` | 2.1.3 | MIT |
| `node_modules/nanoid` | 3.3.20 | MIT |
| `node_modules/node-releases` | 2.0.58 | MIT |
| `node_modules/nwsapi` | 2.2.28 | MIT |
| `node_modules/obug` | 2.2.1 | MIT |
| `node_modules/parse5` | 7.3.0 | MIT |
| `node_modules/picocolors` | 1.1.1 | ISC |
| `node_modules/picomatch` | 4.0.7 | MIT |
| `node_modules/playwright` | 1.64.0 | Apache-2.0 |
| `node_modules/playwright-core` | 1.64.0 | Apache-2.0 |
| `node_modules/postcss` | 8.5.29 | MIT |
| `node_modules/prettier` | 3.9.10 | MIT |
| `node_modules/pretty-format` | 27.5.1 | MIT |
| `node_modules/punycode` | 2.3.1 | MIT |
| `node_modules/react` | 19.3.0 | MIT |
| `node_modules/react-dom` | 19.3.0 | MIT |
| `node_modules/react-is` | 17.0.2 | MIT |
| `node_modules/react-refresh` | 0.18.0 | MIT |
| `node_modules/redent` | 3.0.0 | MIT |
| `node_modules/rollup` | 4.64.5 | MIT |
| `node_modules/rrweb-cssom` | 0.8.0 | MIT |
| `node_modules/safer-buffer` | 2.1.2 | MIT |
| `node_modules/saxes` | 6.0.0 | ISC |
| `node_modules/scheduler` | 0.28.0 | MIT |
| `node_modules/semver` | 6.3.1 | ISC |
| `node_modules/source-map-js` | 1.2.2 | BSD-3-Clause |
| `node_modules/std-env` | 4.3.0 | MIT |
| `node_modules/strip-indent` | 3.0.0 | MIT |
| `node_modules/symbol-tree` | 3.2.4 | MIT |
| `node_modules/tinybench` | 6.2.2 | MIT |
| `node_modules/tinyexec` | 1.3.1 | MIT |
| `node_modules/tinyglobby` | 0.2.17 | MIT |
| `node_modules/tldts` | 6.1.86 | MIT |
| `node_modules/tldts-core` | 6.1.86 | MIT |
| `node_modules/tough-cookie` | 5.1.2 | BSD-3-Clause |
| `node_modules/tr46` | 5.1.1 | MIT |
| `node_modules/typescript` | 5.8.3 | Apache-2.0 |
| `node_modules/undici-types` | 6.21.0 | MIT |
| `node_modules/update-browserslist-db` | 1.3.4 | MIT |
| `node_modules/vite` | 7.3.7 | MIT |
| `node_modules/vitest` | 5.0.3 | MIT |
| `node_modules/w3c-xmlserializer` | 5.0.0 | MIT |
| `node_modules/webidl-conversions` | 7.0.0 | BSD-2-Clause |
| `node_modules/whatwg-encoding` | 3.1.1 | MIT |
| `node_modules/whatwg-mimetype` | 4.0.0 | MIT |
| `node_modules/whatwg-url` | 14.2.0 | MIT |
| `node_modules/why-is-node-running` | 3.2.1 | MIT |
| `node_modules/ws` | 8.22.0 | MIT |
| `node_modules/xml-name-validator` | 5.0.0 | Apache-2.0 |
| `node_modules/xmlchars` | 2.2.0 | MIT |
| `node_modules/yallist` | 3.1.1 | ISC |

## Backend: exact locked dependencies

From `backend/requirements-lock.txt`. Licence fields below come from installed distribution metadata; the packages retain their own notices.

| Package | Version | Declared licence | Project |
| --- | --- | --- | --- |
| `annotated-doc` | 0.0.5 | MIT | [Upstream](https://github.com/fastapi/annotated-doc) |
| `annotated-types` | 0.8.0 | MIT | [Upstream](https://github.com/annotated-types/annotated-types) |
| `anyio` | 4.15.1 | MIT | [Upstream](https://github.com/agronholm/anyio) |
| `certifi` | 2026.7.22 | MPL-2.0 | [Upstream](https://github.com/certifi/python-certifi) |
| `click` | 8.5.0 | BSD-3-Clause | [Upstream](https://github.com/pallets/click/) |
| `distro` | 1.9.0 | Apache License, Version 2.0 | [Upstream](https://github.com/python-distro/distro) |
| `fastapi` | 0.143.0 | MIT | [Upstream](https://github.com/fastapi/fastapi) |
| `h11` | 0.16.0 | MIT | [Upstream](https://github.com/python-hyper/h11) |
| `httpcore` | 1.0.9 | BSD-3-Clause | [Upstream](https://www.encode.io/httpcore/) |
| `httpx` | 0.28.1 | BSD-3-Clause | [Upstream](https://github.com/encode/httpx) |
| `idna` | 3.20 | BSD-3-Clause | [Upstream](https://github.com/kjd/idna) |
| `iniconfig` | 2.3.1 | MIT | [Upstream](https://github.com/pytest-dev/iniconfig) |
| `jiter` | 0.17.0 | MIT | [Upstream](https://github.com/pydantic/jiter/) |
| `openai` | 2.54.0 | Apache-2.0 | [Upstream](https://github.com/openai/openai-python) |
| `opentelemetry-api` | 1.45.1 | Apache-2.0 | [Upstream](https://github.com/open-telemetry/opentelemetry-python/tree/main/opentelemetry-api) |
| `packaging` | 26.3 | Apache-2.0 OR BSD-2-Clause | [Upstream](https://github.com/pypa/packaging) |
| `pluggy` | 1.6.0 | MIT | See distribution metadata |
| `pydantic` | 2.14.0 | MIT | [Upstream](https://github.com/pydantic/pydantic) |
| `pydantic_core` | 2.50.0 | MIT | [Upstream](https://github.com/pydantic) |
| `Pygments` | 2.21.0 | BSD-2-Clause | [Upstream](https://pygments.org) |
| `pytest` | 9.1.1 | MIT | [Upstream](https://docs.pytest.org/en/latest/) |
| `python-dotenv` | 1.2.4 | BSD-3-Clause | [Upstream](https://github.com/theskumar/python-dotenv) |
| `ruff` | 0.17.0 | MIT | [Upstream](https://github.com/astral-sh/ruff) |
| `sniffio` | 1.3.1 | MIT OR Apache-2.0 | [Upstream](https://github.com/python-trio/sniffio) |
| `SQLAlchemy` | 2.0.54 | MIT | [Upstream](https://www.sqlalchemy.org) |
| `starlette` | 1.7.0 | BSD-3-Clause | [Upstream](https://github.com/Kludex/starlette) |
| `tqdm` | 4.70.1 | MPL-2.0 AND MIT | [Upstream](https://tqdm.github.io) |
| `typing-inspection` | 0.4.4 | MIT | [Upstream](https://github.com/pydantic/typing-inspection) |
| `typing_extensions` | 4.16.0 | PSF-2.0 | [Upstream](https://github.com/python/typing_extensions) |
| `uvicorn` | 0.54.0 | BSD-3-Clause | [Upstream](https://uvicorn.dev/) |

## Other development assets and services

The audio rebuild script uses edge-tts 7.2.7, PyAV 16.1.0 and NumPy. The retained earlier audio verification records gTTS 2.5.4 and faster-whisper 1.2.1 with the multilingual Whisper medium model. These are optional development tools, not backend runtime requirements. Groq, Microsoft/Google speech services, Render, GitHub and OpenAI development tools are services subject to their own terms; an open-source client licence does not replace those terms.

The submission presentation retains the supplied Aayu 2026 / DevAarambh template background, logos and layout. No open-source licence is asserted for that supplied template. Model weights were not bundled or trained in this repository.

The source handoff, workbook and symptom lists are team-supplied references. Their embedded clinical citations describe provenance, not clinical certification of the application.
