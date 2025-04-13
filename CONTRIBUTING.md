# Contributing to NextLive

Thank you for your interest in contributing to NextLive! This document provides guidelines and instructions for contributing to our project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/nextlive/nextlive.git
   ```
3. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Making Changes

1. Follow our coding standards:
   - Use TypeScript for all new code
   - Follow the project's ESLint configuration
   - Write meaningful commit messages
   - Include tests for new features

2. Make your changes and test them thoroughly

3. Run the test suite:
   ```bash
   npm test
   ```

4. Ensure your code passes linting:
   ```bash
   npm run lint
   ```

## Submitting Changes

1. Commit your changes:
   ```bash
   git commit -m "Description of your changes"
   ```

2. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. Create a Pull Request (PR) to the main repository

## PR Guidelines

- Provide a clear description of your changes
- Reference any related issues
- Include screenshots for UI changes
- Ensure all tests pass
- Update documentation as needed

## Code Review Process

1. Your PR will be reviewed by maintainers
2. Address any feedback or requested changes
3. Once approved, your PR will be merged

## Development Workflow

1. Create an issue to discuss your proposed changes
2. Get approval from maintainers before starting work
3. Follow the branching strategy:
   - `main` - Production-ready code
   - `develop` - Development branch
   - `feature/*` - New features
   - `bugfix/*` - Bug fixes
   - `hotfix/*` - Urgent fixes

## Documentation

- Update relevant documentation
- Include JSDoc comments for new functions
- Update README if necessary

## Questions?

If you have any questions, please:
- Open an issue
- Join our community chat
- Contact the maintainers

Thank you for contributing to NextLive! 