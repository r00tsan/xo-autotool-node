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
    config.appIdList = helper.appIdsToArray(config.appIdList);

    helper.setStatus('process');
    startRejection();
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
