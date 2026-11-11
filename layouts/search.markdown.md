{{- partial "llms/frontmatter.html" . }}

# {{ .Title }}

Search this site by requesting {{ .Permalink }}?s=your+query in a browser. Results are rendered client-side from {{ with site.Home.OutputFormats.Get "json" }}{{ .Permalink }}{{ end }}, a JSON index of every page and post.
