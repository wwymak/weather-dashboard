'use strict';

/**
 * Main file for the charting of weather data(quick prototype)
 *
 * idea: main chart to have temp as time series, grouped by day of year
 * at the moment only day of year implemented but may be nice to be able
 * to be zoomable into minute detail
 * -- would be really cool to do something along the lines of http://bl.ocks.org/emeeks/b57f4cc89dacd38fcdcd
 * the big radar chart would control all the smaller 'cards'
 *
 * (showing pattern in rainfall and temp, which most people are interested in
 * rainfall + temp so you can know whetehr it's generally cold and wet/ hot and wet, vice versa etc
 *
 *
 * secondary charts:
 * wind direction distrubution average for the date range selected with brush (radar chart)
 *
 * battery level vs solar flux (not implemented yet)
 *
 * needs a data loading spinner
 *
 * want some sort of headline 'status now values' at top of board
 * e.g. ON THIS DAY, rainfall is x, temp is y and wind direction is z degrees
 *
 * simple sketch/prototype for now. To make it more scaleable would probably want
 * different modules for data parsing, possibly componentising each chart/ chartype
 * would also be useful to be handle different data types etc
 */

(function () {
  //data utils, params
  var dateFormatter = d3.time.format('%Y/%m/%d %H:%M');
  var xFilter = undefined; //crossfilter
  var dayDimension = undefined,
      weekDimension = undefined,
      solarFluxDimension = undefined,
      windDirDimension = undefined; //dimensions- basically what you want as x values
  var dayTempGroup = undefined,
      rainFallGroup = undefined,
      windDirGroup = undefined; //xfilter groups

  //charting params
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
        tempChartHeight = tempChartWidth * 0.5,
        rainFallChartWidth = document.getElementById('rainfallChart').offsetWidth,
        rainFallChartHeight = rainFallChartWidth * 0.5;
    tempChart = dc.lineChart('#tempChart').width(tempChartWidth).height(tempChartHeight).transitionDuration(transitionDuration).margins({ top: 30, right: 50, bottom: 25, left: 40 });
    rainfallChart = dc.barChart('#rainfallChart').width(rainFallChartWidth).height(rainFallChartHeight).transitionDuration(10).margins({ top: 30, right: 50, bottom: 25, left: 40 });
    //batteryChart = dc.lineChart('#batteryChart');
  }

  /**
   * get the csv data using d3.promise, then do a few bits of parsing
   * @returns {Promise.<T>} with the parsed data for chaining and further ops
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
        d.week = d3.time.week(d.dateTime);
        d.windDirType = Math.floor(d.windDir / 45); //classify the wind direction into 1 of 8 quadrants
      });
      return data;
    }, function (err) {
      alert("problem fetching data, please reload page");
    });
  }

  /**
   * takes the parsed data and creates a xFilter
   * @param data array of data objects, e.g. as returned from d3.csv
   */
  function setXfilter(data) {
    xFilter = crossfilter(data);
    dayDimension = xFilter.dimension(function (d) {
      return d.day;
    });
    weekDimension = xFilter.dimension(function (d) {
      return d.week;
    });
    solarFluxDimension = xFilter.dimension(function (d) {
      return d.solarFlux;
    });
    windDirDimension = xFilter.dimension(function (d) {
      return d.windDirType;
    });

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

    rainFallGroup = weekDimension.group().reduceSum(function (d) {
      return d.rainfall;
    });
    windDirGroup = windDirDimension.group().reduceCount();
  }

  /**
   * draws the dc charts and the wind radarChart
   * @param data parsed data e.g. from d3.csv, but only call after the dimensions
   * and groups fro dc has been created
   */
  function chartRender(data) {
    var minDate = d3.min(data, function (d) {
      return d.dateTime;
    }),
        maxDate = d3.max(data, function (d) {
      return d.dateTime;
    });
    tempChart.dimension(dayDimension).group(dayTempGroup).brushOn(true).valueAccessor(function (d) {
      return d.value.avgTemp;
    }).x(d3.time.scale().domain([minDate, maxDate])).yAxisLabel('degrees Celcius').renderTitle(true).title(function (d) {
      return d.key + '\n ' + d.value + 'degrees';
    }).on('filtered', function () {
      console.log('filtered', rainFallGroup.all(), windDirGroup.reduceCount().all());
      d3.select('#windDirChart').datum(windDirGroup.reduceCount().all()).call(radarChart());
    });

    tempChart.brush().on('brushend', function () {
      console.log('brushend');
    });

    rainfallChart.dimension(weekDimension).group(rainFallGroup).valueAccessor(function (d) {
      return d.value;
    }).yAxisLabel('mm').brushOn(false).x(d3.time.scale().domain([minDate, maxDate])).xUnits(d3.time.weeks).elasticY(true).elasticX(true);

    windChart = d3.select('#windDirChart').datum(windDirGroup.all()).call(radarChart().width(document.getElementById('windDirChart').offsetWidth).height(document.getElementById('windDirChart').offsetWidth));
    dc.renderAll();
  }

  //radarChart for windDirection data -- as a reusable component
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
        console.log(data, svg, d3.max(data, function (d) {
          return d.value;
        }));
        //or add a new one if not
        var newSVG = svg.enter().append('svg').attr('class', 'radarchart');

        svg.attr("width", width).attr("height", height);

        angleScale.domain([0, data.length]);
        radiusScale.domain([0, d3.max(data, function (d) {
          return d.value;
        })]);

        newSVG.append('g').attr('class', 'radial-bars').attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

        var radialG = d3.selectAll('.radial-bars');

        drawRadialBars(data);
        drawRadialAxis();

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

        function drawRadialAxis() {
          var rAxisVals = d3.range(3).map(function (d) {
            return (d + 1) * radiusScale.domain()[1] / 3;
          });

          var radialAxis = radialG.selectAll('circle.raxis').data(rAxisVals);
          radialAxis.enter().append('circle');
          radialAxis.attr('r', function (d) {
            return radiusScale(d);
          }).attr('cx', 0).attr('cy', 0).attr('class', 'raxis');

          var radialLabels = radialG.selectAll('text').data(rAxisVals);
          radialLabels.enter().append('text');
          radialLabels.attr('x', 0).attr('y', function (d) {
            return radiusScale(d);
          }).text(function (d) {
            return Math.round(radiusScale(d));
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

  //set up dashboard
  dashboardInit();
  //grab the data, parse, then render chart
  getData().then(function (data) {
    setXfilter(data);
    return data;
  }, function (err) {
    console.log(err);
  }).then(function (data) {
    chartRender(data);
  });
})();
//# sourceMappingURL=dashboard.js.map
