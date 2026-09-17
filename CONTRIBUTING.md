# Contributing to Sports Fixtures

Thank you for your interest in contributing to Sports Fixtures! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Making Changes](#making-changes)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Adding New Features](#adding-new-features)

---

## Code of Conduct

This project follows a Code of Conduct to ensure a welcoming and inclusive environment for everyone. Please be respectful, constructive, and professional in all interactions.

---

## Getting Started

### Prerequisites

- **Python** 3.12+
- **Node.js** 20+
- **Git**

### Setup

```bash
# Clone the repository
git clone https://github.com/W24F2/tks-fixture.git
cd tks-fixture

# Install dependencies
make install

# Build frontend
make build

# Start development server
make dev
```

The development server runs on port 5001 (Flask) and 5173 (Vite dev server with API proxy).

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. Protected. |
| `dev` | Integration branch. All features merge here. |
| `feature/<name>` | New features, branched from `dev`. |
| `bugfix/<name>` | Bug fixes, branched from `dev`. |
| `hotfix/<name>` | Urgent fixes to `main`, branched from `main`. |

**Workflow:**
1. Create a branch from `dev` (or `main` for hotfixes)
2. Make your changes
3. Create a Pull Request targeting `dev` (or `main` for hotfixes)
4. After approval, merge with a meaningful commit message

---

## Making Changes

### Before You Start

1. **Check for existing issues** — is there already an issue or PR for what you want to work on?
2. **Open an issue** if you're proposing something new — discuss the approach first.
3. **Pick up an existing issue** if you want to contribute quickly.

### Steps

1. **Fork and clone** the repository
2. **Create a branch:** `git checkout -b feature/my-feature dev`
3. **Make your changes** — follow the code style guidelines below
4. **Test locally** — ensure everything works
5. **Commit** with a clear message
6. **Push and open a PR**

---

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear, automated changelog generation.

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, config, CI) |
| `ci` | CI/CD changes |

### Examples

```
feat(api): add ETag caching to fixtures endpoint
fix(scraper): handle timezone-aware datetime comparison
docs(readme): update deployment instructions
style(lint): format Python files with ruff
refactor(models): extract status calculation to method
perf(api): use SHA-1 content fingerprint for ETag
test(scraper): add unit tests for date parsing
chore(deps): update Python dependencies
```

---

## Pull Request Process

### PR Checklist

- [ ] Branch is up to date with `dev` (or `main`)
- [ ] Code follows project style guidelines (Ruff, oxlint, mypy pass)
- [ ] Tests are added/updated where applicable
- [ ] Documentation is updated (README, wiki, inline comments)
- [ ] Self-review completed
- [ ] PR description explains the "why" not just the "what"

### PR Description Template

```markdown
## Description
Brief description of the change.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactor
- [ ] Performance improvement

## Testing
Describe the tests you ran and their results.

## Screenshots (if applicable)
Add screenshots of UI changes.

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have added/updated tests
- [ ] I have updated documentation
- [ ] I have tested locally
```

---

## Code Style

### Python

- **Formatter/Linter:** [Ruff](https://docs.astral.sh/ruff/) — `ruff check . && ruff format .`
- **Type checking:** [MyPy](https://mypy.readthedocs.io/) (lightweight)
- **Line length:** 100 characters
- **Indentation:** 4 spaces
- **Quotes:** Double quotes

```bash
# Lint
ruff check .

# Format
ruff format .

# Type check
mypy .
```

### TypeScript / Frontend

- **Linter:** Oxlint — `cd frontend && npm run lint`
- **Type checking:** TypeScript compiler — `cd frontend && npm run typecheck`
- **Build:** `cd frontend && npm run build`

```bash
cd frontend

# Lint
npm run lint

# Type check
npm run typecheck

# Build
npm run build
```

### General

- Use the provided `.editorconfig` for consistent whitespace, line endings, and indentation
- Always commit a `package-lock.json` in the frontend directory for reproducible builds

---

## Testing

### Running Tests

```bash
# Python tests
pytest tests/ -v

# With coverage
pytest tests/ -v --cov=. --cov-report=html

# Frontend linting
cd frontend && npm run lint

# Frontend type checking
cd frontend && npm run typecheck
```

### Adding Tests

- Place tests in the `tests/` directory
- Follow the naming convention: `test_<module>.py`
- Aim for meaningful test coverage — test edge cases and error paths
- Use `conftest.py` for shared fixtures

---

## Project Structure

```
tks-fixture/
├── app.py                    # Flask application factory + routes
├── database.py               # DB configuration + auto-migration
├── models.py                 # SQLAlchemy models (Fixture, Favourite)
├── scraper.py                # Trumba XML parsing logic
├── scraper_worker.py         # Scheduled scraper with self-healing
├── gunicorn.conf.py          # Production server config
├── requirements.txt          # Python dependencies
├── pyproject.toml            # Project metadata + tool config
├── Makefile                  # Build automation
├── .editorconfig             # Editor config
├── frontend/                 # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities (api, favourites, timezone, etc.)
│   │   ├── types/            # TypeScript interfaces
│   │   └── main.tsx          # Entry point
│   └── public/               # Static assets
├── static/
│   └── dist/                 # Built frontend assets
├── templates/                # Jinja2 templates
├── tests/                    # Pytest test suite
├── docs/
│   └── wiki.md               # Full project wiki
└── .github/workflows/        # CI/CD pipelines
```

---

## Adding New Features

### Backend Changes

1. Update or create SQLAlchemy models in `models.py`
2. Add routes in `app.py`
3. Add business logic in dedicated modules (e.g., a new `services/` folder)
4. Write tests in `tests/`
5. Document the API changes in the README or wiki

### Frontend Changes

1. Create/update components in `frontend/src/components/`
2. Update types in `frontend/src/types/`
3. Add/update utility functions in `frontend/src/lib/`
4. Ensure accessibility (ARIA labels, keyboard navigation)
5. Test in multiple screen sizes

### Database Changes

1. Use the auto-migration system for simple column additions
2. For complex migrations, add migration steps to `database.py`
3. Document the migration in the commit message

---

## Deployment

The project uses GitHub Actions for automated CI/CD:

- **Push to `dev`** → Lint, test, build, deploy to dev server
- **Push to `main`** → Lint, test, build, deploy to production

No manual deployment is required. Ensure your PR passes all checks before merging.

---

## Getting Help

- Open an [issue](https://github.com/W24F2/tks-fixture/issues) for bugs or feature requests
- Read the [full wiki](docs/wiki.md) for detailed technical documentation
- Check the [README](README.md) for setup and usage instructions

---

Thank you for contributing to Sports Fixtures! 🎉
