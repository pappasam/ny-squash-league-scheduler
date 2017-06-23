/**
 * generateSchedule
 *
 * the main function
 */
function generateSchedule() {  // eslint-disable-line no-unused-vars
  var spreadsheet = SpreadsheetApp.openById('1FO7GoOgNbyVNmzfbbKI2G8peCLxTKCghPImsNtk7blM');
  var teamsArray = readSheetIntoArrayOfObjects(spreadsheet, 'Teams', createTeam);
  var teamsOrganized = getOrganizedTeams(teamsArray);
  var dummyTeam = createTeam([-1, "DUMMY", "NONE", "any"]);
  var teamsRobin = mutateTeamsOrganizedGenRoundRobin(teamsOrganized, dummyTeam);

  var datesFilter = function(dateObject) { return dateObject.do_not_play !== 'x'; };
  var datesArray = readSheetIntoArrayOfObjects(spreadsheet, 'Dates', createDates, datesFilter);

  var venuesArray = readSheetIntoArrayOfObjects(spreadsheet, 'Venues', createVenue);
  var venuesOrganized = arrayToObject(venuesArray, 'id');

  var divisionsArray = readSheetIntoArrayOfObjects(spreadsheet, 'Divisions', createDivision);
  var divisionsOrganized = arrayToObject(divisionsArray, 'id');

  var sheetOut = spreadsheet.getSheetByName("GeneratedSchedule");

  // generate schedule for each date
  for (var i = 0; i < 10; i++) {
    var date = datesArray[i].date;
    var dow = datesArray[i].dow;
    sheetOut.appendRow(['date: ' + date, 'dow: ' + dow]);

    var robinDivisions = teamsRobin[dow];

    // reset each venue's used capacity to 0
    for (var j = 0; j < venuesArray; j++) {
      venuesArray[j][dow].used = 0;
    }

    var pairings = [];
    for (var robinDivisionKey in robinDivisions) {
      if (robinDivisions.hasOwnProperty(robinDivisionKey)) {
        var roundsPlayed = divisionsOrganized[robinDivisionKey].round;
        var numberRounds = robinDivisions[robinDivisionKey].length;
        var roundNumber = roundsPlayed % numberRounds;
        var round = robinDivisions[robinDivisionKey][roundNumber];
        for (var j = 0; j < round.length; j++) {
          var team1 = round[j][0];
          var team2 = round[j][1];
          sheetOut.appendRow([team1.id, team1.home, team2.id, team2.home]);
        }
        divisionsOrganized[robinDivisionKey].round++;
      }
    }
  }


  for (var i = 0; i < 10; i++) {
    sheetOut.appendRow([datesArray[i].date, datesArray[i].do_not_play]);
  }
}

///////////////////////////////////////////////////////////
// Sheet row object creation functions
///////////////////////////////////////////////////////////

/**
 * Constructor for CourtAllocation
 * @param {number} maxCourts - the max courts allowed by a venue
 */
function createCourtAllocation(maxCourts) {
  return {max: maxCourts, used: 0};
}

/**
 * Constructor for Division object
 * @param {Array} arrayFromDivisions
 */
function createVenue(arrayFromVenues) {
  return {
    id: arrayFromVenues[0],
    monday: createCourtAllocation(arrayFromVenues[2]),
    tuesday: createCourtAllocation(arrayFromVenues[3]),
    wednesday: createCourtAllocation(arrayFromVenues[4]),
    thursday: createCourtAllocation(arrayFromVenues[5]),
  };
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
 * Constructor for a Division object
 * @param {Array} arrayFromDivisions - an array from google sheet
 */
function createDivision(arrayFromDivisions) {
  return {
    id: arrayFromDivisions[0],
    round: 0
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

///////////////////////////////////////////////////////////
// Utility functions
///////////////////////////////////////////////////////////

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
 * convert an array into a lookup object on primary key
 *
 * @param {Array[Object]} array - the lookup array
 * @param {string} primaryKeyValue - the primary key name
 * @returns {Object[string, Object]}
 */
function arrayToObject(array, primaryKeyValue) {
  var returnValue = {};
  for (var i = 0; i < array.length; i++) {
    returnValue[array[i][primaryKeyValue]] = array[i];
  }
  return returnValue;
}

///////////////////////////////////////////////////////////
// Round-robin creation functions
///////////////////////////////////////////////////////////

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
 * Generates an array of objects read from a google sheet
 * @param {Spreadsheet} sheetObject - a google spreadsheet object
 * @param {string} sheetName - the name of the desired tab
 * @param {function} rowFunction - a function that unpacks an array into an object
 * @param {function} filterFunction - a function that determines whether unpacked object is ok
 */
function readSheetIntoArrayOfObjects(
  sheetObject,
  sheetName,
  rowFunction,
  filterFunction
) {
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
