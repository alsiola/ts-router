# Project

## Project Overview

This is a TypeScript-based Express application with dependency injection patterns. The codebase uses modular architecture with routers, validators, and injectors as core components.

## Build & Test Commands

No build or test commands have been specified in the analysis data.

## High-Risk Areas

### src/injectors.ts
Dependency injection logic is critical for application wiring. Modifications could affect all features and break dependency resolution. Exercise extreme caution when modifying this file. Ensure all dependency relationships are preserved and test thoroughly across the application.

### src/router.ts
Core routing logic handles all request routing. Changes here could break multiple endpoints and request handling. Any modifications should be tested against all registered routes. Verify that middleware chains and route handlers remain functional.

### src/validators.ts
Validation logic is security-critical. Modifications could weaken input validation and create vulnerabilities. Never remove or weaken validation rules without security review. Always add tests for validation changes to prevent bypasses.

### package.json
Dependency and script configuration file. Changes could break builds, deployments, or introduce incompatibilities. Review dependency updates carefully for breaking changes. Test all npm scripts after modifications.

## Code Conventions

- Language: TypeScript
- Framework: Express
- Architecture: Modular design with separation of concerns (routing, validation, injection)
- Follow existing patterns for dependency injection when adding new services
- Maintain consistent validation patterns across endpoints
- Keep routing logic declarative and maintainable
