If you've got a fresh laptop and need to install all the things, here are the steps from top to bottom
to get a working local development environment on a Mac laptop

### 1. Install the supporting apps
You'll need to open up terminal (command + space terminal)

**Docker**

Download docker from
https://docs.docker.com/desktop/setup/install/mac-install/

**Brew**

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

👉 **Note:** Be sure to follow the **Next Steps** that are shown in the terminal at the end of the install

**Github Client**

```
brew install gh
```

### 2. Install node, nvm and package managers

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

# Reload your shell
source ~/.zshrc

# Confirm it works
nvm --version

# Install the versions of node we need
nvm install 18
nvm install 20
nvm install 22.14

# Install the package managers used
nvm use 18
npm install -g pnpm

nvm use 20
npm install -g yarn

nvm use 22
npm install -g pnpm
```

### 3. Download all the Speakeasy & Bluesky repositories

You'll need 3 repositories from Github

* Speakeasy client (this repo)
* Speakeasy services (so it can create and fetch private posts)
* AT Protocol services (to run all the bluesky things)


```bash
# Make somewhere to install all the things
cd ~
mkdir src
cd src

# Login to github
gh auth login

gh repo clone speakeasy-social/speakeasy
gh repo clone speakeasy-social/services
gh repo clone bluesky-social/atproto
```

### 4. Install & Build everything

You can do this in 3 separate terminal tabs at the same time

**Tab 1 - AT Protocol (Bluesky)**

```bash
cd ~/src/atproto
nvm use 18
make deps
make build
```

**Tab 2 - Speakeasy Services**

```bash
cd ~/src/services
nvm use 22
pnpm install
pnpm build
docker compose up -d
pnpm dev:setup
```

**Tab 3 - Speakeasy Web App**

```bash
cd ~/src/speakeasy
nvm use 20
yarn
```

### Running it All

Now it's all installed, you can run a full mock environment of Speakeasy

Again, open 3 tabs to run each piece at the same time

(👉 If you've rebooted your laptop since running the setup, you might need to launch docker)


**Tab 1 - AT Protocol (Bluesky)**

```bash
cd ~/src/atproto
nvm use 18
make run-dev-env
```

**Tab 2 - Speakeasy Services**

```
cd ~/src/services
# Start postgres
docker compose up -d
pnpm run dev
```


**Tab 3 - Speakeasy Web (this should cause a browser to open)**

```bash
cd ~/src/speakeasy
yarn web:dev
```

In the browser, when you login, there's an option to choose your server Click that and enter
http://localhost:2583
Then you can login as any of the following usernames

* `alice.test`
* `bob.test`
* `carla.test`

All of them have password: `hunter2`
