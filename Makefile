.PHONY: all lint push

all: lint push

lint:  # run eslint
	npm run lint

push:  # push code to google drive
	npm run push
