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

var tempChart = undefined,
    batteryChart = undefined,
    rainfallChart = undefined; // types of charts
var transitionDuration = 500; //default transition times for chart zooming etc

function dashboardInit() {
  var tempChartWidth = document.getElementById('tempChart').offsetWidth,
      tempChartHeight = tempChartWidth * 0.1,
      rainFallChartWidth = document.getElementById('rainfallChart').offsetWidth,
      rainFallChartHeight = rainFallChartWidth * 0.1;
  tempChart = dc.lineChart('#tempChart').width(tempChartWidth).height(tempChartHeight).transitionDuration(transitionDuration).margins({ top: 30, right: 50, bottom: 25, left: 40 });
  rainfallChart = dc.barChart('#rainfallChart').width(rainFallChartWidth).height(rainFallChartHeight).transitionDuration(10).margins({ top: 30, right: 50, bottom: 25, left: 40 });
  //batteryChart = dc.lineChart('#batteryChart');
}

function getInitData() {
  d3.csv('JCMB_2015.csv', function (err, data) {
    if (err) {
      alert("problem fetching data, please reload page");
      return;
    }
    //parse data after loading to make sure numbers are numbers and dates are Date objs
    data.forEach(function (d) {
      d.dateTime = dateFormatter.parse(d.dateTime);
      Object.keys(d).forEach(function (key) {
        if (d.hasOwnProperty(key) && key !== "dateTime") {
          d[key] = +d[key];
        }
      });
    });
    data.forEach(function (d) {
      d.month = d3.time.month(d.dateTime);
      d.day = d3.time.day(d.dateTime);
      d.hour = d3.time.hour(d.dateTime);
    });

    console.log(data[0]);

    var minDate = d3.min(data, function (d) {
      return d.dateTime;
    }),
        maxDate = d3.max(data, function (d) {
      return d.dateTime;
    });

    xFilter = crossfilter(data);

    var dayDimension = xFilter.dimension(function (d) {
      return d.day;
    });
    var solarFluxDimension = xFilter.dimension(function (d) {
      return d.solarFlux;
    });

    var dayTempGroup = dayDimension.group().reduce(function (p, v) {
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

    var rainFallGroup = dayDimension.group().reduceSum(function (d) {
      return d.rainfall;
    });

    tempChart.dimension(dayDimension).group(dayTempGroup).brushOn(true)
    //.mouseZoomable(true)
    //.keyAccessor(d => d.value.avgTemp)
    .valueAccessor(function (d) {
      return d.value.avgTemp;
    }).x(d3.time.scale().domain([minDate, maxDate])).yAxisLabel('degrees Celcius').on('filtered', function () {
      console.log(dayDimension.top(Infinity));
    });

    rainfallChart.dimension(dayDimension).group(rainFallGroup).valueAccessor(function (d) {
      return d.value;
    }).yAxisLabel('mm').x(d3.time.scale().domain([minDate, maxDate])).elasticY(true).rangeChart(tempChart);

    dc.renderAll();
  });
}

function windowResizeHandler() {
  //debounce function, basically redraw the chart on resize but only after you've
  //finished resizing
  var resizeTimer = undefined;
  window.onresize = function (e) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      dashboardInit();
      dc.renderAll();
    }, 250);
  };
}

dashboardInit();
getInitData();
//# sourceMappingURL=dashboard.js.map
