'use strict';

const google = require('googleapis').google;
const privatekey = require("../config").googlePrivateKey;
let authClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ['https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly']);

const Request = require('request');
const api = require('./xo-api-urls');
const Helper = require('../helper/helper');

let requestQueue = [];
let headers;
let CONFIG;
let helper;
let isAborted;
let scoresFromGoogleSheet;
let testDetails;

module.exports = {
  run: function (config) {
    isAborted = false;
    CONFIG = config;
    CONFIG.resume.spreadsheet = CONFIG.resume.spreadsheet.replace(/^.*\/d\/|\/edit.*$/g, '');
    helper = new Helper(CONFIG.ws, CONFIG.username, CONFIG.password);
    headers = helper.getHeaders(true);

    helper.setStatus('process');
    authClient.authorize(function (err, tokens) {
      if (err) {
        console.log(err);
        helper.sendMessage(err);
      } else {
        console.log("Successfully connected to google api!");
        getJobDetails();
      }
    });
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

function getJobDetails() {
  let request = Request.get({
    url: api.jobDetails(CONFIG.jobId),
    headers: helper.getHeaders(true),
  }, function (error, response, body) {
    if ( helper.errorHandler(response.statusCode, 0) !== 200 ) {
      return;
    }
    try {
      testDetails = JSON.parse(body).tests.filter((el) => el.test.type === 'RESUME_RUBRIC')[0].test;
      getCandidatesFromGoogleSheet();
    } catch (e) {
      helper.sendMessage(e.toString());
    }
  });
}

function getCandidatesFromGoogleSheet() {
  helper.sendMessage(`Resume Grading started`);
  const sheets = google.sheets('v4');

  sheets.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: CONFIG.resume.spreadsheet,
    range: CONFIG.resume.tab,
    majorDimension: "ROWS"
  }, function (err, response) {

    if (err) {
      helper.sendMessage(`Google Sheet ${err}`);
      return;
    }

    const gradeColumn = response.data.values[0].indexOf(CONFIG.resume.columnName);
    const emailColumn = response.data.values[0].indexOf('Email');
    response.data.values.splice(0, 1);
    scoresFromGoogleSheet = response.data.values
      .filter((item) => {
        const haveLinkedInProfile = item.toString().search('linkedin.com') > -1;
        if (haveLinkedInProfile) {
          helper.sendMessage(`Candidate with email ${item[emailColumn]} have LinkedIn link and will be excluded`);
        }
        return !haveLinkedInProfile;
      })
      .map((row) => ({
        email: row[emailColumn] ? row[emailColumn].trim() : undefined,
        score: row[gradeColumn] ? row[gradeColumn].trim() : undefined
      }))
      .filter((v,i,a) =>
        a.map((el) => el.email).indexOf(v.email) === i // filtering only candidates with unique emails
        && !isNaN(parseInt(v.score, 10))
        && !!v.score// and if candidate have score
      );
    if (!scoresFromGoogleSheet.length) {
      helper.sendMessage(`There is no candidates to grade in this sheet`);
    }

    helper.sendMessage(`Candidates received ${response.data.values.length} from google sheet. 
    Unique and candidates that have score: ${scoresFromGoogleSheet.length}`);
    getAllCandidatesFromXO(1);
  });
}

function getAllCandidatesFromXO(pageSize) {
  if (pageSize === 1) {
    helper.sendMessage(`Requesting candidates from Crossover...`);
  }

  let request = Request.post({
    url: api.searchResume(CONFIG.jobId, pageSize, 'ACCOUNT_MANAGER'),
    headers: helper.getHeaders(true),
    body: JSON.stringify(api.payloads.searchResume(CONFIG.jobId))
  }, function (error, response, body) {
    removeQueueElement(request);

    if ( helper.errorHandler(response.statusCode, 0) !== 200 ) {
      return;
    }

    try {
      body = JSON.parse(body);
      if (!body.last) {
        helper.sendMessage(`On this job(${CONFIG.jobId}) we have ${body.totalElements} candidates`);
        helper.sendMessage(`Trying to fetch all of them... please wait`);
        return getAllCandidatesFromXO(body.totalElements + 30);
      }

      helper.sendMessage(`All candidates fetched, filtering them by emails...`);
      let scoredCandidates = [];
      scoresFromGoogleSheet.forEach((candidate) => {
        let application = body.content.find(app => app.candidate.email === candidate.email);
        if (!application || !candidate.score) { return; }

        if(helper.isCandidateScored(application, testDetails)) {
          return helper.sendMessage(`
            ${application.candidate.printableName} -
            ${application.candidate.email} -
            ALREADY SCORED
          `);
        }

        scoredCandidates.push(
          helper.scoreResumes(application, testDetails, candidate.score)
        );

        helper.sendMessage(`
          ${application.candidate.printableName} - 
          ${application.candidate.email} - 
          ${candidate.score}
        `);
      });
      helper.sendMessage(`Summary were scored ${scoredCandidates.length} out of ${scoresFromGoogleSheet.length}`);
      saveScores(scoredCandidates);
    } catch (e) {
      helper.sendMessage(e.toString());
    }
  });
  requestQueue.push(request);
}

function saveScores(newScores) {
  helper.sendMessage(`Saving scores`);

  let request = Request.put({
    url: api.saveResumeScores,
    headers: helper.getHeaders(true),
    json: newScores
  }, function (error, response, body) {
    removeQueueElement(request);
    if (error) {
      throw error;
    }
    helper.sendMessage(`Scores saved.`);
    helper.setStatus('pending');
  });
}
