# Issue Types (Advanced GraphQL)

Issue types (Bug, Feature, Task, Epic, etc.) are defined at the **organization** level and inherited by repositories. They categorize issues beyond labels.

For basic usage in this skill, prefer `gh api` with the REST issue `type` parameter when issue types are enabled for the owner. This reference covers advanced GraphQL operations for discovery, updates, and fallbacks when REST is not enough.

## GraphQL Feature Header

All GraphQL issue type operations require the `GraphQL-Features: issue_types` HTTP header.

## List types (org or repo level)

```graphql
# Header: GraphQL-Features: issue_types
{
  organization(login: "OWNER") {
    issueTypes(first: 20) {
      nodes { id name color description isEnabled }
    }
  }
}
```

Types can also be listed per-repo via `repository.issueTypes` or looked up by name via `repository.issueType(name: "Bug")`.

## Read an issue's type

```graphql
# Header: GraphQL-Features: issue_types
{
  repository(owner: "OWNER", name: "REPO") {
    issue(number: 123) {
      issueType { id name color }
    }
  }
}
```

## Set type on an existing issue

```graphql
# Header: GraphQL-Features: issue_types
mutation {
  updateIssueIssueType(input: {
    issueId: "ISSUE_NODE_ID"
    issueTypeId: "IT_xxx"
  }) {
    issue { id issueType { name } }
  }
}
```

## Create issue with type

```graphql
# Header: GraphQL-Features: issue_types
mutation {
  createIssue(input: {
    repositoryId: "REPO_NODE_ID"
    title: "Fix login bug"
    issueTypeId: "IT_xxx"
  }) {
    issue { id number issueType { name } }
  }
}
```

To clear the type, set `issueTypeId` to `null`.

## Available colors

`GRAY`, `BLUE`, `GREEN`, `YELLOW`, `ORANGE`, `RED`, `PINK`, `PURPLE`
