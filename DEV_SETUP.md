# Development Environment Setup

To set up a full development environment and run this client against a test server, in addition to this repository, you will also need to fetch the [AT Proto](https://github.com/bluesky-social/atproto) repo.

You will need Docker installed on your machine.

After downloading the AT Proto repository, follow the instructions for setup, but you may find that make nvm-setup fails.

This is because nvm-setup expects nvm to be an installed file, but it's commonly a shell function installed in your shell profile.

To work around, you can simply skip `make nvm-setup` and run the commands manually.

See alternative setup below

```
cd atproto

# make nvm-setup fails due to nvm not found, install manually
nvm install 18
nvm use 18
npm install -g pnpm

# pull dependencies and build all local packages
make deps
make build

# run the tests, using Docker services as needed
# you can skip this step
#make test

# run a local PDS and AppView with fake test accounts and data
# (this requires a global installation of `jq` and `docker`)
make run-dev-env
```

You can then run this client by doing 

```
cd speakeasy

nvm install 20

yarn
yarn web:dev
```

## Using a Test Account in Local Development

In the client you can then login as a test user by setting a custom server of `http://localhost:2583` and login with the following account:

Username: alice.test
Password: hunter2

## Singing up in Local Development

If you want to test the signup flow, you will need to click "Edit" next to "You are creating an account on Bluesky Social" and change the server to `http://localhost:2583`