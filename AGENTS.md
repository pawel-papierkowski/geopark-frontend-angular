You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

# Angular 22 Frontend Project Instructions

**GeoPark** is a portfolio project for frontend in Angular. It is part of a bigger system that contains frontend and backend.

GeoPark handles all things related to city parking system: parking meters, zoning (includes geofencing), fine processing, complaints, registry of operators and inspectors etc.

## Tech Stack & Architecture
- **Language:** JavaScript/TypeScript.
- **Framework:** Angular 22.

## Development Guidelines

### General
- **CSS:**
  - Use kebab-case for CSS classes.
- **Language:**
  - Use semicolons.
  - Use strict type checking.
  - Prefer type inference when the type is obvious.
  - Avoid the `any` type; use `unknown` when type is uncertain.
  - Code must be well commented. Use `@param`, `@returns` and similar.
- **Framework:**
  - Always use standalone components over NgModules.
  - Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
  - Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
  - Use signals for state management.
  - Implement lazy loading for feature routes.
  - Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead.
  - Use `NgOptimizedImage` for all static images.
    - `NgOptimizedImage` does not work for inline base64 images.
- **Accessibility Requirements:**
  - It MUST pass all AXE checks.
  - It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.
- **Components:**
  - Keep components small and focused on a single responsibility.
  - Use `input()` and `output()` functions instead of decorators.
  - Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`.
  - Use `computed()` for derived state.
  - Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized.
  - Prefer inline templates for small components.
  - Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation.
  - When not using Signal Forms, prefer Reactive forms instead of Template-driven ones.
  - Do NOT use `ngClass`, use `class` bindings instead.
  - Do NOT use `ngStyle`, use `style` bindings instead.
  - Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`.
  - When using external templates/styles, use absolute paths via `@/`. You can use relative paths for files within same feature.
- **State Management:**
  - Use signals for local component state.
  - Use `computed()` for derived state.
  - Keep state transformations pure and predictable.
  - Do NOT use `mutate` on signals, use `update` or `set` instead.
- **Templates:**
  - Keep templates simple and avoid complex logic.
  - Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
  - Use the async pipe to handle observables.
  - Do not assume globals like (`new Date()`) are available.
- **Services:**
  - Design services around a single responsibility.
  - Use the `providedIn: 'root'` option for singleton services.
  - Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+).
  - Use the `inject()` function instead of constructor injection.

### Testing

- Group tests into logical test suites in `describe()`.
- Every test must have marked sections: Arrange, Act, Assert. In some cases it is allowed to skip section (usually Act when Arrange also acts).

### Other
- Ignore `TODO.md`, unless I explicitly refer it.

## Architecture

### Structure

Project is divided into three sections:
- `/`: user-facing pages, publicly available
- `/dev`: development pages, used for testing and debug
- `/admin`: administration panel

### Filesystem
- `public`: Assets.
- `src`: Source code.
  - `app`: Actual application.
  - `core`: Application-wide infrastructure. Examples: authentication session, interceptors, configuration.
  - `environments`: Defines data that differ between various types of deployment.
  - `features`: Business functionality. Examples: user account handling.
  - `layout`: Application layout and pages. Examples: navigation, header, footer.
  - `shared`: Reusable code indepedent of features. Examples: dialog, date pipe, generic utility.
  - `styles`: Globally available styles.
    - `general`: Contain reset and base styles.
    - `var`: Contains variables.
    - `app`: Contains actually used styles.

Core and shared should not import from features.

## Available Scripts & Commands

- **Deployment**:
  - Build: `npm run build`
  - Run: `npm start`
- **Testing**:
  - Run all unit tests: `npm test`
  - Run single test file: `npm test -- src/app/example/example.spec.ts`
  - Run all e2e tests: `ng e2e`
Note: `ng` command will NOT work.
