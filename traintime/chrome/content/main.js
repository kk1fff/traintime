var browser;

var Utils = {
  getPaddedNumber: function(number, pad) {
    var numStr = number.toString();
    if (numStr.length >= pad) {
      return numStr;
    }

    for (var i = numStr.length; i < pad; i++) {
      numStr = "0" + numStr;
    }
    return numStr;
  },

  getCommandArray: function(cmdLine) {
    var cmd = [];
    for (var i = 0; i < cmdLine.length; i++) {
      cmd.push(cmdLine.getArgument(i));
    }
    return cmd;
  },

  getNumber: function(num) {
    if (typeof num == 'number') return num;
    return parseInt(num.replace(/^0+/, ""));
  }
};

function loadURI(uri, loadCallback) {
  function contentLoadedHandler(e) {
    var target = e.originalTarget;
    if (target != browser.contentDocument) {
      return;
    }

    browser.removeEventListener("DOMContentLoaded", contentLoadedHandler);
    var uri = target.documentURI;
    dump("uri: " + uri + "\n");
    loadCallback(target);
  }

  browser.addEventListener("DOMContentLoaded", contentLoadedHandler);
  browser.loadURI(uri);
}

function trainOfStationWithUri(uri, doneCb, errorCb) {
  loadURI(uri, function(doc) {
    var rows = doc.querySelectorAll("table#ResultGridView > tbody > tr"),
        result = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var fields = row.children;
      try {
        dump("Result: " + fields.item(1).querySelector("a"));
        result.push({
          "type": fields.item(0).textContent.trim(),
          "code": {
            "code": fields.item(1).textContent.trim(),
            "queryUri": fields.item(1).querySelector("a").href
          },
          "terminal":  fields.item(3).textContent.trim(),
          "arrive": fields.item(4).textContent.trim(),
          "leave": fields.item(5).textContent.trim()
        });
      } catch (e) {
        dump("Error when parsing element: " + e + "\n");
      }
    }
    doneCb(result);
  });
}

/**
 * Expected option
 * {
 *   year: xxxx,
 *   month: xx,
 *   day: xx,    // Date are in number
 *   stationCode:
 *   direction: // 0: clockwise, 1: counter-clockwise
 *   
 * }
 */
function trainOfStation(options, doneCb, errorCb) {
  var url = "http://twtraffic.tra.gov.tw/twrail/SearchResult.aspx?" +
        "searchtype=1&searchdate=" + options.year + "/" +
        Utils.getPaddedNumber(options.month, 2) + "/" +
        Utils.getPaddedNumber(options.day, 2) +
        "&fromstation=" + Utils.getPaddedNumber(options.stationCode, 4) +
        "&trainclass=undefined&traindirection=" + options.direction +
        "&fromtime=0000&totime=2359";
  trainOfStationWithUri(url, doneCb, errorCb);
}

function cityList(doneCb, errorCb) {
  function loadHandler(doc) {
    var result = [];
    var citySelector = doc.querySelector("select#FromCity");
    var cityOptions = doc.querySelectorAll("select#FromCity > option");
    for (var i = 0; i < cityOptions.length; i++) {
      var opt = cityOptions.item(i);
      var val = parseInt(opt.value);
      if (val < 0) continue;

      // Set FromCity to the city
      citySelector.value = opt.value;
      citySelector.onchange();

      // Get all stations in this city
      var stationOptions = doc.querySelectorAll("select#FromStation > option");
      for (var j = 0; j < stationOptions.length; j++) {
        var stationOpt = stationOptions.item(j);
        result.push({
          station: stationOpt.textContent.trim(),
          code: stationOpt.value
        });
      }
    }
    doneCb(result);
  }

  loadURI(
    'http://twtraffic.tra.gov.tw/twrail/StationScheduleSearch.aspx?browser=ff',
    function (doc) {
      // Wait for script in page.
      window.setTimeout(loadHandler, 1000, doc);
    });
}

function singleTrain(uri, doneCb, errorCb) {
  function loaded(doc) {
    var rows = doc.querySelectorAll("#ResultGridView .Grid_Row");
    var result = [];
    // Skip the first line, which is title.
    for (var i = 1; i < rows.length; i++) {
      var row = rows.item(i);
      var cells = row.children;
      result.push({
        "station": cells.item(1).textContent.trim(),
        "arrive": cells.item(2).textContent.trim(),
        "leave": cells.item(3).textContent.trim()
      });
    }
    doneCb(result);
  }

  loadURI(uri, loaded);
}


function startDaemon(hostUrl) {
  dump("Connect to: " + hostUrl);
  try {
  var socket = io.connect(hostUrl);
  socket.on('hello', function (data) {
    dump('Received hello\n');
    socket.emit('hi', { "val": "hi from traintable" });
  });
  } catch (e) {
    dump("error: " + e);
  }
}

window.addEventListener('load', function(e) {
  function doneCallback(result) {
    dump("result: " + JSON.stringify(result) + "\n");

    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
                     getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
  }

  function errorCallback() {
  }
  var action = cmds[0];
  cmds.shift();

  browser = document.getElementById('bw');

  switch (action) {
  case "citylist":
    cityList(doneCallback, errorCallback);
    break;
  case "trainofstation":
  case "tos":
    trainOfStation({
      year:        Utils.getNumber(cmds[0]),
      month:       Utils.getNumber(cmds[1]),
      day:         Utils.getNumber(cmds[2]),
      direction:   Utils.getNumber(cmds[3]),
      stationCode: Utils.getNumber(cmds[4])
    }, doneCallback, errorCallback);
    break;
  case "singletrain":
  case "st":
    singleTrain(cmds[0], doneCallback, errorCallback);
    break;
  case "daemon":
    startDaemon(cmds[0]);
    break;
  }
});

var cmdLine = window.arguments[0],
    cmds = Utils.getCommandArray(cmdLine.QueryInterface(Components.interfaces.nsICommandLine));
dump("Load init URI: " + initUri + ", action: " + action + "\n");
