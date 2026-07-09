Typescript 7.0 has been released. Read the release note and docs https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ .

After reading, update the current repository to take full advantage of the new tsc version.
This includes migrating to the new version, updating tsconfig files,
but also checking the types used within the code to see whether they can be upgraded to be more readable/ performant/ correct.

While performing the migration, describe the updates you perform into a Markdown file in the root of this repo called `changes.md` and track it in git.
When you are done, commit your changes, enuring test coverage is still 100% and linter passes etc.
