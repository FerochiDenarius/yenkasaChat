const assert = require('node:assert/strict');
const test = require('node:test');

const portal = require('../services/softOTechPortal.service');

const { approvalRequirementTemplatesFromRequest } = portal._internals;

function requestWith(featuresRequired) {
  return {
    requestId: 'REQ-1',
    contact: {
      fullName: 'Client Name',
      email: 'client@example.com',
    },
    requirements: {
      featuresRequired,
      pagesRequired: [],
      platformsRequired: [],
      customFeatures: '',
    },
  };
}

const project = {
  projectId: 'YSP-2026-0001',
  requestId: 'REQ-1',
  clientEmail: 'client@example.com',
  clientName: 'Client Name',
};

test('approval creates one unassigned requirement per requested Login and Registration feature', () => {
  const requirements = approvalRequirementTemplatesFromRequest(requestWith(['Login', 'Registration']), project);

  assert.equal(requirements.length, 2);
  assert.deepEqual(requirements.map((item) => item.requirementName), ['Login', 'Registration']);
  requirements.forEach((item) => {
    assert.equal(item.requestId, 'REQ-1');
    assert.equal(item.projectId, 'YSP-2026-0001');
    assert.equal(item.status, 'Unassigned');
    assert.equal(item.progress, 0);
    assert.equal(item.assignedDeveloper, null);
    assert.equal(item.createdFromApproval, true);
  });
});

test('approval creates one unassigned requirement per requested Chat and Video Call feature', () => {
  const requirements = approvalRequirementTemplatesFromRequest(requestWith(['Chat', 'Video Call']), project);

  assert.equal(requirements.length, 2);
  assert.deepEqual(requirements.map((item) => item.sourceFeature), ['Chat', 'Video Call']);
  assert.deepEqual(requirements.map((item) => item.sourceType), ['featuresRequired', 'featuresRequired']);
});

test('approval requirement conversion does not require assignments', () => {
  const requirements = approvalRequirementTemplatesFromRequest(requestWith(['Login']), {
    ...project,
    assignedDeveloperIds: [],
    assignedDevelopers: [],
  });

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].assignedDeveloper, null);
  assert.deepEqual(requirements[0].assignedTeamMembers, []);
  assert.deepEqual(requirements[0].tasks, []);
});
