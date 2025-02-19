# Speakeasy

Speakeasy is a co-operatively owned social media platform with a mission to help people be the best version of themselves, so we can get to work contributing to the best version of society.

Everything we need for a kind and loving society is controlled by billionaires who ruin the systems that underpin our lives for their own profit and power.

These systems can and should be run by us, for us. The algorithm could be designed to inform and inspire. Instead of artificially generated influencers selling things we don’t need, we could have a system that helps us genuinely connect and achieve our goals, whatever they may be.

We are done waiting for governments to fix things. We know that governments will never regulate away the profit incentives of billionaire owners to hijack more and more of our attention for advertising profits.

We need to start building alternative infrastructure that serves humanity outside the destructive forces that seek return on investment. Everything from our education, to our supermarkets, to our information systems is too important to be owned and shaped by rich people looking for their next big payday.

We’re starting with social media, because it’s now the core of our information infrastructure and shapes how we perceive the world.

- **Get the app [spkeasy.social](https://spkeasy.social)**

# What could social media do if it served us?

* [Promote a positive body image for teenage girls](https://www.wsj.com/articles/facebook-knows-instagram-is-toxic-for-teen-girls-company-documents-show-11631620739)
* [Connect communities and reduce division](https://www.nytimes.com/2018/11/06/technology/myanmar-facebook.html)
* [Help voters to be informed](https://www.bbc.com/news/technology-51034641)
* [Promote kind and calm online engagement](https://www.washingtonpost.com/technology/2021/10/26/facebook-angry-emoji-algorithm/)
* [Help us find love and support when we need it most](https://www.forbes.com/sites/alicegwalton/2015/04/08/new-study-links-facebook-to-depression-but-now-we-actually-understand-why/)

We know now that billionaire owned social media hasn't just failed to do this, they are making these problems worse. All of these failures were choices, and we can make better choices if we control the algorithm.

# Get Involved

Join us in building a new kind of social media platform that serves humanity.

Speakeasy is an open source, proof of concept client for Bluesky's open source AT protocol. With support we can expand into running our own servers and feeds that truly serve the community.

## What can you do?

* Use the app
* Help us build the app and the infrastructure
* Help us raise funds
* Help us find more people who can do any of these things

## Quick Start

You'll need nvm installed to run the app.

```
nvm install 20

yarn
yarn web:dev
```

## BlueskyDevelopment Resources

This is a [React Native](https://reactnative.dev/) application, written in the TypeScript programming language. It builds on the `atproto` TypeScript packages (like [`@atproto/api`](https://www.npmjs.com/package/@atproto/api)), code for which is also open source, but in [a different git repository](https://github.com/bluesky-social/atproto).

There is a small amount of Go language source code (in `./bskyweb/`), for a web service that returns the React Native Web application.

The [Build Instructions](./docs/build.md) are a good place to get started with the app itself.

The Authenticated Transfer Protocol ("AT Protocol" or "atproto") is a decentralized social media protocol. You don't *need* to understand AT Protocol to work with this application, but it can help. Learn more at:

- [Overview and Guides](https://atproto.com/guides/overview)
- [Github Discussions](https://github.com/bluesky-social/atproto/discussions) 👈 Great place to ask questions
- [Protocol Specifications](https://atproto.com/specs/atp)
- [Blogpost on self-authenticating data structures](https://bsky.social/about/blog/3-6-2022-a-self-authenticating-social-protocol)

The Bluesky Social application encompasses a set of schemas and APIs built in the overall AT Protocol framework. The namespace for these "Lexicons" is `app.bsky.*`.

## Contributions

> While we do accept contributions, we prioritize high quality issues and pull requests. Adhering to the below guidelines will ensure a more timely review.

**Rules:**

- We may not respond to your issue or PR.
- We may close an issue or PR without much feedback.
- We may lock discussions or contributions if our attention is getting DDOSed.
- We're not going to provide support for build issues.

**Guidelines:**

- Check for existing issues before filing a new one please.
- Open an issue and give some time for discussion before submitting a PR.
- Stay away from PRs like...
  - Changing "Post" to "Skeet."
  - Refactoring the codebase, e.g., to replace MobX with Redux or something.
  - Adding entirely new features without prior discussion. 

Remember, we serve a wide community of users. Our day-to-day involves us constantly asking "which top priority is our top priority." If you submit well-written PRs that solve problems concisely, that's an awesome contribution. Otherwise, as much as we'd love to accept your ideas and contributions, we really don't have the bandwidth. That's what forking is for!

## Forking guidelines

You have our blessing 🪄✨ to fork this application! However, it's very important to be clear to users when you're giving them a fork.

Please be sure to:

- Change all branding in the repository and UI to clearly differentiate from Bluesky.
- Change any support links (feedback, email, terms of service, etc) to your own systems.
- Replace any analytics or error-collection systems with your own so we don't get super confused.

## Security disclosures

If you discover any security issues, please send an email to security@bsky.app. The email is automatically CCed to the entire team and we'll respond promptly.

## Are you a developer interested in building on atproto?

Bluesky is an open social network built on the AT Protocol, a flexible technology that will never lock developers out of the ecosystems that they help build. With atproto, third-party integration can be as seamless as first-party through custom feeds, federated services, clients, and more.

## License (MIT)

See [./LICENSE](./LICENSE) for the full license.

## P.S.

We ❤️ you and all of the ways you support us. Thank you for making Bluesky a great place!
