# CLAUDE.md - AI Assistant Guide for Johniii_DooDooLTala

## Project Overview

**Johniii_DooDooLTala** is a website HTML static meter that connects to automation systems. This project provides a static web interface for monitoring and interacting with automation workflows.

- **Repository**: Tools-For-Inrernet/Johniii_DooDooLTala
- **License**: MIT License (2025 Tools for Internet)
- **Status**: New project (initial setup phase)

## Codebase Structure

```
Johniii_DooDooLTala/
├── README.md          # Project description and documentation
├── LICENSE            # MIT License
├── CLAUDE.md          # This file - AI assistant guidelines
└── .git/              # Git version control
```

### Future Expected Structure

As the project develops, expect the following structure:

```
Johniii_DooDooLTala/
├── index.html         # Main HTML entry point
├── css/               # Stylesheets
│   └── style.css
├── js/                # JavaScript files
│   └── main.js        # Main application logic
│   └── meter.js       # Meter/gauge components
│   └── automation.js  # Automation connection logic
├── assets/            # Static assets (images, icons)
├── docs/              # Documentation
├── tests/             # Test files
├── README.md
├── LICENSE
└── CLAUDE.md
```

## Development Guidelines

### Code Style Conventions

1. **HTML**
   - Use semantic HTML5 elements
   - Include proper meta tags and accessibility attributes
   - Indent with 2 spaces
   - Use lowercase for tags and attributes

2. **CSS**
   - Use BEM naming convention for classes
   - Organize styles by component
   - Use CSS custom properties (variables) for theming
   - Mobile-first responsive design

3. **JavaScript**
   - Use ES6+ features
   - Prefer `const` and `let` over `var`
   - Use meaningful variable and function names
   - Add JSDoc comments for functions
   - Handle errors gracefully

### File Naming Conventions

- Use lowercase with hyphens for files: `my-component.js`
- Use descriptive names that reflect purpose
- Keep names concise but meaningful

## Git Workflow

### Branch Strategy

- **main**: Production-ready code
- **claude/***: AI assistant development branches
- **feature/***: New feature development
- **fix/***: Bug fixes

### Commit Messages

Follow conventional commit format:

```
type(scope): brief description

[optional body with more details]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Pull Request Process

1. Create a descriptive branch name
2. Make focused, atomic commits
3. Write clear PR descriptions
4. Reference related issues if applicable

## Working with This Project

### For AI Assistants

When working on this repository:

1. **Read before modifying**: Always read existing files before making changes
2. **Maintain consistency**: Follow established patterns and conventions
3. **Keep it simple**: Avoid over-engineering; implement only what's needed
4. **Test changes**: Verify HTML/CSS/JS in a browser context when possible
5. **Document changes**: Update documentation when adding new features

### Common Tasks

#### Adding a New HTML Page
1. Create the HTML file in the root or appropriate subdirectory
2. Include proper doctype, meta tags, and link to stylesheets
3. Follow the established page structure

#### Adding Styles
1. Add styles to appropriate CSS file or create component-specific file
2. Use CSS custom properties for colors and common values
3. Ensure responsive design

#### Adding JavaScript Functionality
1. Create modular, reusable functions
2. Handle edge cases and errors
3. Avoid global namespace pollution

## Testing

### Manual Testing Checklist

- [ ] HTML validates (W3C Validator)
- [ ] CSS validates
- [ ] JavaScript runs without console errors
- [ ] Responsive design works across breakpoints
- [ ] Accessibility (keyboard navigation, screen readers)
- [ ] Cross-browser compatibility

### Browser Testing

Test in:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Build and Deployment

Currently a static site - no build process required. Files can be served directly or deployed to any static hosting provider.

### Deployment Options

- GitHub Pages
- Netlify
- Vercel
- Any static file server

## Dependencies

This is a static HTML project. External dependencies should be:
- Loaded via CDN when possible
- Documented in this file
- Kept to a minimum

### Current Dependencies

None yet - vanilla HTML/CSS/JS

## Security Considerations

- Sanitize any user input
- Use HTTPS in production
- Follow OWASP guidelines for web applications
- Be cautious with third-party scripts

## Troubleshooting

### Common Issues

1. **Styles not loading**: Check file paths and ensure CSS is linked correctly
2. **JavaScript errors**: Check browser console for specific error messages
3. **Responsive issues**: Use browser dev tools to test different viewports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Contact

Project maintained by: Tools for Internet

---

*Last updated: 2025-11-26*
