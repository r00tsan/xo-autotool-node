const grade = require('../xo-api-executors/grade');
const endorse = require('../xo-api-executors/endorse');
const reject = require('../xo-api-executors/reject');
const resume = require('../xo-api-executors/resume-auto-grade');

const wsApi = (ws) => {
  ws.jsend = convertResponseToJson;
  ws.on('message', request => {
    try {
      const jsonRequest = JSON.parse(request);
      websocketTaskSwitcher(jsonRequest, ws);
    } catch(e) {
      console.log(e);
    }
  });
};

function websocketTaskSwitcher(request, ws) {
  if (request.config) {
    request.config.ws = ws;
  }
  switch(request.task) {
    case 'grade:run':
      grade.run(request.config);
      break;
    case 'grade:abort':
      grade.abort(ws);
      break;
    case 'endorse:run':
      endorse.run(request.config);
      break;
    case 'endorse:abort':
      endorse.abort(ws);
      break;
    case 'reject:run':
      reject.run(request.config);
      break;
    case 'reject:abort':
      reject.abort(ws);
      break;
    case 'resume:run':
      resume.run(request.config);
      break;
    case 'resume:abort':
      resume.abort(ws);
      break;
  }
}

function convertResponseToJson(msg, data = {}) {
  try {
    return this.send(JSON.stringify({msg: msg, response : data}));
  } catch(e) {
    console.log(e);
  }
}

module.exports = wsApi;
