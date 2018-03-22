'use strict';

const Request = require('request');
const api = require('./xo-api-urls');
const Helper = require('../helper/helper');

let requestQueue = [];
let headers;
let CONFIG;
let helper;
let isAborted;

module.exports = {
  run:(config) => {
    isAborted = false;
    CONFIG = config;
    helper = new Helper(CONFIG.ws, CONFIG.username, CONFIG.password);
    headers = helper.getHeaders(true);
    config.appIdList = config.appIds;

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
        removeQueueElement(el);
        setTimeout(()=> {
          if (!requestQueue.length) {
            helper.sendMessage(`All threads terminated!`);
            helper.setStatus('pending');
          }
        });
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
      if (response) {
        helper.errorHandler(response.statusCode, id);
      }

      if (isAborted) {
        helper.sendMessage(`Rejecting was stopped by user`);
        return helper.setStatus('pending');
      }

      counter++;

      try {
        const data = JSON.parse(body);
        switch (data.status) {
          case 'ACCEPTED':
            helper.sendMessage(`Candidate with Application ID ${id} already on marketplace`);
            removeCandidate();
            break;
          case 'REJECTED':
          case 'CANCELLED':
            helper.sendMessage(`Candidate with Application ID ${id} was already rejected`);
            removeCandidate();
            break;
          default:
            if (data.httpStatus === 404) {
              removeCandidate();
            } else {
              helper.sendMessage(`Candidate with Application ID ${id} ready for reject`);
            }
            break;
        }
      } catch (e) {
        helper.sendMessage(e.toString());
      }

      function removeCandidate() {
        CONFIG.appIdList.splice(
          CONFIG.appIdList.indexOf(
            CONFIG.appIdList.find((el) => el.id ? el.id === id : el === id)
          ), 1);
        counter--;
      }

      if (counter === CONFIG.appIdList.length) {
        helper.sendMessage(`All candidates were tested and ${CONFIG.appIdList.length} ready to reject`);
        if (CONFIG.appIdList.length) {
          startRejection();
        } else {
          helper.sendMessage(`There is no candidates to endorse. Terminating.`);
          helper.setStatus('pending');
        }
      }
    });
    requestQueue.push(request);
  });
}

function startRejection() {
  let counter = 0;
  CONFIG.appIdList.forEach(item => {
    const id = item.id ? item.id : item;
    let request = Request.delete({
      url: api.reject(id),
      headers: headers,
      body: 'type=REJECT'
    }, (err, response) => {
      if (response.statusCode === 404) {
        return helper.sendMessage(`Candidate with Application ID ${id} does not exists`)
      }

      if (response.statusCode === 401) {
        return helper.sendMessage(`Wrong credentials, try again`);
      }

      removeQueueElement(request);
      helper.sendMessage(`Candidate with Application ID ${id} successfully rejected`);
      if (isAborted) {
        helper.sendMessage(`Rejecting was stopped by user`);
        return helper.setStatus('pending');
      }
      counter++;
      if (counter === CONFIG.appIdList.length) {
        helper.setStatus('pending');
        helper.sendMessage(`All candidates in list were rejected!`);
      }
    });
    requestQueue.push(request);
  });
}
