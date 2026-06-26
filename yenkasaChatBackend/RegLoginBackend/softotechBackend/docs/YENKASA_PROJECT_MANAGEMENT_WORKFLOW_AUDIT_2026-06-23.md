# Yenkasa Project Management Platform - Workflow Audit Report

Date: 2026-06-23  
Scope: `softotechBackend/projectManagement` project-management site, API routes, services, models, and public engineering dashboard.  
Constraint followed: audit only; no implementation or redesign changes were made.

## Source Of Truth Workflow

Expected business workflow:

```text
Client Request
-> Project Request
-> Project Approval
-> Requirements
-> Assignment
-> Developer Tasks
-> GitHub Activity
-> Engineering Dashboard
-> Project Completion
```

This audit compares the current implementation against that workflow.

## Screenshot Evidence

- Project request intake: `docs/audit-assets/project-request-intake.png`
- Admin dashboard shell: `docs/audit-assets/admin-dashboard-shell.png`
- Static engineering dashboard: `docs/audit-assets/engineering-dashboard-static.png`

## Executive Summary

The platform has many of the required data areas: project requests, projects, requirements, assignments, tasks, GitHub repository mappings, GitHub activity, and engineering dashboard screens.

The main issue is workflow order and traceability. The intended workflow says requirements should come after project approval and before assignment. The current implementation creates the project first, then tries to generate requirements only if project team assignments already exist. If there are no assignments yet, requirement generation is deferred.

This means the current workflow is closer to:

```text
Client Request
-> Project Request
-> Project Approval
-> Project Created
-> Assignment
-> Generated Requirements
-> Generated Tasks
-> GitHub Sync
-> Partial Engineering Metrics
```

That does not match the intended business workflow.

## 1. Workflow Audit Report

### Module: Project Request

Expected:
Client submits a project request. The request contains requirements such as Login, Registration, Chat, and Video Call.

Actual:
The project request stores structured requirement intake fields:

- `requirements.projectType`
- `requirements.pagesRequired`
- `requirements.featuresRequired`
- `requirements.platformsRequired`
- `requirements.customFeatures`
- `integrations`
- requirement files

Evidence:

- `projectManagement/routes/projectRequest.routes.js`, `buildProjectRequestPayload`, lines around requirement fields.
- `projectManagement/models/projectRequest.model.js`, `requirements` schema.

Gap:
Requirements are stored on the request as intake fields, not as normalized project requirement records at submission time.

Severity: Medium

Recommendation:
Keep request intake fields, but introduce immutable requirement lineage fields when normalized requirements are created:

- `sourceRequestId`
- `sourceFeature`
- `sourceText`
- `sourceFileIds`
- `projectId`
- `requirementId`

### Module: Project Approval

Expected:
Approved request creates a project and carries requirements forward.

Actual:
Approval calls `approveProjectRequest`, which creates a project using summary fields from the request. The project keeps `requestId`, client data, title, description, type, deadline, amount, and status.

The project record does not store a project-level `requirements` array.

After project creation, the service calls `generateRequirementsForProject`. That function refuses to generate requirements if there are no project assignments.

Gap:
Requirements are not carried forward at approval time unless team assignments already exist. This creates a workflow break because assignment becomes a prerequisite for requirements, but the source-of-truth workflow requires requirements before assignment.

Severity: Critical

Recommendation:
On approval, immediately create project requirement records from the request. Do not wait for team assignment. Assignment should attach developers to existing requirements later.

### Module: Requirements

Expected:
The Requirements page displays project requirements derived from the approved project/request.

Actual:
Requirements are stored in the `softotech_requirements` Firestore collection. They can come from two sources:

- manual admin creation through `createRequirement`
- generated templates from `requirementTemplatesFromRequest`

Generated requirements include standard modules such as Database Design Module and Deployment Module, plus mapped modules for selected request features.

Manual requirements default to `sourceType: Manual`.

Gap:
The Requirements page is not guaranteed to display requirements from approval because generation is deferred when assignments are missing. Requirements may be manual, generated, or absent.

Severity: High

Recommendation:
Create a project requirement inheritance mechanism:

1. Read request intake fields.
2. Create normalized project requirements immediately after approval.
3. Store original request text and source feature per requirement.
4. Mark requirements as `Unassigned`, not `Assigned`.

### Module: Assignment

Expected:
Each requirement is assigned to a developer.

Example:

```text
Login Backend -> Elorm Wisdom
Chat UI -> Arhinful Hudson
Video Call Backend -> Elorm Wisdom
```

Actual:
The assignment UI is project-role based. It assigns people into work areas:

- Project Manager
- Frontend Developer
- Backend Engineer
- Mobile Developer
- QA Engineer
- DevOps Engineer

The backend then maps requirements to these role assignments using requirement category and assigned role.

Gap:
Assignment is not primarily requirement-based. A developer is assigned to a project role, then the system infers requirement ownership from role/category.

Severity: High

Recommendation:
Add a requirement assignment module:

- Select project.
- Select requirement.
- Assign developer.
- Store `requirementId`, `projectId`, `developerId`, `role`, `assignedBy`, `assignedAt`.
- Preserve project-role assignment only as a bulk helper.

### Module: Task Generation

Expected:
Assignment creates developer tasks linked to requirements.

Actual:
Tasks are generated from requirements and project assignments. They are written to `softotech_tasks` and also embedded in requirement records.

Task generation happens in `generatedTasksForRequirement` and `writeTasksForRequirement`.

Gap:
Tasks exist but are not a first-class workflow module in the admin UI. There is no standalone Tasks admin API/page for CRUD, status updates, review, or completion.

Severity: High

Recommendation:
Create a first-class Task module:

- task list by project, requirement, developer, status
- task status transitions
- task comments
- task completion evidence
- task link back to assignment and requirement

### Module: GitHub Integration

Expected:
Project maps to repository, branch, commits, PRs, and developer activity.

Actual:
The implementation includes:

- GitHub OAuth connection
- repository list
- branch list
- folder list
- project repository mapping
- repository sync
- commits
- pull requests
- contributors
- workflow runs/builds
- contributor-to-team mapping

The sync stores activity in `softotech_github_activity`.

Gap:
The current sync does not populate tests or code quality. Those arrays are explicitly empty in synced activity. Contributor mapping depends on matching username/email/name to team profiles, but team profile GitHub usernames are not enforced.

Severity: Medium

Recommendation:
Add required GitHub identity fields to team members and ingest:

- CI build status
- test results
- code quality reports
- PR review state
- branch protection status
- commit-to-task or PR-to-task links

### Module: Engineering Dashboard

Expected:
Dashboard metrics should originate from:

```text
Requirements -> Assignments -> Tasks -> GitHub Activity
```

Actual:
The in-admin engineering calculation derives:

- active developers from assignments, or falls back to all active team members
- project progress from stored project progress
- code quality from `githubActivity.codeQuality`, which is usually empty
- open bugs by text matching requirement fields for `bug`, `defect`, or `issue`
- commits/PRs from GitHub activity
- failed builds from workflow run conclusions

Gap:
Metrics are only partially workflow-derived. Project progress is manual or milestone-derived. Bug count is a text heuristic. Code quality is normally zero. Tasks are not used in admin engineering metrics.

Severity: High

Recommendation:
Compute dashboard metrics from:

- requirement status
- task status
- assignment load
- GitHub commits/PRs
- test reports
- quality reports
- bug records

### Module: Team Performance

Expected:
Developer performance should calculate from assigned requirements, tasks, commits, tests, code quality, and bug resolution.

Actual:
The static public engineering dashboard contains hard-coded developer names and scores such as Elorm Wisdom, Hudson, Prince, and Joana. It has no API data binding.

The developer API returns assigned projects, requirements, tasks, completed task count, and completion percentage. It does not compute a full engineering score using tests, code quality, bugs, and commits.

Gap:
Team performance is mostly placeholder in the public dashboard and incomplete in the API.

Severity: Critical

Recommendation:
Replace static team performance with API-backed calculations:

```text
score = task_completion * 40%
      + test_success * 20%
      + code_quality * 15%
      + build_success * 10%
      + bug_resolution * 10%
      + github_activity * 5%
```

### Module: Project Completion

Expected:
Project completion should come after requirements, assignments, tasks, GitHub activity, testing, and deployment are complete.

Actual:
Project status/progress can be manually updated. Milestones can also update project progress. There is no enforced completion gate that checks all requirements/tasks/GitHub/test/deployment state.

Gap:
Project completion can be set without complete workflow evidence.

Severity: High

Recommendation:
Add completion gates:

- all required requirements completed
- all required tasks completed
- QA/test status passed
- deployment milestone complete
- GitHub repository synced
- no critical open bugs
- client acceptance recorded

## 2. Architecture Audit Report

### Data Collections Observed

The portal service uses Firestore collections for:

- project requests
- clients
- leads
- quotations
- invoices
- projects
- requirements
- messages
- documents
- proposals
- payments
- audit logs
- team assignments
- tasks
- GitHub connections
- project repositories
- GitHub activity

### Current Architecture Strengths

- Request intake is rich and structured.
- Project approval exists.
- Requirements collection exists.
- Project team assignment exists.
- Task generation exists.
- GitHub OAuth and repository sync exist.
- Audit logs exist.
- Client and admin dashboards exist.

### Current Architecture Weaknesses

- Project approval does not persist normalized requirements unless assignments exist.
- Project records do not carry a requirement snapshot.
- Assignment is project-role based before it is requirement-based.
- Tasks are not first-class in admin workflow.
- Engineering metrics are calculated in frontend JavaScript from mixed dashboard data.
- Static engineering dashboard is not connected to backend data.
- Tests and code quality have no real ingestion pipeline.
- Bug analytics are inferred rather than modeled.

### Target Architecture

Recommended entity flow:

```text
ProjectRequest
  -> Project
  -> ProjectRequirement
  -> RequirementAssignment
  -> DeveloperTask
  -> GitHubRepositoryMapping
  -> GitHubActivity
  -> EngineeringMetricSnapshot
  -> ProjectCompletionReview
```

Required key relationships:

- `Project.requestId`
- `ProjectRequirement.projectId`
- `ProjectRequirement.sourceRequestId`
- `RequirementAssignment.requirementId`
- `RequirementAssignment.developerId`
- `DeveloperTask.requirementId`
- `DeveloperTask.assignmentId`
- `GitHubActivity.projectId`
- `GitHubActivity.repositoryMappingId`
- `EngineeringMetricSnapshot.projectId`
- `ProjectCompletionReview.projectId`

## 3. UI Audit Report

### Project Request Page

Screenshot: `docs/audit-assets/project-request-intake.png`

Findings:

- The route displays a professional intake page.
- The form is gated behind client login.
- The first viewport shows “Client login required”, so unauthenticated audit screenshots do not show all requirement fields.
- Intake captures requirements in later sections after login.

Gaps:

- The UI does not show how request requirements will become project requirements.
- It does not explain that normalized requirements are generated after assignment in the current implementation.

Severity: Medium

Recommendation:
After login, show a review step that summarizes requested features as future requirements.

### Admin Portal

Screenshot: `docs/audit-assets/admin-dashboard-shell.png`

Findings:

- The admin sidebar includes many modules.
- Workflow pages are present: Project Requests, Projects, Assignment, Requirements, GitHub Activity.
- Engineering pages are present: Team Performance, Code Quality, Test Results, Bug Analytics.

Gaps:

- No first-class Tasks page exists.
- Team Performance links to `/admin/engineering`, which redirects to the static `/engineering-dashboard`.
- Code Quality, Test Results, and Bug Analytics reuse the same in-admin engineering renderer rather than distinct data-backed modules.
- Navigation order does not fully match the business workflow.

Severity: High

Recommendation:
Reorder and consolidate navigation:

```text
Requests
Approvals
Projects
Requirements
Assignments
Tasks
GitHub
Engineering
Completion
```

### Requirements Page

Findings:

- The page is dense and closer to an operational table.
- It has filters, project header, status, priority, assignee, due date, progress, detail panel, attachments, comments, and change requests.

Gaps:

- It mixes generated and manual requirements.
- It does not clearly show source request lineage.
- It can be empty if assignment was not done yet.

Severity: High

Recommendation:
Add visible columns:

- Source Request
- Source Feature
- Assignment
- Task Count
- Completion Evidence

### Assignment Page

Findings:

- The UI explicitly says: “Assign the right team to the selected project before requirements are generated.”
- It assigns by project work area.

Gap:
This UI confirms the workflow mismatch: assignment comes before generated requirements.

Severity: High

Recommendation:
Change to:

```text
Select Project
-> View Requirements
-> Assign Developer Per Requirement
-> Generate Tasks
```

### GitHub Activity Page

Findings:

- The UI supports project selection, GitHub connection, repository, branch, folder, mapping, sync, commits, PRs, contributors, and diagnostics.

Gaps:

- It depends on manual sync.
- Test and code quality records are not populated.
- Developer mapping can produce unmapped contributors.

Severity: Medium

Recommendation:
Show unmapped contributors as action items and require GitHub usernames for developer profiles.

### Engineering Dashboard

Screenshot: `docs/audit-assets/engineering-dashboard-static.png`

Findings:

- The public `/engineering-dashboard` page is static.
- It displays hard-coded team performance values.
- It includes hard-coded task examples such as “Login Backend”.
- It states some sections are ready for future data binding.

Gaps:

- This page does not use the live engineering dashboard API.
- It presents placeholder metrics as if they are dashboard content.

Severity: Critical

Recommendation:
Either remove the static page or bind it to `/api/project-portal/engineering/dashboard`.

## 4. Gap Analysis

### Critical Gaps

1. Requirements are not guaranteed to be created at project approval.
2. Assignment currently precedes generated requirements.
3. Team performance dashboard is static/hard-coded.
4. Tasks are not first-class despite being part of the source workflow.

### High Gaps

1. Engineering metrics do not fully derive from requirements, assignments, tasks, and GitHub.
2. Project completion is manual rather than workflow-gated.
3. Requirement traceability from request to project is partial.
4. Code Quality, Test Results, and Bug Analytics pages are not fully independent data-backed modules.

### Medium Gaps

1. GitHub contributor mapping is best-effort.
2. Tests and code quality are not synced.
3. UI navigation is broad and redundant.
4. Request intake does not visually preview normalized requirements before approval.

## 5. Prioritized Remediation Plan

### Priority 1: Critical Workflow Issues

1. Create normalized project requirements immediately when a project request is approved.
2. Remove assignment as a prerequisite for requirement generation.
3. Add first-class task management.
4. Replace static engineering/team performance data with live backend data.

### Priority 2: Data Relationship Issues

1. Add explicit lineage fields to requirements:
   - `sourceRequestId`
   - `sourceFeature`
   - `sourceText`
   - `sourceFileIds`
2. Add `RequirementAssignment` records.
3. Link every task to:
   - project
   - requirement
   - assignment
   - developer
4. Add project completion review records.

### Priority 3: GitHub Integration Issues

1. Require GitHub username on developer profiles.
2. Add unmapped contributor workflow.
3. Ingest CI/test results.
4. Ingest code quality reports.
5. Link PRs/commits to tasks or requirements where possible.

### Priority 4: UI Improvements

1. Reorder admin navigation according to the source workflow.
2. Add Tasks page.
3. Merge duplicate assignment/team assignment concepts.
4. Remove or bind placeholder engineering dashboard content.
5. Add source lineage columns to Requirements.
6. Add completion readiness page.

## Final Determination

The implementation does not yet fully match the intended Yenkasa Project Management workflow.

The platform has many underlying pieces, but the core workflow has an important inversion:

```text
Current: Approval -> Project -> Assignment -> Requirements
Expected: Approval -> Project -> Requirements -> Assignment
```

Until this is corrected, downstream modules such as tasks, engineering dashboard, team performance, and project completion will remain partially disconnected from the business process.

