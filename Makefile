.PHONY: build-frontend install-frontend dev-frontend dev clean

install-frontend:
	cd frontend && npm install

build-frontend:
	cd frontend && npm run build

dev-frontend:
	cd frontend && npm run dev

dev: build-frontend
	python app.py

clean:
	rm -rf static/dist frontend/node_modules

build: install-frontend build-frontend

install: install-frontend
	pip install -r requirements.txt