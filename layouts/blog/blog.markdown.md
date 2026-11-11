{{- $posts := partial "llms/posts.html" . -}}
{{- partial "llms/frontmatter.html" . }}

# {{ .Title }}
{{ with partial "llms/content.html" . }}
{{ . }}
{{ end }}
{{- range $posts.GroupByDate "2006" }}
## {{ .Key }}

{{ range .Pages -}}
- [{{ .Title }}]({{ partial "llms/url.html" . }}) ({{ .Date.Format "2006-01-02" }})
{{ end -}}
{{ end -}}
