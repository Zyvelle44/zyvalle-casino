::: {align="center"}
# Zyvalle Casino

**A full-stack casino-style game platform built with React, Vite,
Node.js, Express, and MySQL.**

[Repository](https://github.com/Zyvelle44/zyvalle-casino) · [Discord
Community & Game Assets](http://discord.gg/VbuWSHfYm)
:::

------------------------------------------------------------------------

## Overview

Zyvalle Casino is a web application with a React/Vite frontend, a
Node.js/Express API, and a MySQL database. The project includes a game
catalog, account and wallet functionality, transaction workflows,
favorites, game settings, and integrations for supported game engines.

> **Important:** This repository does not necessarily include every game
> asset or library. A game can be listed in the catalog without being
> playable. Only games with matching assets and a compatible server-side
> game implementation can be launched.

## Features
-   React + Vite web client.
-   Node.js + Express REST API.
-   MySQL database integration.
-   Account authentication and admin access.
-   Game catalog and provider metadata.
-   Wallet, deposit/withdrawal request workflows, and transaction
    history.
-   Game favorites and game-play history.
-   Database-backed slot game settings, including configured RTP
    display.
-   Game asset loading from a local asset directory.
-   Server-side integrations for currently supported games:
    -   Gates of Olympus
    -   Starlight Princess
    -   Starlight Christmas
    -   Aztec Gems Deluxe

Feature availability depends on the source version, database migrations,
configuration, and locally installed assets.

## Technology Stack

  -----------------------------------------------------------------------
  Component                           Technology
  ----------------------------------- -----------------------------------
  Frontend                            React 18, Vite 6, JavaScript

  Backend                             Node.js, Express 4

  Database                            MySQL 8+ recommended

  Database driver                     `mysql2`

  Authentication/security             JSON Web Tokens, bcrypt, Helmet,
                                      CORS, rate limiting

  Icons                               Lucide React
  -----------------------------------------------------------------------

## Requirements

Install the following before starting:

-   Node.js 22 LTS or another compatible modern Node.js release.
-   npm (included with Node.js).
-   MySQL 8.0 or newer recommended.
-   Git.
-   A modern browser with JavaScript enabled.

Check your local versions:

``` bash
node --version
npm --version
mysql --version
git --version
```

## Installation

### 1. Clone the repository

``` bash
git clone https://github.com/Zyvelle44/zyvalle-casino.git
cd zyvalle-casino
```

### 2. Install frontend dependencies

``` bash
cd client
npm install
```

Create the local environment file.

**Windows PowerShell:**

``` powershell
Copy-Item .env.example .env
```

**Linux/macOS:**

``` bash
cp .env.example .env
```

Edit `client/.env`:

``` dotenv
VITE_API_URL=http://localhost:4000/api
VITE_GAME_ASSET_BASE_URL=http://localhost:5173
```

Use the asset base URL and directory layout expected by the game assets
you install. Variables prefixed with `VITE_` are exposed to the browser;
**never put passwords, database credentials, or private API secrets in
this file**.

### 3. Install backend dependencies

Open another terminal from the repository root:

``` bash
cd server
npm install
```

Create the backend environment file.

**Windows PowerShell:**

``` powershell
Copy-Item .env.example .env
```

**Linux/macOS:**

``` bash
cp .env.example .env
```

Edit `server/.env`:

``` dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=zyvalle_bet
DATABASE_USER=root
DATABASE_PASSWORD=

SESSION_SECRET=replace-with-a-long-random-secret-at-least-32-characters

ADMIN_NAME=Administrator
ADMIN_EMAIL=admin@zyvalle.local
ADMIN_PASSWORD=ChangeThisToA-Strong-Unique-Password
```

Set a long, random `SESSION_SECRET` and a strong admin password before
running the application. Use the credentials and database account
appropriate for your environment. Do not commit `.env` files.

### 4. Create the database

Make sure MySQL is running, then import the base schema from the
repository root:

``` bash
mysql -u root -p < sql/Zyvalle'sBet.sql
```

Replace `root` with your MySQL username if needed. The schema creates
and selects the `zyvalle_bet` database. Alternatively, open
`server/Zyvalle'sBet.sql` in MySQL Workbench and execute it.

### 5. Create the first administrator

From the `server` directory:

``` bash
npm run seed:admin
```

The command uses `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from
`server/.env`. The password must be at least 12 characters. Keep
administrator credentials private.

### 7. Start the backend

From the `server` directory:

``` bash
npm run dev
```

With the default configuration, the API listens on
`http://localhost:4000`.

For a non-watch process:

``` bash
npm start
```

### 8. Start the frontend

In a separate terminal, from the `client` directory:

``` bash
npm run dev
```

Open the Vite URL shown in the terminal, normally:

-   Frontend: `http://localhost:5173`
-   API: `http://localhost:4000`

Keep both processes running during local development.

### 9. Build the frontend

From the `client` directory:

``` bash
npm run build
```

Vite writes the production build to `client/dist`. The API must be
deployed separately, and the production frontend environment must point
to the correct API and asset URLs.

## Game Assets and Playable Games

Game assets and libraries may be distributed separately from the main
source repository.

-   [Join the Zyvalle Discord](http://discord.gg/VbuWSHfYm) for
    community information about gamepack assets and libraries.
-   Only use assets and libraries that you have the right and permission
    to use.
-   Preserve the directory structure expected by the game loader.
    Renaming folders or changing asset paths can prevent a game from
    loading.
-   Install assets under the directory expected by the current client
    configuration. The default local asset origin is
    `http://localhost:5173`; the actual path depends on the asset
    package and project version.
-   A catalog entry alone does not make a game playable. The required
    asset files, initialization data, and server-side engine/adapter
    must all be present and compatible.

The current source imports server integrations for Gates of Olympus,
Starlight Princess, Starlight Christmas, and Aztec Gems Deluxe. Other
catalog entries should be treated as unavailable until their required
assets and backend support have been installed and tested.

## Configuration Reference

### Backend (`server/.env`)

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `NODE_ENV`                          Runtime environment, normally
                                      `development` locally

  `PORT`                              API listening port

  `CLIENT_ORIGIN`                     Allowed frontend origin for CORS

  `DATABASE_HOST`                     MySQL host

  `DATABASE_PORT`                     MySQL port

  `DATABASE_NAME`                     Database name

  `DATABASE_USER`                     MySQL username

  `DATABASE_PASSWORD`                 MySQL password

  `SESSION_SECRET`                    Secret used by the application
                                      security/session configuration

  `ADMIN_NAME`                        Initial administrator display name

  `ADMIN_EMAIL`                       Initial administrator email

  `ADMIN_PASSWORD`                    Initial administrator password; use
                                      a strong unique value
  -----------------------------------------------------------------------

### Frontend (`client/.env`)

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `VITE_API_URL`                      API base URL used by the frontend

  `VITE_GAME_ASSET_BASE_URL`          Base URL for local game assets
  -----------------------------------------------------------------------

## Troubleshooting

### API cannot connect to MySQL

-   Confirm the MySQL service is running.
-   Verify the host, port, database name, username, and password in
    `server/.env`.
-   Confirm `sql/Zyvalle'sBet.sql` and the required migrations have been
    applied.
-   Check the API terminal for the database error.

### Frontend cannot reach the API

-   Confirm the API is running on the configured port.
-   Verify `VITE_API_URL` in `client/.env`.
-   Verify `CLIENT_ORIGIN` in `server/.env`.
-   Restart Vite after changing a `VITE_` variable.

### A game does not load

-   Confirm the game has the correct asset directory and files.
-   Confirm `VITE_GAME_ASSET_BASE_URL` points to the expected origin.
-   Check browser DevTools → Network and Console for missing files or
    runtime errors.
-   Confirm the server has a compatible adapter and initialization
    configuration for that game.
-   Do not map a game variant to another game's assets unless the
    implementation explicitly supports that variant.

### Admin seeding fails

-   Check `ADMIN_PASSWORD` in `server/.env`.
-   Ensure it is at least 12 characters.
-   Confirm MySQL is available and the base schema has been imported.

## Development Commands

Run commands from the relevant folder.

**Client:**

``` bash
npm run dev
npm run build
npm run preview
```

**Server:**

``` bash
npm run dev
npm start
npm run seed:admin
```

## Security Notes

-   Never commit `.env` files, database passwords, session secrets, or
    production credentials.
-   Change example administrator credentials before exposing the
    application to a network.
-   Use HTTPS and production-grade environment secrets when deploying.
-   Restrict database access to trusted hosts and use a dedicated
    database user with only the required permissions.
-   Review authentication, payment, wallet, and game-round logic before
    using the application with real users or funds.
-   A configured RTP target does not guarantee measured or certified
    RTP. Validate game mathematics and engine behavior independently.
-   Keep third-party assets and libraries compliant with their
    respective licenses and permissions.

## Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Keep changes focused and avoid committing local environment files or
    private assets.
4.  Test client and server changes.
5.  Submit a pull request describing the change, test results, and any
    database migration requirements.

Repository:
[Zyvelle44/zyvalle-casino](https://github.com/Zyvelle44/zyvalle-casino)

## License and Third-Party Assets

Add the project's license information before redistributing this
software. Third-party game assets, artwork, and libraries may have
separate ownership and licensing terms; a repository license does not
automatically grant rights to those materials.

------------------------------------------------------------------------

::: {align="center"}
**Zyvalle Casino** · Built for development and testing.
:::
