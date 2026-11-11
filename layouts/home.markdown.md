{{- $posts := partial "llms/posts.html" . -}}
{{- partial "llms/frontmatter.html" . }}

# {{ site.Title }}
{{ with partial "llms/content.html" . }}
{{ . }}
{{ end }}
{{- with $posts }}
## Recent posts

{{ range first 10 . -}}
- [{{ .Title }}]({{ partial "llms/url.html" . }}) ({{ .Date.Format "2006-01-02" }}){{ with partial "llms/description.html" . }}: {{ . }}{{ end }}
{{ end -}}
{{- end }}
{{- with site.GetPage "/blog" }}
[All posts]({{ partial "llms/url.html" . }})
{{ end -}}
