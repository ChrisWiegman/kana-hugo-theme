ARGS = `arg="$(filter-out $@,$(MAKECMDGOALS))" && echo $${arg:-${1}}`

GOTMPLFMT_VERSION = v0.5.0

export PATH := $(CURDIR)/bin:$(CURDIR)/node_modules/.bin:$(PATH)

.PHONY: change
change: install
	npx changie new

.PHONY: clean
clean:
	rm -rf \
		*.zip \
		bin \
		build \
		playwright-report \
		node_modules \
		dev/public \
		dev/resources \
		dev/.hugo_build.lock \
		test-results \
		.claude

.PHONY: dev
dev:
	cd dev && PATH="$$(pwd)/../node_modules/.bin:$$PATH" hugo serve -DFO

.PHONY: changelog
changelog: install
	npx changie batch $(call ARGS,defaultstring)
	npx changie merge

.PHONY: install
install:
	if [ ! -d ./node_modules/ ] || [ ! -x ./node_modules/.bin/playwright ]; then \
		npm ci; \
	fi
	if [ ! -x ./bin/gotmplfmt ]; then \
		GOBIN=$(CURDIR)/bin go install github.com/gohugoio/gotmplfmt@$(GOTMPLFMT_VERSION); \
	fi

.PHONY: release
release: clean
	@echo "Building release file: kana-hugo-theme.$(call ARGS,defaultstring).zip"
	rm -rf build && mkdir -p build/kana-hugo-theme
	cp theme.toml LICENSE.txt README.md build/kana-hugo-theme/
	cp -r archetypes assets layouts build/kana-hugo-theme/
	cd build && zip --recurse-paths ../kana-hugo-theme.$(call ARGS,defaultstring).zip kana-hugo-theme
	rm -rf build
	if [ ! -f ./kana-hugo-theme.$(call ARGS,defaultstring).zip  ]; then \
		echo "file not available"; \
		exit 1; \
	fi

.PHONY: screenshots
screenshots: install
	npx playwright install chromium
	node scripts/screenshots.mjs

.PHONY: test
test: install
	npx playwright install chromium
	npm run e2e

.PHONY: lint
lint: install
	npm run lint
