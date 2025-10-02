# Contributing to WaspBot

Thank you for your interest in contributing to WaspBot! This document provides guidelines and information for contributors. Whether you're fixing bugs, adding features, improving documentation, or helping with testing, your contributions are welcome and appreciated.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Ways to Contribute

There are many ways to contribute to WaspBot:

- **Code Contributions**: Fix bugs, implement new features, or improve existing functionality
- **Documentation**: Improve documentation, add examples, or create tutorials
- **Testing**: Write tests, report bugs, or help with test coverage
- **Design**: Suggest improvements to the architecture or API design
- **Community**: Help answer questions, review pull requests, or mentor new contributors

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### Installation

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/waspbot-ts.git
   cd waspbot-ts
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Set up pre-commit hooks:
   ```bash
   npm run prepare
   ```

### Development Workflow

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the [coding standards](#coding-standards)

3. Run the development tools:

   ```bash
   # Type checking
   npm run typecheck

   # Linting
   npm run lint

   # Formatting
   npm run format

   # Build
   npm run build
   ```

4. Test your changes (see [Testing](#testing) section)

5. Commit your changes following the [commit guidelines](#commit-guidelines)

6. Push to your fork and create a pull request

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Use interfaces for object shapes
- Avoid `any` type; use proper typing
- Use union types and generics where appropriate

### Code Style

- Follow the existing code style in the project
- Use Prettier for automatic code formatting
- Use ESLint for code quality
- Maximum line length: 100 characters
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### File Organization

- Keep files small and focused on a single responsibility
- Use consistent naming conventions
- Group related functionality in appropriate directories
- Export public APIs from `index.ts` files

### Error Handling

- Use proper error handling with try/catch blocks
- Throw descriptive error messages
- Use custom error classes for specific error types
- Handle async errors appropriately

## Testing

Testing is crucial for maintaining code quality. Currently, the project has placeholder test files that need implementation.

### Running Tests

```bash
npm run test
```

_Note: Test script needs to be added to `package.json`_

### Writing Tests

- Write unit tests for all new functionality
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies
- Aim for good test coverage

### Test Structure

- Place test files in the `tests/` directory
- Name test files with `.test.ts` extension
- Group related tests in `describe` blocks
- Use `it` or `test` for individual test cases

## Commit Guidelines

We follow conventional commit format for commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(connector): add Binance WebSocket connector

fix(order-manager): handle order cancellation edge cases

docs(readme): update installation instructions

test(strategies): add unit tests for arbitrage strategy
```

### Commit Best Practices

- Write clear, concise commit messages
- Use present tense ("add feature" not "added feature")
- Reference issue numbers when applicable
- Keep commits focused on a single change
- Squash related commits before merging

## Pull Request Process

1. **Create a Pull Request**
   - Use a descriptive title following commit conventions
   - Provide a clear description of the changes
   - Reference any related issues

2. **Code Review**
   - Address review comments promptly
   - Make requested changes or explain why changes aren't needed
   - Ensure CI checks pass

3. **Testing**
   - Ensure all tests pass
   - Add tests for new functionality
   - Test manually if applicable

4. **Merge**
   - Squash and merge approved PRs
   - Delete feature branches after merging

### PR Template

Please use the following template for pull requests:

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring
- [ ] Test addition

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] CI checks pass

## Related Issues

Closes #123
```

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Node.js version, OS, etc.
- **Code Sample**: Minimal code to reproduce the issue

### Feature Requests

For feature requests, please include:

- **Description**: Clear description of the proposed feature
- **Use Case**: Why this feature would be useful
- **Implementation Ideas**: Any thoughts on how to implement it
- **Alternatives**: Other solutions you've considered

### Issue Labels

We use the following labels for issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `help wanted`: Good for newcomers
- `good first issue`: Good for first-time contributors

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

By contributing to WaspBot, you agree that your contributions will be licensed under the same license as the project (Apache License 2.0). See [LICENSE](LICENSE) for details.

---

Thank you for contributing to WaspBot! Your efforts help make algorithmic trading more accessible and robust for everyone. 🚀
