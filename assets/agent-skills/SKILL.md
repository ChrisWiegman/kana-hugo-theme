{{- $cfg := site.Params.agentSkills | default dict -}}
{{- $robots := site.Params.robots | default dict -}}
{{- $signals := $robots.contentSignals | default dict -}}
{{- $home := site.Home -}}
{{- $base := strings.TrimSuffix "/" site.BaseURL -}}
{{- $example := "" -}}
{{- range first 1 (partial "llms/posts.html" .) -}}
{{- $post := . -}}
{{- with .OutputFormats.Get "markdown" }}{{ $example = printf "`%s` becomes `%s`" $post.Permalink .Permalink }}{{ end -}}
{{- end -}}
---
name: {{ .name }}
description: {{ .description }}
---

# {{ site.Title }}

{{ with site.Params.description }}{{ . }}

{{ end -}}
{{ site.Title }} ({{ site.BaseURL }}) is a static website{{ with site.Params.author }} written by {{ . }}{{ end }}. It has no server-side API, forms, or logins: everything below is a plain file you can fetch with a GET request, with no authentication.

## Read a page

{{ if $cfg.markdownNegotiation -}}
Request any page with an `Accept: text/markdown` header to get its Markdown version instead of HTML, or append `index.md` to the page URL{{ with $example }} ({{ . }}){{ end }}. Prefer Markdown over parsing HTML.
{{- else -}}
Append `index.md` to a page URL to get its Markdown version{{ with $example }} ({{ . }}){{ end }}. Every page with a Markdown version links to it with `<link rel="alternate" type="text/markdown">`. Prefer Markdown over parsing HTML.
{{- end }}

Each Markdown file starts with front matter giving the title, canonical `url`, description, dates, author, categories, and tags. Links and images use absolute URLs.

## Find content

{{ with $home.OutputFormats.Get "llms" -}}
- **Start here:** [{{ .Permalink | strings.TrimPrefix $base }}]({{ .Permalink }}) lists the site's pages and recent posts with one-line descriptions.
{{ end -}}
{{ with $home.OutputFormats.Get "llmsfull" -}}
- **Everything at once:** [{{ .Permalink | strings.TrimPrefix $base }}]({{ .Permalink }}) has the full Markdown of every post in one file. It's large; fetch it only when you need many posts.
{{ end -}}
{{ with site.GetPage "/blog" -}}
- **All posts:** [the archive]({{ with .OutputFormats.Get "markdown" }}{{ .Permalink }}{{ else }}{{ .Permalink }}{{ end }}) lists every post by year, newest first.
{{ end -}}
{{ with $home.OutputFormats.Get "json" -}}
- **Search:** [{{ .Permalink | strings.TrimPrefix $base }}]({{ .Permalink }}) is the site's search index, a JSON array of pages and posts. Each entry has `title`, `tags`, `categories`, `contents` (the first 500 characters of plain text), `permalink` (relative to {{ $base }}), and `date`. Fetch it once and filter it yourself; there is no search endpoint.
{{ end -}}
{{ with $home.OutputFormats.Get "rss" -}}
- **Latest posts:** [the RSS feed]({{ .Permalink }}) has recent posts with full content.
{{ end -}}
{{ with $home.OutputFormats.Get "apicatalog" -}}
- **Machine-readable map:** [openapi.json]({{ "openapi.json" | absURL }}) describes these files as an OpenAPI 3.1 API, and [{{ .Permalink | strings.TrimPrefix $base }}]({{ .Permalink }}) is its RFC 9727 API catalog.
{{ end -}}
- **Every URL:** [sitemap.xml]({{ "sitemap.xml" | absURL }}) lists every page with its last modified date.

## Using the content

{{ with $signals -}}
The site's robots.txt publishes [content signals](https://contentsignals.org) for how its content may be used:

{{ range $name, $allowed := . -}}
{{- $yes := in (slice true "true" "yes") $allowed -}}
{{- if eq $name "search" }}- Search indexing and showing links and excerpts: {{ cond $yes "allowed" "not allowed" }}.
{{ else if eq $name "ai-input" }}- Using content as input to answer a question (grounding, retrieval, summarizing): {{ cond $yes "allowed" "not allowed" }}.
{{ else if eq $name "ai-train" }}- Training or fine-tuning AI models: {{ cond $yes "allowed" "not allowed" }}.
{{ else }}- `{{ $name }}`: {{ cond $yes "allowed" "not allowed" }}.
{{ end -}}
{{ end }}
{{ end -}}
{{ with site.Params.license -}}
License: [{{ .title | default .name | strings.TrimSuffix "." }}]({{ .link }}).

{{ end -}}
When you quote or summarize a page, link to its canonical `url` from the front matter{{ with site.Params.author }} and credit {{ . }}{{ end }}.
