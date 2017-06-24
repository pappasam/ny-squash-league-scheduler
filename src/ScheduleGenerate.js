/**
 * generateSchedule
 *
 * the main function
 */
function generateSchedule() {  // eslint-disable-line no-unused-vars
  var spreadsheet = SpreadsheetApp.openById('1FO7GoOgNbyVNmzfbbKI2G8peCLxTKCghPImsNtk7blM');
  var teamsArray = readSheetIntoArrayOfObjects(spreadsheet, 'Teams', createTeam);
  var teamsOrganized = getOrganizedTeams(teamsArray);

  var dummyTeam = createTeam([-1, "BYE", "BYE", "BYE", "BYE", "BYE"]);

  var teamsRobin = mutateTeamsOrganizedGenRoundRobin(teamsOrganized, dummyTeam);

  var datesFilter = function(dateObject) { return dateObject.do_not_play !== 'x'; };
  var datesArray = readSheetIntoArrayOfObjects(spreadsheet, 'Dates', createDates, datesFilter);

  var venuesArray = readSheetIntoArrayOfObjects(spreadsheet, 'Venues', createVenue);
  var venuesOrganized = arrayToObject(venuesArray, 'id');

  var divisionsArray = readSheetIntoArrayOfObjects(spreadsheet, 'Divisions', createDivision);
  var divisionsOrganized = arrayToObject(divisionsArray, 'id');

  var sheetOut = spreadsheet.getSheetByName("GenerateSchedule");

  // generate schedule for each date
  for (var i = 0; i < datesArray.length; i++) {
    var date = datesArray[i].date;
    var dow = datesArray[i].dow;
    var robinDivisions = teamsRobin[dow];

    // reset each venue's used capacity to 0
    for (var j = 0; j < venuesArray.length; j++) {
      venuesArray[j].used = 0;
    }

    // generate pairings
    var pairings = []; // Array[Array[Team, Team]]
    for (var robinDivisionKey in robinDivisions) {
      if (robinDivisions.hasOwnProperty(robinDivisionKey)) {
        var roundsPlayed = divisionsOrganized[robinDivisionKey].round;
        var numberRounds = robinDivisions[robinDivisionKey].length;
        var roundNumber = roundsPlayed % numberRounds;
        var round = robinDivisions[robinDivisionKey][roundNumber];
        for (var j = 0; j < round.length; j++) {
          pairings.push(round[j]);
        }
        divisionsOrganized[robinDivisionKey].round++;
      }
    }
    pairings.sort(pairingsSort);

    // function to write a row to the GeneratedSchedule
    var writeRow = function(homeTeam, awayTeam, dummyVenueName) {
      if (dummyVenueName) {
        var venue = dummyVenueName;
      } else {
        var venue = homeTeam.home;
        homeTeam.numberHome++;
        awayTeam.numberAway++;
        venuesOrganized[venue].used++;
      }
      sheetOut.appendRow([
        date, dow,
        homeTeam.id, homeTeam.description,
        awayTeam.id, awayTeam.description,
        venue,
      ]);
    };

    // iterate over pairings,
    for (var j = 0; j < pairings.length; j++) {
      var teamA = pairings[j][0];
      var teamB = pairings[j][1];
      var venueA = venuesOrganized[teamA.home];
      var venueB = venuesOrganized[teamB.home];

      // assign home and away, writing rows to dataset
      if (teamA.id === dummyTeam.id) {
        writeRow(teamB, teamA, 'Bye Week');
      } else if (teamB.id === dummyTeam.id) {
        writeRow(teamA, teamB, 'Bye Week');
      } else if (venueA.used >= venueA[dow] && venueB.used >= venueB[dow]) {
        writeRow(teamA, teamB, 'NO CAPACITY');
      } else if (venueA.used >= venueA[dow]) {
        writeRow(teamB, teamA);
      } else if (venueB.used >= venueB[dow]) {
        writeRow(teamA, teamB);
      } else if (homeAwayRatio(teamA) < homeAwayRatio(teamB)) {
        writeRow(teamA, teamB);
      } else {
        writeRow(teamB, teamA);
      }

      // if venue offers no space, add 1 to team's home record
      // prevents freeloaders from always rising to top of list
      if (teamA.id !== dummyTeam.id && venueA[dow] === 0) {
        teamA.numberHome++;
      }
      if (teamB.id !== dummyTeam.id && venueB[dow] === 0) {
        teamB.numberHome++;
      }
    }
  }
}

///////////////////////////////////////////////////////////
// Sheet row object creation functions
///////////////////////////////////////////////////////////

/**
 * Constructor for Division object
 * @param {Array} arrayFromDivisions
 */
function createVenue(arrayFromVenues) {
  return {
    id: arrayFromVenues[0],
    monday: arrayFromVenues[2],
    tuesday: arrayFromVenues[3],
    wednesday: arrayFromVenues[4],
    thursday: arrayFromVenues[5],
    used: 0
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
    description: arrayFromTeams[4],
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

/**
 * homeAwayRatio
 *
 * @param {Array[Team, Team]} team
 * @returns {number} - a float
 */
function homeAwayRatio(team) {
  return divide(team.numberHome, team.numberAway);
}

/**
 * Function to sort pairings in a round,
 * with smallest home/away ratio first and largest last
 * @param {Array[Team, Team]} pairA
 * @param {Array[Team, Team]} pairB
 * @return {number}
 */
function pairingsSort(pairA, pairB) {
  var maxRatioA = Math.min(homeAwayRatio(pairA[0]), homeAwayRatio(pairA[1]));
  var maxRatioB = Math.min(homeAwayRatio(pairB[0]), homeAwayRatio(pairB[1]));
  return maxRatioA - maxRatioB;
}
