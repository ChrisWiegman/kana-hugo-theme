ARGS = `arg="$(filter-out $@,$(MAKECMDGOALS))" && echo $${arg:-${1}}`

.PHONY: change
change: install
	npx changie new

.PHONY: clean
clean:
	rm -rf \
		*.zip \
		bin \
		node_modules \
		dev/public \
		dev/resources \
		dev/.hugo_build.lock \
		test-results

.PHONY: dev
dev:
	cd dev && hugo serve -DFO

.PHONY: changelog
changelog: install
	npx changie batch $(call ARGS,defaultstring)
	npx changie merge

.PHONY: install
install:
	if [ ! -d ./node_modules/ ] || [ ! -x ./node_modules/.bin/playwright ]; then \
		npm ci; \
	fi
	if ! command -v gotmplfmt > /dev/null 2>&1; then \
		go install github.com/gohugoio/gotmplfmt@latest; \
	fi

.PHONY: release
release: clean
	@echo "Building release file: kana-hugo-theme.$(call ARGS,defaultstring).zip"
	THEME_VERSION=$(call ARGS,defaultstring) && \
		cd ../ && \
		zip \
		--verbose \
		--recurse-paths \
		--exclude="*.changes/*" \
		--exclude="*.changie.yaml" \
		--exclude="*.claude/*" \
		--exclude="*.git/*" \
		--exclude="*.github/*" \
		--exclude="*.gitignore" \
		--exclude="*.vscode/*" \
		--exclude="*dev/*" \
		--exclude="*e2e/*" \
		--exclude="*Makefile" \
		--exclude="*node_modules/*" \
		--exclude="*package.json" \
		--exclude="*package-lock.json" \
		--exclude="*playwright.config.js" \
		--exclude="*scripts/*" \
		--exclude="*test-results/*" \
		--exclude="*CHANGELOG.md" \
		--exclude="*README.md" \
		--exclude="*.zip" \
		kana-hugo-theme/kana-hugo-theme.$(call ARGS,defaultstring).zip \
		kana-hugo-theme/*
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
	npx playwright install
	npm run e2e

.PHONY: lint
lint:
	npm run lint
