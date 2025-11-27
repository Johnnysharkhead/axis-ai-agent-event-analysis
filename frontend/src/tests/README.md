# Frontend Testing Guide

## Test Structure

Tests are organized in a separate `tests/` directory inside `src/`:

```
frontend/
  src/
    pages/
      Login.js
      Signup.js
      Dashboard.js
    tests/              # ← All tests here
      Login.test.js
      Signup.test.js
      Dashboard.test.js
      README.md
    setupTests.js
```

## Test Files

1. **Login.test.js** - 29 tests covering login form validation, API integration, button states, and lockout functionality
2. **Signup.test.js** - 35 tests covering signup validation, password matching, email format, and API integration
3. **Dashboard.test.js** - 24 tests covering navigation tiles, alarm states, and accessibility

**Total: 88 comprehensive frontend tests**

## Installation

Install required testing libraries:

```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in CI mode (no watch)
npm test -- --watchAll=false

# Run with coverage report
npm test -- --coverage --watchAll=false

# Run specific test file
npm test Login.test.js
```

## What's Tested

### Login Component
- Form rendering and layout
- Email and password validation
- Button states (loading, disabled, countdown)
- Login lockout mechanism (5 attempts → 60 second lockout)
- API call integration
- Navigation on success
- Error handling

### Signup Component
- All form fields rendering
- Required field validation
- Email format validation
- Password length validation (min 6 chars)
- Password matching validation
- Button states
- API integration
- Success state display
- Error handling

### Dashboard Component
- Navigation tiles rendering
- Tile links and routing
- Alarm indicator state
- Alarm image display
- Accessibility features (ARIA attributes)
- Layout structure

## CI/CD Integration

Add to `.gitlab-ci.yml`:

```yaml
test:frontend:
  stage: test
  image: node:18
  script:
    - cd frontend
    - npm ci
    - npm test -- --coverage --watchAll=false
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'
```

## Test Structure

Tests are organized by concern:
- **Rendering**: UI elements present
- **Validation**: Form validation logic
- **Button Functionality**: Button states and interactions
- **API Integration**: API calls and responses
- **Error Handling**: Error messages and recovery

## Mocking

API calls are mocked using Jest:
- `api.loginUser` - Mocked for Login tests
- `api.signupUser` - Mocked for Signup tests
- `react-router-dom.useNavigate` - Mocked for navigation tests

## Coverage Goals

- **Login**: ~95% coverage
- **Signup**: ~95% coverage
- **Dashboard**: ~90% coverage

Run `npm test -- --coverage` to see detailed coverage report.
