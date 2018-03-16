let google = require('googleapis').google;
let privatekey = require("./config/AutoGrader-927e01a133dc.json");

// configure a JWT auth client
let authClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ['https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly']);

//authenticate request
authClient.authorize(function (err, tokens) {
  if (err) {
    console.log(err);
    return;
  } else {
    console.log("Successfully connected!");
    getTrackerFileIdByPipelineId(3401);
  }
});

function retrieveCandidates(fileId) {
  fileId = fileId ? fileId.id : false;
  if(!fileId) { return; }

  let sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: '1IWvDWOby6D1Jb-sUr5KoVZn0ZO-RRUztNeryjqAbrss',
    range: 'VP_Technical_Product_Management',
    majorDimension: "ROWS"
  }, function (err, response) {
    console.log(response);
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }

    var rows = response.data.values;
    if (rows.length === 0) {
      console.log('No data found.');
    } else {
      // filter data to get candidates with only 'IN_PROGRESS' status and also check for presence of English Score
      //console.log(rows);
      rows = rows.filter(function (row) {
        return row[8] == 'IN_PROGRESS' && !isNaN(row[16].replace(/%/g, ''));
      });
      console.log(rows.length);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        // Print columns Name, Status, English Score
        //console.log(row[1], row[8], row[16]);
      }
    }
  });
}

function getTrackerFileIdByPipelineId(pipelineId) {
  // ID of google drive folder to search tracker files in
  const trackerFolderId = '1GgVX-RnzHlO7r0seSDk2DHPDRvYmfj-K';
  const drive = google.drive('v3');

  // all tracker files contain pipelineId in their name
  drive.files.list({
    auth: authClient,
    q: `'${trackerFolderId}' in parents and name contains '${pipelineId}'`
  }, (err, response) => {
    if (err) {
      console.log(`The API returned an error: ${err}`);
      return;
    }
    // match file that ends with specific pipeline ID
    // needed to differentiate pipelines like 33 and 332, as sheet service query only supports contains
    retrieveCandidates(
      response.data.files.find( (file) => file.name.endsWith(`Tracker - ${pipelineId}`) > 0 )
    );
  });
}
