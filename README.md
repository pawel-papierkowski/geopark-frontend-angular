# GeoPark Frontend Angular

This project is *frontend* part of **GeoPark system**, designed to work with backend project `geopark-backend-java`.

This project is in design stage.

Right now, backend part does not exist. There is a lot to do before it is needed.

## Basic info

Author: **Paweł Papierkowski**

Date: **2026**

Used IDE: **Visual Studio Code**

### Tech stack

- Languages: HTML, CSS, JavaScript/TypeScript
- Frameworks: **Node.js** 24.19, **Angular** 22.1.6
- Tests: **Vitest** and **PlayWright**.

### Links

- Webpage address:
  - User website: https://pawelpapierkowski.net.pl/geopark-frontend-angular
  - Dev panel: https://pawelpapierkowski.net.pl/geopark-frontend-angular/dev
  - Admin panel: https://pawelpapierkowski.net.pl/geopark-frontend-angular/admin
- Locally run Angular server:
  - User website: http://localhost:4200/
  - Admin panel: http://localhost:4200/admin
  - Dev panel: http://localhost:4200/dev
- Link to source code: https://github.com/pawel-papierkowski/geopark-frontend-angular

## Functionality

GeoPark handles all things related to city parking system: parking meters, zoning, fine processing, complaints, registry of operators and inspectors etc.

### Features

Planned features includes:
- Map views and allowing users with appropriate permissions (operators) to add/edit/remove parking meters, add/edit/remove zones (geofenced) and similar tasks.
- Handling simulated events like car inspection by inspector or paying for parking by driver.

## Pages

Frontend is split into three major sections: **user-facing website**, **dev panel** and **admin panel**. Website as a whole is Single Page Application (SPA).

TODO: list important pages
- **User website**: Available to everyone.
- **Development panel**: Available to devs. Contains debug and test pages for various frontend features of system.
  - **Custom components**: This page allows you to play with and test all custom form components used by this project.
  - **Login debug**: Shows various data related to login state of user in system, including JWT values.
- **Administration panel**: If not logged, only page available is login page on admin side. Other pages redirect to login page (if unlogged) or main page on user website (if logged without required permissions).

Note that by nature of portfolio project everything is actually available for you. For example, you can register admin user for yourself by just marking checkbox or enter development panel from anywhere. In real system obviously that would not be possible.

### Translations

Translations are provided in `/public/i18n`. Each directory inside contains data for given language.

## Commands

### Local startup

To build the project, run:

```bash
npm run build
```

To start a local development server, run:

```bash
npm start
```

### Verification

TODO: add commands for verification, like lint etc

### Testing

To execute all unit tests with the Vitest test runner, use the following command:

```bash
npm test
```

To execute only selected file, run:

```bash
npm test -- src/app/example/example.spec.ts
```

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

This project uses PlayWright.

### Other

TODO: other useful commands.

## Deployment

Source code is on **GitHub**. This app lives on **GitHub Pages** and is deployed there via **GitHub Actions**.

TODO

## Additional packages

Besides Angular itself, we use additional libraries.
- General libraries
  - **ngx-translate** - For language support.
- Development only
