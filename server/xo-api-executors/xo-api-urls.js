const BASE_URL = 'https://api-qa.crossover.com/api/';
const API = {
  getApplication: (appId) => `${BASE_URL}hire/applications/${appId}?avatarType=ACCOUNT_MANAGER`,
  search: (pageSize, avatarType) => `${BASE_URL}hire/applications/search?avatarType=${avatarType}&pageSize=${pageSize}&page=0`,
  saveGradingScores: `${BASE_URL}hire/applications/scores/written-evaluations`,
  grade: (id) => `${BASE_URL}hire/applications/${id}/recruitment-analysts/actions?action=grade5qTest`,
  endorse: (id) => `${BASE_URL}hire/applications/${id}/recruitment-analysts/actions?action=endorseApplication&accepted=true`,
  preHireFormCall: (id) => `${BASE_URL}hire/applications/${id}/tests/talent-advocate`,
  accept: (id) => `${BASE_URL}hire/applications/${id}/tests/talent-advocate?accept=true`,
  reject: (id) => `${BASE_URL}hire/applications/${id}?type=REJECT`,
  jobDetails: (jobId) => `${BASE_URL}hire/jobs/${jobId}`,
  searchResume: (jobId, pageSize, avatarType) => `${BASE_URL}v2/hire/applications/search?avatarType=${avatarType}&jobId=${jobId}&orderBy=score&page=0&pageSize=${pageSize}&sortDir=ASC`,
  saveResumeScores: `${BASE_URL}hire/applications/scores/resume-rubrics`
};

API.payloads = {
  preHireFormCall: (englishScore) => ({
    answers: [
      {
        'question': {
          'id': 1,
          'sequence': 1,
          'question': 'I\'m looking at your resume, can you tell me in 5 minutes which are the most important aspects of your resume that the hiring manager should know about?',
          'type': 'TEXT',
          'mandatory': true,
          'selectValues': []
        },
        'answer': '@'
      },
      {
        'question': {
          'id': 2,
          'sequence': 2,
          'question': 'Considering that this is a full-time job, will you be able to commit to a 40-hour workweek?',
          'type': 'TEXT',
          'mandatory': true,
          'selectValues': []
        },
        'answer': '@'
      },
      {
        'question': {
          'id': 3,
          'sequence': 3,
          'question': 'How soon will you be able to start after being offered a project? Provide days/weeks/months of notice period, if any',
          'type': 'TEXT',
          'mandatory': true,
          'selectValues': []
        },
        'answer': '@'
      },
      {
        'question': {
          'id': 4,
          'sequence': 4,
          'question': 'Do you agree with the hourly rate?',
          'type': 'TEXT',
          'mandatory': true,
          'selectValues': []
        },
        'answer': '@'
      },
      {
        'question': {
          'id': 5,
          'sequence': 5,
          'question': 'Do you agree with the usage of the time tracker that will take pictures of you and your screen?',
          'type': 'TEXT',
          'mandatory': true,
          'selectValues': []
        },
        'answer': '@'
      },
      {
        'question': {
          'id': 6,
          'sequence': 6,
          'question': 'Candidate\'s conversational English',
          'type': 'SELECT_LIST',
          'mandatory': true,
          'selectValues': [
            {
              'sequence': 1,
              'value': 5,
              'display': '5 - Can understand 100% of the message, fluent / natural / native'
            },
            {
              'sequence': 2,
              'value': 4,
              'display': '4 - Can understand 100% of the message, conversational, minor accent or pronunciation issues'
            },
            {
              'sequence': 3,
              'value': 3,
              'display': '3 - Can understand 100% of the message, but either speaks slow or with a thick accent'
            },
            {
              'sequence': 4,
              'value': 2,
              'display': '2 - Can understand 70% of the message, but have to try hard to focus'
            },
            {
              'sequence': 5,
              'value': 1,
              'display': '1 - Can understand 50% of the message'
            },
            {
              'sequence': 6,
              'value': 0,
              'display': '0 - Can understand 0% of the message'
            }
          ]
        },
        'answer': englishScore
      },
      {
        'question': {
          'id': 13,
          'sequence': 13,
          'question': 'Candidate\'s profile in Crossover complete? If \'No\', the profile should not be approved into the marketplace',
          'type': 'SELECT_LIST',
          'mandatory': true,
          'selectValues': [
            {
              'sequence': 1,
              'value': 1,
              'display': 'Yes'
            },
            {
              'sequence': 2,
              'value': 0,
              'display': 'No'
            }
          ]
        },
        'answer': '1'
      },
      {
        'question': {
          'id': 14,
          'sequence': 14,
          'question': 'Recruiter\'s comments',
          'type': 'TEXT',
          'mandatory': false,
          'selectValues': []
        },
        'answer': '@'
      }
    ],
    id: 0
  }),
  accept:(appId) => ({
    accept: true,
    id: appId
  }),
  searchResume: (jobId) => ({
    jobId: jobId,
    searchWord: '',
    showDisabled: true
  })
};

module.exports = API;
