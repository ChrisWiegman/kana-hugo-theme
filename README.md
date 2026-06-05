# Kana Theme

A warm, earthy dark Hugo theme for personal blogs. Features client-side search, a reading library, short-form notes, responsive images with WebP conversion, and Gruvbox syntax highlighting.

![Screenshot](https://github.com/ChrisWiegman/kana-hugo-theme/raw/main/images/screenshot.png)

**Demo**: [chriswiegman.com](https://chriswiegman.com)

## Requirements

- [Hugo](https://gohugo.io) extended, v0.152.0 or later
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
| `author` | string | Author name used as `dc:creator` in RSS feeds |
| `description` | string | Site description for meta tags |
| `subtitle` | string | Subtitle appended to the homepage title tag |
| `mainSections` | string[] | Content sections included in the homepage post list and RSS feed |
| `headerIcon` | string | Path (relative to `assets/`) to the icon shown in the site header |
| `imageSizes` | int[] | Image widths (px) to generate in srcset (e.g. `[850, 710, 300]`) |
| `imageSizeString` | string | The HTML `sizes` attribute for responsive images. Must be ordered **smallest breakpoint first** with no-condition default last (e.g. `"(max-width: 300px) 300w, (max-width: 710px) 710w, 850w"`) |
| `OpenGraph` | bool | Emit Open Graph meta tags |
| `TwitterCards` | bool | Emit Twitter Card meta tags |
| `jsonld` | bool | Emit JSON-LD meta tags |
| `FediverseCreator` | string | Fediverse handle for `fediverse:creator` meta tag (e.g. `"@user@instance.social"`) |
| `MobileWebAppTitle` | string | `apple-mobile-web-app-title` meta value |
| `policies` | string | Path to a policies page linked in the footer |
| `license` | object | `name`, `title`, and `link` shown in the footer (see below) |

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

[links]
amazon      = "https://www.amazon.com/..."
openlibrary = "https://openlibrary.org/..."
goodreads   = "https://www.goodreads.com/..."
```

The library page supports filtering by year finished, author, and star rating, plus sorting by title, author, rating, or date. A statistics panel shows books read per year, top authors, and rating distribution.

Add a `content/library.md` page with `layout: library` to activate it.

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
| 2 | `width` | `"225"` | Width in pixels |
| 3 | `height` | `"225"` | Height in pixels |
| 4 | `alt` | `""` | Alt text |

## Markdown Render Hooks

### Images

Markdown images are automatically rendered with:

- Responsive `srcset` based on `params.imageSizes`
- Lazy loading (`loading="lazy"`)
- WebP format output
- `<figure>`/`<figcaption>` for block images with a title

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
- **SEO** — Open Graph, Twitter Cards, Schema.org, Fediverse creator meta tag, canonical URLs
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

Runs Playwright browser tests against the local dev site. Requires `hugo` on your `PATH`.

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
│   ├── _default/           # generic list templates
│   ├── _markup/            # image and code block render hooks
│   ├── blog/               # blog archive template
│   ├── library/            # reading library template
│   ├── notes/              # notes archive and RSS feed
│   ├── partials/           # shared template fragments
│   ├── shortcodes/         # asset-image shortcode
│   ├── home.html
│   ├── search.html
│   ├── single.html
│   └── 404.html
└── scripts/
    └── screenshots.mjs     # screenshot generation script
```

## Formatting

Templates in `layouts/` are formatted with Prettier using the `go-template` parser. Use the Prettier VS Code extension (configured in `.vscode/settings.json`) to avoid breaking Hugo template markup.

## License

[MIT](https://github.com/ChrisWiegman/kana-hugo-theme/blob/main/LICENSE.txt)
