class Helper {
  constructor(ws, username, password) {
    this.ws = ws;
    this.username = username;
    this.password = password;
  }

  setStatus(status) {
    this.ws.jsend('status', status);
  }

  sendMessage(message) {
    this.ws.jsend('message', { data: message });
  }

  getHeaders(isJson) {
    let type = isJson ? 'application/json;charset=UTF-8' : 'text/plain;charset=UTF-8';
    return {
      'Content-type': type,
      'Authorization': 'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64'),
    };
  }

  appIdsToArray(str) {
    let withScores = str.indexOf('-') > -1;
    let result = str.replace(/ /g, '')
                    .replace(/,/g, '\n')
                    .split('\n')
                    .filter(item => !!item);

    if (withScores) {
      result = result.map( item => ({
        id: item.replace(/-.*$/, ''),
        score: item.replace(/^.*-/, '')
      }));
    }

    return result;
  }

  gradeQuestions(data, correctScore) {
    return data.map(element => ({
      id: element.id,
      testsEvaluations: element.testsEvaluations.filter(test => test.type === 'FIVEQ_ANSWER')
        .map(fiveq => ({
          answers: fiveq.answers.map(answer => {
            answer.score = correctScore;
            return answer;
          }),
          id: fiveq.id,
          type: fiveq.type
        }))
    }));
  }

  isCandidateScored(application, testDetails) {
    const evaluations = application.testsEvaluations
      .find((evaluations) => evaluations.type === 'RESUME_RUBRIC_EVALUATION');
    const testId = testDetails.resumeRubrics[0].resumeRubric.id;
    let resumeRubric;

    if(evaluations) {
      resumeRubric = evaluations.resumeRubricScores.find((rubric) => rubric.resumeRubric.id === testId);
    }

    if(resumeRubric && resumeRubric.score) {
      const score = parseInt(resumeRubric.score, 10);
      return !isNaN(score) && score > 0;
    }

    return false;
  }

  scoreResumes(application, testDetails, score) {
    return {
      id: application.id,
      testsEvaluations: [
        {
          type: 'RESUME_RUBRIC_EVALUATION',
          resumeRubricScores: testDetails.resumeRubrics.map((rubric) => ({
              resumeRubric: rubric.resumeRubric,
              score: score === 'null' ? '' : score
            }))
        }
      ]
    };
  }

  errorHandler(statusCode, appId) {
    switch(statusCode) {
      case 404:
        this.sendMessage(`Candidate with Application ID ${appId} does not exists`);
        break;
      case 500:
        this.sendMessage(`Server error`);
        this.setStatus('pending');
        break;
      case 401:
        this.sendMessage(`Wrong credentials, try again`);
        this.setStatus('pending');
        break;
      case 403:
        this.sendMessage(`You have no access to Recruiter part`);
        this.setStatus('pending');
        break;
    }
    return statusCode;
  }
  // status || task
  // accountManagerEndorsesApplication - process
  // ACCEPTED - stop - `Already on marketplace`
  // REJECTED - stop - 'Was already Rejected'
  // IN_PROGRESS - stop 'Didn't finished with tests'
  // CANCELLED - stop
  // candidateProvidesContactInformation1 || candidateVerifiesEmailAddress
  // techTrialUpdatesStatus1
  candidateStatusHandler(status, id) {
    switch(status) {
      case 'ACCEPTED':
        this.sendMessage(`Candidate with Application ID ${id} already on marketplace`);
        break;
      case 'REJECTED':
      case 'CANCELLED':
        this.sendMessage(`Candidate with Application ID ${id} was already rejected`);
        break;
      case 'IN_PROGRESS':
        this.sendMessage(`Candidate with Application ID ${id} didn't finished with tests`);
        break;
    }
  }

}

module.exports = Helper;
