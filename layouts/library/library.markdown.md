{{- $books := slice -}}
{{- with site.GetPage "books" }}{{ $books = sort (.Resources.ByType "page") "Title" }}{{ end -}}
{{- partial "llms/frontmatter.html" . }}

# {{ .Title }}
{{ with partial "llms/content.html" . }}
{{ . }}
{{ end }}
{{ len $books }} books. Ratings are out of 5; dates are when each book was finished.

{{ range $books -}}
{{- $finished := slice -}}
{{- range .Params.finished }}{{ $finished = $finished | append ((time .).Format "2006-01-02") }}{{ end -}}
- {{ .Title }}{{ with .Params.author }} by {{ . }}{{ end }}{{ with .Params.rating }} — {{ . }}/5{{ end }}{{ with $finished }} — finished {{ delimit . ", " }}{{ end }}{{ with .Params.reference.isbn }} — ISBN {{ . }}{{ end }}
{{ end -}}
