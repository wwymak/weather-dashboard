'use strict';

/**
 * Main file for the charting js
 *
 * idea: main chart to have temp as time series, grouped by day of year
 * possibly to be zoomable into minute detail, with rainfall superimposed as an extra series above
 * -- would be really cool to do something along the lines of http://bl.ocks.org/emeeks/b57f4cc89dacd38fcdcd
 *
 * (showing pattern in rainfall and temp, which most people are interested in
 * rainfall + temp so you can know whetehr it's generally cold and wet/ hot and wet, vice versa etc
 *
 *
 * secondary charts:
 * wind direction distrubution average for the date range selected with brush (radar chart)
 *
 * battery level vs solar flux
 *
 */

var dateFormatter = d3.time.format('%Y/%m/%d %H:%M');
var xFilter = undefined; //crossfilter
var dayDimension = undefined,
    solarFluxDimension = undefined,
    windDirDimension = undefined; //dimensions- basically what you want as x values
var dayTempGroup = undefined,
    rainFallGroup = undefined,
    windDirGroup = undefined; //xfilter groups

var tempChart = undefined,
    batteryChart = undefined,
    rainfallChart = undefined,
    windChart = undefined; // types of charts
var transitionDuration = 500; //default transition times for chart zooming etc

/**
 * initialises the dashboard elements that dc draws, setting the height and width
 * dynamically so on window resize the chart redraws according to new dimensions
 */
function dashboardInit() {
  var tempChartWidth = document.getElementById('tempChart').offsetWidth,
      tempChartHeight = tempChartWidth * 0.3,
      rainFallChartWidth = document.getElementById('rainfallChart').offsetWidth,
      rainFallChartHeight = rainFallChartWidth * 0.3;
  tempChart = dc.lineChart('#tempChart').width(tempChartWidth)
  //.minWidth(150)
  .height(tempChartHeight)
  //.minHeight(150)
  .transitionDuration(transitionDuration).margins({ top: 30, right: 50, bottom: 25, left: 40 });
  rainfallChart = dc.barChart('#rainfallChart').width(rainFallChartWidth).height(rainFallChartHeight).transitionDuration(10).margins({ top: 30, right: 50, bottom: 25, left: 40 });
  //batteryChart = dc.lineChart('#batteryChart');
}

/**
 * get the csv data using d3.promise, then do a few bits of parsing
 * @returns {Promise.<T>}
 */
function getData() {
  return d3.promise.csv('JCMB_2015.csv').then(function (data) {
    data.forEach(function (d) {
      d.dateTime = dateFormatter.parse(d.dateTime);
      Object.keys(d).forEach(function (key) {
        if (d.hasOwnProperty(key) && key !== "dateTime") {
          d[key] = +d[key];
        }
      });
      if (d.windDir >= 360) {
        d.windDir = d.windDir % 360;
      }
      d.day = d3.time.day(d.dateTime);
      d.windDirType = Math.floor(d.windDir / 45); //classify the wind direction into 1 of 8 quadrants
    });
    //data.forEach(d => {
    //  d.month = d3.time.month(d.dateTime);
    //  d.day = d3.time.day(d.dateTime);
    //  d.hour = d3.time.hour(d.dateTime);
    //  d.windDirType = Math.floor(d.windDir / 45); //classify the wind direction into 1 of 8 quadrantsa
    //});

    return data;
  }, function (err) {
    alert("problem fetching data, please reload page");
  });
}

function setXfilter(data) {
  xFilter = crossfilter(data);
  dayDimension = xFilter.dimension(function (d) {
    return d.day;
  });
  solarFluxDimension = xFilter.dimension(function (d) {
    return d.solarFlux;
  });
  windDirDimension = xFilter.dimension(function (d) {
    return d.windDirType;
  });
  console.log(d3.max(data, function (d) {
    return d.windDir;
  }));

  dayTempGroup = dayDimension.group().reduce(function (p, v) {
    ++p.count;
    p.totalTemp += v.surfTemp;
    p.avgTemp = p.totalTemp / p.count;
    return p;
  }, function (p, v) {
    --p.count;
    p.totalTemp -= v.surfTemp;
    p.avgTemp = p.totalTemp / p.count;
    return p;
  }, function () {
    return {
      count: 0,
      totalTemp: 0,
      avgTemp: 0
    };
  });

  rainFallGroup = dayDimension.group().reduceSum(function (d) {
    return d.rainfall;
  });
  windDirGroup = windDirDimension.group().reduceCount();
}

function chartRender(data) {
  var minDate = d3.min(data, function (d) {
    return d.dateTime;
  }),
      maxDate = d3.max(data, function (d) {
    return d.dateTime;
  });
  tempChart.dimension(dayDimension).group(dayTempGroup).brushOn(true).valueAccessor(function (d) {
    return d.value.avgTemp;
  }).x(d3.time.scale().domain([minDate, maxDate])).yAxisLabel('degrees Celcius').on('filtered', function () {
    console.log('filtered');
    d3.select('#windDirChart').datum(windDirGroup.all()).call(radarChart());
  });

  rainfallChart.dimension(dayDimension).group(rainFallGroup).valueAccessor(function (d) {
    return d.value;
  }).yAxisLabel('mm').x(d3.time.scale().domain([minDate, maxDate])).elasticY(true).rangeChart(tempChart);

  //console.log(windDirGroup.all())
  windChart = d3.select('#windDirChart').datum(windDirGroup.all()).call(radarChart());
  dc.renderAll();
}

//radarChart for windDirection data
function radarChart() {
  var width = 400,
      height = 400,
      margin = 40,
      angleScale = d3.scale.linear().range([0, 2 * Math.PI]),
      radiusScale = d3.scale.linear().range([0, d3.min([height, width]) / 2 - margin]),
      colorScale = d3.scale.category20(); //temp colors-- don't look super great tbh,

  var stackFunc = d3.layout.stack().values(function (d) {
    return d.values;
  });

  function chart(selection) {
    var _this = this;

    var svg = undefined;
    //assuming that data is in the format of array with [{key: .., value:...}, ...]
    selection.each(function (data) {
      //select the svg if it exists
      svg = _this.selectAll("svg.radarchart").data([data]);
      console.log(data, svg);
      //or add a new one if not
      var newSVG = svg.enter().append('svg').attr('class', 'radarchart');

      svg.attr("width", width).attr("height", height);

      angleScale.domain([0, data.length]);
      radiusScale.domain([0, d3.max(data, function (d) {
        return d.value;
      })]);

      var radialG = newSVG.append('g').attr('class', 'radial-bars').attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

      drawRadialBars(data);

      function drawRadialBars(data) {
        var arc = d3.svg.arc().startAngle(function (d, i) {
          return angleScale(i);
        }).endAngle(function (d, i) {
          return angleScale(i + 1);
        }).innerRadius(0).outerRadius(function (d) {
          return radiusScale(d.value);
        });
        var radarSectors = radialG.selectAll('path').data(data);
        radarSectors.enter().append('path');
        radarSectors.attr('d', arc).attr('class', 'radial-sector').attr('fill', function (d, i) {
          return colorScale(i);
        });
      }
    });
  }

  //getters and setters
  chart.width = function (val) {
    if (!arguments.length) {
      return width;
    }
    width = val;
    return chart;
  };

  chart.height = function (val) {
    if (!arguments.length) {
      return height;
    }
    height = val;
    return chart;
  };

  chart.margin = function (val) {
    if (!arguments.length) {
      return margin;
    }
    margin = val;
    return chart;
  };

  return chart;
}
//todo dcjs don't seem to like the resizing very much...
function windowResizeHandler() {
  //debounce function, basically redraw the chart on resize but only after you've
  //finished resizing
  var resizeTimer = undefined;
  window.onresize = function (e) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      //dashboardInit();
      dc.redrawAll();
    }, 250);
  };
}

dashboardInit();

getData().then(function (data) {
  setXfilter(data);
  return data;
}, function (err) {
  console.log(err);
}).then(function (data) {
  chartRender(data);
});
//# sourceMappingURL=dashboard.js.map
