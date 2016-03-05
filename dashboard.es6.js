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

let dateFormatter = d3.time.format('%Y/%m/%d %H:%M');
let xFilter; //crossfilter

let tempChart, batteryChart, rainfallChart; // types of charts
let transitionDuration = 500; //default transition times for chart zooming etc


function dashboardInit() {
  let tempChartWidth = document.getElementById('tempChart').offsetWidth,
      tempChartHeight = tempChartWidth * 0.1,
      rainFallChartWidth = document.getElementById('rainfallChart').offsetWidth,
      rainFallChartHeight = rainFallChartWidth * 0.1;
  tempChart = dc.lineChart('#tempChart')
      .width(tempChartWidth)
      .height(tempChartHeight)
      .transitionDuration(transitionDuration)
      .margins({top: 30, right: 50, bottom: 25, left: 40});
  rainfallChart = dc.barChart('#rainfallChart')
      .width(rainFallChartWidth)
      .height(rainFallChartHeight)
      .transitionDuration(10)
      .margins({top: 30, right: 50, bottom: 25, left: 40});
  //batteryChart = dc.lineChart('#batteryChart');
}

function getInitData() {
  d3.csv('JCMB_2015.csv', (err, data) => {
    if(err) {
      alert("problem fetching data, please reload page");
      return
    }
    //parse data after loading to make sure numbers are numbers and dates are Date objs
    data.forEach(d => {
      d.dateTime = dateFormatter.parse(d.dateTime);
      Object.keys(d).forEach((key) => {
        if (d.hasOwnProperty(key) && key !== "dateTime") {
          d[key] = +d[key];
        }
      })
    });
    data.forEach(d => {
      d.month = d3.time.month(d.dateTime);
      d.day = d3.time.day(d.dateTime);
      d.hour = d3.time.hour(d.dateTime);
    });


    console.log(data[0]);

    let minDate = d3.min(data, d => d.dateTime),
        maxDate = d3.max(data, d => d.dateTime)

    xFilter = crossfilter(data);

    let dayDimension = xFilter.dimension(d => d.day);
    let solarFluxDimension = xFilter.dimension(d => d.solarFlux);

    let dayTempGroup = dayDimension.group().reduce((p, v) => {
      ++p.count;
      p.totalTemp += v.surfTemp;
      p.avgTemp = p.totalTemp /p.count;
      return p
    }, (p,v) => {
      --p.count;
      p.totalTemp -= v.surfTemp;
      p.avgTemp = p.totalTemp /p.count;
      return p
    }, () => {
      return {
        count: 0,
        totalTemp: 0,
        avgTemp: 0
      }
    });

    let rainFallGroup = dayDimension.group().reduceSum(d => d.rainfall);

    tempChart
        .dimension(dayDimension)
        .group(dayTempGroup)
        .brushOn(true)
        //.mouseZoomable(true)
        //.keyAccessor(d => d.value.avgTemp)
        .valueAccessor(d => d.value.avgTemp)
        .x(d3.time.scale().domain([minDate, maxDate]))
        .yAxisLabel('degrees Celcius')
        .on('filtered', () => {
          console.log(dayDimension.top(Infinity))
        });

    rainfallChart
        .dimension(dayDimension)
        .group(rainFallGroup)
        .valueAccessor(d => d.value)
        .yAxisLabel('mm')
        .x(d3.time.scale().domain([minDate, maxDate]))
        .elasticY(true)
        .rangeChart(tempChart)


    dc.renderAll();


  })
}

function windowResizeHandler() {
  //debounce function, basically redraw the chart on resize but only after you've
  //finished resizing
  let resizeTimer;
  window.onresize = ((e) => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      dashboardInit();
      dc.renderAll();
    }, 250);
  });

}

dashboardInit();
getInitData();