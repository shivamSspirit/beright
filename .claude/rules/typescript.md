---
globs: "**/*.ts"
---
# TypeScript Code Standards

## Strict Mode
- TypeScript strict mode is REQUIRED
- No `any` types without explicit justification comment
- Use proper type narrowing instead of type assertions

## Type Definitions
- Define interfaces for all data structures
- Use Zod for runtime validation with inferred types
- Export types from their source modules

## Naming Conventions
- camelCase for variables and functions
- PascalCase for types, interfaces, classes
- SCREAMING_SNAKE_CASE for constants
- Prefix interfaces with 'I' only if needed for clarity

## Function Signatures
- Explicit return types for public functions
- Use arrow functions for callbacks
- Destructure objects in parameters when >2 properties

## Error Handling
- Use custom error classes for domain errors
- Include error codes for programmatic handling
- Provide actionable error messages

## Imports
- Use absolute imports from project root
- Group imports: external, internal, types
- No circular dependencies

## Code Style
- Max line length: 100 characters
- Use const by default, let only when reassignment needed
- Prefer early returns over nested conditionals
