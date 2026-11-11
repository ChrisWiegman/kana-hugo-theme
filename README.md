# Kana Theme

A warm, earthy dark Hugo theme for personal blogs. Features client-side search, a reading library, short-form notes, responsive images with WebP conversion, and Gruvbox syntax highlighting.

![Screenshot](https://github.com/ChrisWiegman/kana-hugo-theme/raw/main/images/screenshot.png)

**Demo**: [chriswiegman.com](https://chriswiegman.com)

## Requirements

- [Hugo](https://gohugo.io) extended, v0.169.0 or later
- [Node.js](https://nodejs.org/en) + [npm](https://www.npmjs.com) (for Playwright tests and tooling only)

## Installation

### As a Hugo Module (recommended)

Initialize Hugo modules in your site if you haven't already:

```sh
hugo mod init github.com/your-username/your-site
```

Add the theme to your `hugo.toml`:

```toml
theme = "github.com/ChrisWiegman/kana-hugo-theme"
```

Then fetch the module:

```sh
hugo mod get github.com/ChrisWiegman/kana-hugo-theme
```

### As a Git Submodule

```sh
git submodule add https://github.com/ChrisWiegman/kana-hugo-theme themes/kana-hugo-theme
```

Then set the theme in your `hugo.toml`:

```toml
theme = "kana-hugo-theme"
```

### Manual Copy

Download or clone the repository and copy it into your site's `themes/kana-hugo-theme` directory.

## Configuration

For a complete working example, see [`dev/hugo.toml`](https://github.com/ChrisWiegman/kana-hugo-theme/blob/main/dev/hugo.toml).

### Minimal Configuration

```toml
theme = "github.com/ChrisWiegman/kana-hugo-theme"

[params]
mainSections = ["posts"]
description  = "Your site description"

[outputs]
home = ["HTML", "RSS", "JSON"]
```

The `JSON` output on `home` is required for client-side search to work.

### Theme Parameters

| Parameter | Type | Description |
|---|---|---|
| `author` | string | Author name used as `dc:creator` in RSS feeds and in JSON-LD (omitted when unset) |
| `description` | string | Site description for meta tags |
| `subtitle` | string | Subtitle appended to the homepage title tag |
| `mainSections` | string[] | Content sections included in the homepage post list, RSS feed, search index, and JSON-LD `BlogPosting` markup |
| `headerIcon` | string | Path (relative to `assets/`) to the icon shown in the site header. A missing file logs a warning instead of failing the build |
| `imageSizes` | int[] | Image widths (px) to generate in srcset. Defaults to `[1700, 1420, 850, 710, 600, 300]`, which covers the 850px content column at 1x and 2x |
| `imageSizeString` | string | The HTML `sizes` attribute for responsive images: the image's displayed width as a CSS length (`px`, `vw`, or `calc()`, never `w`). Defaults to `"(max-width: 882px) calc(100vw - 2rem), 850px"`, which matches the theme's content column |
| `OpenGraph` | bool | Emit Open Graph meta tags |
| `TwitterCards` | bool | Emit Twitter Card meta tags |
| `jsonld` | bool | Emit JSON-LD meta tags (off by default) |
| `FediverseCreator` | string | Fediverse handle for `fediverse:creator` meta tag (e.g. `"@user@instance.social"`) |
| `MobileWebAppTitle` | string | `apple-mobile-web-app-title` meta value |
| `policies` | string | Path to a policies page linked in the footer |
| `pagerSize` | int | Number of books shown per batch in the library (default `25`) |
| `websubHub` | string | WebSub hub advertised in RSS feeds (default `"https://pubsubhubbub.appspot.com/"`; set to `""` to omit it) |
| `license` | object | `name`, `title`, and `link` shown in the footer (see below) |

### Image Quality

Hugo doesn't read `[imaging]` settings from a theme, so set them in your site's config. Hugo's defaults (quality 75, `box` resampling) visibly soften images. Recommended:

```toml
[imaging]
resampleFilter = "lanczos"

[imaging.jpeg]
quality = 85

[imaging.webp]
quality = 85
# For sites that are mostly screenshots or text, also add:
# hint = "drawing"
```

After changing these, delete `resources/_gen/images` so Hugo regenerates its cached images.

### License Footer

```toml
[params.license]
name  = "MIT Licensed"
title = "Short tooltip text"
link  = "https://example.com/license"
```

### Menus

The theme supports two menus: `main` (header) and `footer`.

```toml
[[menus.main]]
name    = "Blog"
pageRef = "/blog"
weight  = 10

[[menus.footer]]
name   = "RSS"
url    = "/index.xml"
weight = 10
```

## Content Types

### Posts

Standard blog posts. Recommended permalink structure:

```toml
[permalinks]
posts = "/:year/:month/:slug/"
```

Front matter:

```toml
title      = "Post title"
date       = 2025-09-15T15:47:00+00:00
draft      = false
images     = ["/images/path/to/image.jpeg"]
categories = ["Category"]
tags       = ["tag-one", "tag-two"]
```

### Notes

Short-form content with its own paginated archive and RSS feed at `/notes/index.xml`. Notes are grouped by year.

Front matter:

```toml
title = "Note title"
date  = 2025-06-27T00:00:00+00:00
draft = false
```

### Books (Library)

A reading library with interactive filtering and statistics. Books live in a headless `content/books/` section, organised by author slug.

```
content/
└── books/
    ├── index.md          # headless: true
    └── author-name/
        └── book-title.md
```

Front matter:

```toml
title    = "Book Title"
author   = "Author Name"
rating   = 4

finished = ["2024-10-23"]   # multiple dates supported for re-reads

cover    = "/images/books/book-title.jpg"   # optional

[links]
amazon      = "https://www.amazon.com/..."
openlibrary = "https://openlibrary.org/..."
goodreads   = "https://www.goodreads.com/..."

[reference]
isbn = "9780000000000"
asin = "B000000000"
```

`cover` and `reference` are stored for use by your own templates; the library page does not display them yet. New books can be scaffolded with `hugo new books/author-name/book-title.md`, which uses the `books` archetype.

The library page supports filtering by year finished, author, and star rating, plus sorting by title, author, rating, or date. A statistics panel shows books read per year, top authors, and rating distribution.

Books load progressively: an initial batch is shown (controlled by `params.pagerSize`, default 25; this is separate from Hugo's `pagination.pagerSize`, which controls the notes archive), and further batches append to the bottom of the list as you scroll, with a "Load More Books" link as a fallback trigger. Changing a sort or filter starts back at the first batch.

Add a `content/library.md` page with `type: library` and `layout: library` to activate it. The page title is used as the library heading.

### Search

Add a `content/search.md` page:

```toml
+++
title = "Search"
layout = "search"
+++
```

The search index is built from the JSON output on the homepage and runs entirely client-side — no server required. It searches post titles, categories, tags, and body content.

## Shortcodes

### asset-image

Inserts a responsive image from `assets/` with automatic WebP conversion.

```
{{< asset-image "images/photo.jpg" "800" "600" "Alt text" >}}
```

| Position | Parameter | Default | Description |
|---|---|---|---|
| 1 | `path` | — | Path relative to `assets/` |
| 2 | `width` | `"225"` | Displayed width in pixels (the image is generated at up to 2x for high-density screens) |
| 3 | `height` | `"225"` | Displayed height in pixels |
| 4 | `alt` | `""` | Alt text |

## Markdown Render Hooks

### Images

Markdown images are resolved from the page bundle first, then from `assets/`, and automatically rendered with:

- Responsive WebP `srcset` based on `params.imageSizes` (sizes wider than the original image are skipped, so images are never upscaled)
- Lazy loading (`loading="lazy"`)
- `<figure>`/`<figcaption>` for block images with a title

Images the theme cannot process (remote URLs, files in `static/`, SVGs) are rendered as a plain `<img>` instead of failing the build.

### Code Blocks

Code blocks support extra attributes:

````markdown
```go {file="main.go"}
package main
```
````

Features:
- Gruvbox syntax highlighting
- Optional filename label (`file=`)
- Collapsible blocks (`details=true`)
- Supports 200+ languages

## Features

- **Dark theme** — warm Gruvbox-inspired palette
- **Client-side search** — no server needed; indexes title, tags, categories, and content
- **Reading library** — filterable, sortable book list with statistics
- **Notes** — short-form content with its own RSS feed
- **Responsive images** — automatic WebP conversion, srcset generation, lazy loading
- **Syntax highlighting** — Gruvbox theme, collapsible blocks, filename labels
- **SEO** — Open Graph, Twitter Cards, Schema.org, Fediverse creator meta tag, canonical URLs, JSON-LD
- **RSS** — site-wide feed plus a per-section feed for notes
- **Sitemap** and **robots.txt** included

## Local Development

### Running the Development Site

```sh
make dev
```

The site will be available at `http://localhost:1313`.

### End-to-End Testing

```sh
make test
```

Runs Playwright browser tests (Chromium) against the dev site on port 1314. Requires `hugo` on your `PATH`.

### Linting

```sh
make lint
```

Runs ESLint over the theme scripts, Playwright tests, and tooling scripts.

### Updating Screenshots

```sh
make screenshots
```

Regenerates `images/screenshot.png` (1500×1000) and `images/tn.png` (900×600) from the dev site.

## Project Structure

```
├── assets/
│   ├── scripts/
│   │   ├── library.js      # book filtering and sorting
│   │   └── search.js       # client-side search
│   └── scss/               # component-based stylesheets
├── dev/                    # local development site
│   ├── content/
│   └── hugo.toml
├── e2e/                    # Playwright tests
├── images/                 # theme screenshots
├── layouts/
│   ├── _default/           # generic list and JSON templates
│   ├── _markup/            # image and code block render hooks
│   ├── blog/               # blog archive template
│   ├── library/            # reading library template
│   ├── notes/              # notes archive and RSS feed
│   ├── _partials/          # shared template fragments
│   ├── shortcodes/         # asset-image shortcode
│   ├── baseof.html
│   ├── home.html
│   ├── index.json          # client-side search index
│   ├── rss.xml
│   ├── search.html
│   ├── single.html
│   ├── sitemap.xml
│   ├── term.html
│   └── 404.html
└── scripts/
    └── screenshots.mjs     # screenshot generation script
```

## Formatting

Templates in `layouts/` are formatted with [gotmplfmt](https://github.com/gohugoio/gotmplfmt). `make install` installs a pinned version into `./bin`, which is where the gotmplfmt VS Code extension (configured in `.vscode/settings.json`) looks for it.

## License

[MIT](https://github.com/ChrisWiegman/kana-hugo-theme/blob/main/LICENSE.txt)
