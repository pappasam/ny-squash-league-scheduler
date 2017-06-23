/**
 * divide two numbers
 */
function divide(numerator, denominator) {
  if (denominator === 0) {
    return 0;
  } else {
    return numerator / denominator;
  }
}

/**
 * calculate round robin for one division of teams
 * returns an array of round representations (array of player pairs)
 * Example input:
 *   teamArray: ['a', 'b', 'c']
 *   dummy: 'DUMMY'
 * Example output:
 *   [
 *     [['a', 'b'], ['c', 'DUMMY']],
 *     [['a', 'c'], ['b', 'DUMMY']],
 *     [['a', 'DUMMY'], ['b', 'c']]
 *   ]
 * inspiration: https://github.com/clux/roundrobin/blob/master/robin.js
 */
function roundRobin(teamArray, dummy) {
  var numberTeams = teamArray.length;
  var resultArray = [];  // rs = round array
  teamArray = teamArray.slice();

  // handle odd numbers by adding dummy team
  if (numberTeams % 2 === 1) {
    teamArray.push(dummy);
    numberTeams += 1;
  }
  for (var j = 0; j < numberTeams - 1; j += 1) {
    resultArray[j] = []; // create inner match array for round j
    for (var i = 0; i < numberTeams / 2; i += 1) {
      // insert pair as a match
      resultArray[j].push([teamArray[i], teamArray[numberTeams - 1 - i]]);
    }
    teamArray.splice(1, 0, teamArray.pop()); // permutate for next round
  }
  return resultArray;
}

/**
 * Constructor for a team object
 * @param {Array} arrayFromTeams - an array from google sheet
 */
function createTeam(arrayFromTeams) {
  return {
    id: arrayFromTeams[0],
    division: arrayFromTeams[1],
    home: arrayFromTeams[2],
    dow: arrayFromTeams[5],
    numberHome: 0,
    numberAway: 0
  };
}

/**
 * Constructor for a Dates object
 * @param {Array} arrayFromDates - an array from google sheet
 */
function createDates(arrayFromDates) {
  return {
    date: arrayFromDates[0],
    dow: arrayFromDates[1],
    do_not_play: arrayFromDates[2]
  };
}

/**
 * Generates an array of objects read from a google sheet
 * @param {Spreadsheet} sheetObject - a google spreadsheet object
 * @param {string} sheetName - the name of the desired tab
 * @param {function} rowFunction - a function that unpacks an array into an object
 * @param {function} filterFunction - a function that determines whether unpacked object is ok
 */
function readSheetIntoArrayOfObjects(sheetObject, sheetName, rowFunction, filterFunction) {
  if (filterFunction === undefined) {
    var filterFunction = function() { return true; };
  }
  var sheet = sheetObject.getSheetByName(sheetName);
  var sheetValues = sheet.getDataRange().getValues();
  var returnArray = [];
  for (var i = 1; i < sheetValues.length; i++) {
    var rowObject = rowFunction(sheetValues[i]);
    if (filterFunction(rowObject)) {
      returnArray.push(rowObject);
    }
  }
  return returnArray;
}

/**
 * Generates organized teams for lookups
 *
 * @param {Array} teamsArray - array of teams
 * @returns {Object[dow][division][Array[Team]]} - lookup for teams
 */
function getOrganizedTeams(teamsArray) {
  var returnValue = {};
  for (var i = 0; i < teamsArray.length; i++) {
    var team = teamsArray[i];
    if (returnValue[team.dow] === undefined) {
      returnValue[team.dow] = {};
    }
    if (returnValue[team.dow][team.division] === undefined) {
      returnValue[team.dow][team.division] = [];
    }
    returnValue[team.dow][team.division].push(team);
  }
  return returnValue;
}

/**
 * Generates round robin for teams
 *
 * @returns {Object[dow][division][Array[Team]]} - lookup for teams
 * @returns {Object[dow][division][RoundRobinArray}
 */
function mutateTeamsOrganizedGenRoundRobin(teamsOrganized, dummy) {
  for (var dow in teamsOrganized) {
    if (teamsOrganized.hasOwnProperty(dow)) {
      for (var division in teamsOrganized[dow]) {
        if (teamsOrganized.hasOwnProperty(dow)) {
          teamsOrganized[dow][division] = roundRobin(
            teamsOrganized[dow][division],
            dummy
          );
        }
      }
    }
  }
  return teamsOrganized;
}

// main function
function generateSchedule() {  // eslint-disable-line no-unused-vars
  var spreadsheet = SpreadsheetApp.openById('1FO7GoOgNbyVNmzfbbKI2G8peCLxTKCghPImsNtk7blM');
  var teamsArray = readSheetIntoArrayOfObjects(spreadsheet, 'Teams', createTeam);
  var teamsOrganized = getOrganizedTeams(teamsArray);
  var dummyTeam = createTeam([-1, "DUMMY", "NONE", "any"]);
  var teamsRobin = mutateTeamsOrganizedGenRoundRobin(teamsOrganized, dummyTeam);

  var datesFilter = function(dateObject) { return dateObject.do_not_play !== 'x'; };
  var datesArray = readSheetIntoArrayOfObjects(spreadsheet, 'Dates', createDates, datesFilter);
  var robin = teamsRobin.monday.M35;

  var sheetOut = spreadsheet.getSheetByName("GeneratedSchedule");
  for (var i = 0; i < datesArray.length; i++) {
    var date = datesArray[i].date;
    var dow = datesArray[i].dow;
  }
  for (var i = 0; i < robin.length; i++) {
    sheetOut.appendRow(['round ' + i]);
    for (var j = 0; j < robin[i].length; j++) {
      var team1 = robin[i][j][0];
      var team2 = robin[i][j][1];
      sheetOut.appendRow([team1.id, team1.home, team2.id, team2.home, divide(team2.numberHome, team2.numberAway)]);
    }
  }
  for (var i = 0; i < 10; i++) {
    sheetOut.appendRow([datesArray[i].date, datesArray[i].do_not_play]);
  }
}
