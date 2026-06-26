# Phase 1 Requirements Workflow Implementation

Date: 2026-06-23

Reference: `docs/YENKASA_PROJECT_MANAGEMENT_WORKFLOW_AUDIT_2026-06-23.md`

## Expected Workflow

```text
Client Request
-> Project Request
-> Project Approval
-> Requirements
-> Assignment
-> Developer Tasks
```

## Old Workflow

```text
Project Request
-> Approve Project
-> Project Created
-> Assignment Required
-> Requirements Generated
-> Tasks Generated
```

The old approval path called `generateRequirementsForProject`, but that function returned no requirements when the project had no team assignments. Requirement creation was therefore blocked by assignment.

## New Workflow

```text
Project Request
-> Approve Project
-> Project Created
-> Requirements Created From Request Intake
-> Assignment Can Happen Later
```

Architecture:

```text
ProjectRequest
  requirements.featuresRequired[]
  requirements.pagesRequired[]
  requirements.platformsRequired[]
  requirements.customFeatures
        |
        v
approveProjectRequest()
        |
        v
generateRequirementsForProject()
        |
        v
softotech_requirements
  requestId
  projectId
  sourceFeature
  sourceType
  createdFromApproval
  createdAt
  status = Unassigned
  progress = 0
  assignedDeveloper = null
```

## Files Changed

- `projectManagement/services/softOTechPortal.service.js`
  - Added approval-time requirement extraction from `featuresRequired`, `pagesRequired`, `platformsRequired`, and `customFeatures`.
  - Removed the team-assignment prerequisite from requirement generation.
  - Added lineage fields to created requirement records.
  - Added `Unassigned` as a valid requirement status.
  - Added migration support for approved projects missing requirements.
- `projectManagement/scripts/migrateApprovalRequirements.js`
  - CLI migration wrapper.
  - Supports `--dry-run` and `--limit=<number>`.
- `projectManagement/tests/approvalRequirements.test.js`
  - Automated scenarios for approval requirement conversion.

## Requirement Defaults

New approval-created requirements are stored with:

- `status: "Unassigned"`
- `progress: 0`
- `assignedDeveloper: null`
- `assignedUserId: null`
- `assignedTeamMembers: []`
- `tasks: []`

No developer, project manager, or assignment is required for creation.

## Migration Script

Dry run:

```bash
node projectManagement/scripts/migrateApprovalRequirements.js --dry-run
```

Apply:

```bash
node projectManagement/scripts/migrateApprovalRequirements.js
```

The migration scans projects with `requestId`, skips projects that already have requirements, reads the original request, creates missing approval-derived requirements, and writes audit entries:

- `approved_project_requirements_migrated`
- `approved_project_requirements_migration_completed`

## Production Migration Results

Initial production dry run against project `project-10405180-0afd-4ecc-9f8`, Firestore database `yenkasa-project-mgmt`:

```text
scanned: 4
eligible projects: 1
project migrated: YSP-2026-0004
source request: YST-2026-0001
requirements to create: 37
```

Applied production migration:

```text
scanned: 4
migrated: 1
createdRequirements: 37
skippedExistingRequirements: 1
skippedMissingRequest: 2
```

Post-migration verification:

```text
YSP-2026-0004 requirements: 37
sample status: Unassigned
sample progress: 0
sample assignedDeveloper: null
sample createdFromApproval: true
follow-up dry run eligible projects: 0
```

Audit relay note: Firestore audit entries were written, but the existing AI event relay emitted 401 and unsupported-event warnings for migration audit event publishing. This did not block Firestore requirement creation.

## Test Results

Command:

```bash
node --test projectManagement/tests/approvalRequirements.test.js
```

Result:

```text
3 tests passed
0 tests failed
```

Additional checks:

```text
node --check projectManagement/services/softOTechPortal.service.js
node --check projectManagement/scripts/migrateApprovalRequirements.js
```

Both syntax checks passed.

## Automated Test Scenarios

Scenario 1:

```text
Request: Login, Registration
Approve
Expected: 2 requirements created
Result: Passed
```

Scenario 2:

```text
Request: Chat, Video Call
Approve
Expected: 2 requirements created
Result: Passed
```

Scenario 3:

```text
No assignments exist
Approve
Expected: Requirements still created
Result: Passed
```

## Outstanding Issues

- The Requirements page was not redesigned in this phase.
- Assignment remains project-role based. Requirement-level assignment is intentionally deferred to a later phase.
- The production migration completed for the one eligible project. Two production projects still do not have source `requestId` values, so they were skipped by design.
