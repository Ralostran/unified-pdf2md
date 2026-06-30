.PHONY: install test lint check smoke convert review export

install:
	npm install

test:
	npm test

lint:
	npm run lint

check:
	npm run check

smoke:
	npm run smoke

convert:
	node apps/cli/bin/unified-pdf2md.js convert $(ARGS)

review:
	node apps/cli/bin/unified-pdf2md.js review $(ARGS)

export:
	node apps/cli/bin/unified-pdf2md.js export $(ARGS)
