const Request = require('request');
const api = require('./xo-api-urls');
const Helper = require('../helper/helper');

let requestQueue = [];
let CONFIG;
let helper;
let isAborted;

let totalCount;
let pipelineId;
let currentPipeline;

module.exports = {
  run: (config) => {
    currentPipeline = 0;
    totalCount = 0;
    isAborted = false;
    CONFIG = config;
    helper = new Helper(CONFIG.ws, CONFIG.username, CONFIG.password);

    if (typeof CONFIG.pipelineIds === 'string') {
      CONFIG.pipelineIds = CONFIG.pipelineIds.replace(/ /g, '').split(',');
    }

    if (CONFIG.pipelineIds.length > 1) {
      helper.sendMessage(`Pipelines to grade in queue: ${CONFIG.pipelineIds}`);
    }

    pipelineId = CONFIG.pipelineIds[currentPipeline];
    helper.setStatus('process');
    searchData(pipelineId);
  },
  abort: (ws) => {
    isAborted = true;
    if (!helper) {
      helper = new Helper(ws);
    }

    if (!requestQueue.length) {
      helper.setStatus('pending');
      return helper.sendMessage(`No threads to terminate`);
    }

    helper.sendMessage(`Threads in queue: ${requestQueue.length}\nTrying to abort...`);
    requestQueue.forEach(el => {
      try {
        el.abort();
        helper.sendMessage(`Thread for pipeline ${pipelineId} was terminated`);
        removeQueueElement(el);
        if (!requestQueue.length) {
          helper.sendMessage(`All threads terminated!`);
          helper.setStatus('pending');
        }
      } catch (e) {
        helper.sendMessage(e + '');
      }
    });
  }
};

function removeQueueElement(request) {
  requestQueue.splice(requestQueue.indexOf(request), 1);
}

//-------------------------------------------------------
// seraches candidates to gradin un the pipeline
function searchData(jobId, candidates, page) {
  page = page === undefined ? 1 : page;

  if(page > 1) {
    helper.sendMessage(`Fetching candidates for pipeline ${jobId}`);
  }

  let request = Request.post({
    url: api.search(page, 'RECRUITMENT_ANALYST'),
    headers: helper.getHeaders(true),
    body: JSON.stringify({
      tasks: ['recruitmentAnalystGrades5QTest'],
      jobId: jobId
    })
  }, function (error, response, body) {
    removeQueueElement(request);
    if (error) {
      return helper.sendMessage(error + '');
    }

    if (body.indexOf('HTTP Status 401') > -1) {
      helper.sendMessage(`Wrong credentials, try again`);
      helper.setStatus('pending');
      return;
    }

    try {
      body = JSON.parse(body);
      let numberOfCandidates = body['totalElements'];

      if (numberOfCandidates === 0) {
        return nextRequest();
      }

      if (!body.last) {
        return searchData(jobId, candidates, body.totalElements + 1);
      }

      helper.sendMessage(`On this pipeline we have ${numberOfCandidates} candidates`);
      const newScores = helper.gradeQuestions(body.content, CONFIG.correctScore);
      helper.sendMessage(`Application IDs: ${
        newScores.map((element) => element.id).join(', ')
        }`);
      saveScores(newScores);
    } catch (e) {
      helper.sendMessage(e.toString());
    }
  });
  requestQueue.push(request);
}

//-------------------------------------------------------
// save the new scores, setting them all to 5
function saveScores(newScores) {
  helper.sendMessage(`Evaluation complete`);

  let request = Request.put({
    url: api.saveGradingScores,
    headers: helper.getHeaders(true),
    json: newScores
  }, function (error, response, body) {
    removeQueueElement(request);
    if (error) {
      throw error;
    }
    helper.sendMessage(`Scores saved`);
    submitScores(newScores);
  });
}

//-------------------------------------------------------
// complete grading - same as clicking "Done" in the UI
function submitScores(newScores) {
  let counter = 0;

  for (let i = 0; i < newScores.length; i++) {

    let request = Request.post({
      url: api.grade(newScores[i].id),
      headers: helper.getHeaders(false),
      body: JSON.stringify({
        id: newScores[i].id
      })
    }, (error, response, body) => {
      removeQueueElement(request);

      if ( helper.errorHandler(response.statusCode, newScores[i].id) !== 200 ) {
        helper.sendMessage(body);
        helper.sendMessage(response);
        helper.sendMessage(error);
        return;
      }

      helper.sendMessage(`Candidate with Application ID: ${newScores[i].id} graded`);
      counter++;
      if (newScores.length === counter) {
        helper.sendMessage(`Scores submitted`);
        totalCount = newScores.length;
        nextRequest();
      }
    });
  }
}

function nextRequest() {
  if (isAborted) {
    helper.sendMessage(`Grading was stopped by user.`)
    return;
  }

  helper.sendMessage('Total scores saved: ' + totalCount);
  helper.sendMessage(`Grading finished for pipeline ${pipelineId}`);

  currentPipeline++;
  if (currentPipeline < CONFIG.pipelineIds.length) {
    totalCount = 0;

    pipelineId = CONFIG.pipelineIds[currentPipeline];
    searchData(pipelineId);
  } else {
    helper.sendMessage('SUBMIT COMPLETE!');
    helper.setStatus('pending');
  }

}

