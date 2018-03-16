'use strict';

const Request = require('request');
const api = require('./xo-api-urls');
const Helper = require('../helper/helper');

const DEFAULT_ENGLISH_SCORE = 0;

let requestQueue = [];
let headers;
let CONFIG;
let helper;
let isAborted;

module.exports = {
  run: function (config) {
    isAborted = false;
    CONFIG = config;
    helper = new Helper(CONFIG.ws, CONFIG.username, CONFIG.password);
    headers = helper.getHeaders(true);

    CONFIG.appIdList = helper.appIdsToArray(config.appIdList);

    helper.setStatus('process');
    checkCandidatesStatus();
  },
  abort: (ws) => {
    isAborted = true;
    if (!helper) {
      helper = new Helper(ws);
    }
    if (!requestQueue.length) {
      helper.setStatus('pending');
      return helper.sendMessage(`There is nothing to terminate`);
    }

    helper.sendMessage(`Threads in queue: ${requestQueue.length}\nTrying to abort...`);
    requestQueue.forEach(el => {
      try {
        el.abort();
        helper.sendMessage(`Thread ${requestQueue.indexOf(el)} was terminated`);
        removeQueueElement(el);
        if (!requestQueue.length) {
          helper.sendMessage(`All threads terminated!`);
          helper.setStatus('pending');
        }
      } catch (e) {
        helper.sendMessage(e + '');
        helper.setStatus('pending');
      }
    });
  }
};

function removeQueueElement(request) {
  requestQueue.splice(requestQueue.indexOf(request), 1);
}

function checkCandidatesStatus() {
  let counter = 0;
  CONFIG.appIdList.forEach(element => {
    let id = element.id ? element.id : element;
    let request = Request.get({
      url: api.getApplication(id),
      headers: helper.getHeaders(true)
    }, (err, response, body) => {
      removeQueueElement(request);
      helper.errorHandler(response.statusCode, id);

      if (isAborted) {
        helper.sendMessage(`Endorsing was stopped by user`);
        return helper.setStatus('pending');
      }

      counter++;

      try {
        const data = JSON.parse(body);
        switch (data.task) {
          case 'accountManagerEndorsesApplication':
          case 'candidateTakesTalentAdvocateTest':
            helper.sendMessage(`Candidate with Application ID ${id} ready for endorse`);
            break;
          case 'recruitmentAnalystGrades5QTest':
            helper.sendMessage(`Candidate with Application ID ${id} is waiting for a grade for free response questions`);
            removeCandidate();
            break;
          default:
            helper.candidateStatusHandler(data.status, id);
            removeCandidate();
            break;
        }
      } catch (e) {
        helper.sendMessage(e.toString());
      }

      function removeCandidate() {
        CONFIG.appIdList.splice(
          CONFIG.appIdList.indexOf(
            CONFIG.appIdList.find((el) => el.id === id)
          ), 1);
        counter--;
      }

      if (counter === CONFIG.appIdList.length) {
        helper.sendMessage(`All candidates were tested and ${CONFIG.appIdList.length} ready to endorse`);
        if(CONFIG.appIdList.length) {
          endorseCandidates();
        } else {
          helper.sendMessage(`There is no candidates to endorse. Terminating.`);
          helper.setStatus('pending');
        }
      }
    });
    requestQueue.push(request);
  });
}

function endorseCandidates() {
  let counter = 0;
  CONFIG.appIdList.forEach(element => {
    let id = element.id ? element.id : element;
    let request = Request.post({
      url: api.endorse(id),
      headers: helper.getHeaders(false)
    }, (err, response) => {

      removeQueueElement(request);
      if ( helper.errorHandler(response.statusCode, id) !== 200 ) {
        return;
      }

      helper.sendMessage(`Candidate with Application ID ${id} successfully endorsed`);
      if (isAborted) {
        helper.sendMessage(`Endorsing was stopped by user`);
        return helper.setStatus('pending');
      }
      counter++;
      if (counter === CONFIG.appIdList.length) {
        fillPreHireForm();
      }
    });
    requestQueue.push(request);
  });
}

function fillPreHireForm() {
  let counter = 0;
  CONFIG.appIdList.forEach(element => {
    let id = element.id ? element.id : element;
    let englishScore = element.score && element.score !== id ? element.score : DEFAULT_ENGLISH_SCORE;
    let request = Request.put({
      url: api.preHireFormCall(id),
      headers: headers,
      json: api.payloads.preHireFormCall(englishScore)
    }, (err, response) => {
      removeQueueElement(request);
      if ( helper.errorHandler(response.statusCode, id) !== 200 ) {
        return;
      }

      helper.sendMessage(`Pre Hire Form filled for candidate with Application ID ${id} with English score ${englishScore}`);
      if (isAborted) {
        helper.sendMessage(`Filling Pre Hire form was stopped by user`);
        return helper.setStatus('pending');
      }
      counter++;
      if (counter === CONFIG.appIdList.length) {
        helper.sendMessage(`Starting approval of candidates`);
        acceptCandidates();
      }
    });
    requestQueue.push(request);
  });
}

function acceptCandidates(counter) {
  setTimeout(function () {
    counter = counter ? counter : 0;

    if (counter === CONFIG.appIdList.length) {
      helper.sendMessage(`All candidates were moved to Marketplace!`);
      helper.setStatus('pending');
      return;
    }

    let id = CONFIG.appIdList[counter].id;

    let request = Request.post({
      url: api.accept(id),
      headers: helper.getHeaders(false),
      body: JSON.stringify(api.payloads.accept(id))
    }, (err, response, body) => {
      removeQueueElement(request);
      if ( helper.errorHandler(response.statusCode, id) !== 200 ) {
        if (response.statusCode === 400) {
          helper.sendMessage(`Candidate with Application ID ${id} already on marketplace`);
        }
      } else {
        helper.sendMessage(`Candidate with Application ID ${id} successfully accepted`);
      }

      if (isAborted) {
        helper.sendMessage(`Accepting was stopped by user`);
        return helper.setStatus('pending');
      }
      if (counter !== CONFIG.appIdList.length) {
        acceptCandidates(++counter);
      }
    });
    requestQueue.push(request);
  });
}
