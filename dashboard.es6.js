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
let dayDimension, weekDimension, solarFluxDimension, windDirDimension; //dimensions- basically what you want as x values
let dayTempGroup, rainFallGroup, windDirGroup; //xfilter groups

let tempChart, batteryChart, rainfallChart, windChart; // types of charts
let transitionDuration = 500; //default transition times for chart zooming etc

/**
 * initialises the dashboard elements that dc draws, setting the height and width
 * dynamically so on window resize the chart redraws according to new dimensions
 */
function dashboardInit() {
  let tempChartWidth = document.getElementById('tempChart').offsetWidth,
      tempChartHeight = tempChartWidth * 0.5,
      rainFallChartWidth = document.getElementById('rainfallChart').offsetWidth,
      rainFallChartHeight = rainFallChartWidth * 0.5;
  tempChart = dc.lineChart('#tempChart')
      .width(tempChartWidth)
      //.minWidth(150)
      .height(tempChartHeight)
      //.minHeight(150)
      .transitionDuration(transitionDuration)
      .margins({top: 30, right: 50, bottom: 25, left: 40});
  rainfallChart = dc.barChart('#rainfallChart')
      .width(rainFallChartWidth)
      .height(rainFallChartHeight)
      .transitionDuration(10)
      .margins({top: 30, right: 50, bottom: 25, left: 40});
  //batteryChart = dc.lineChart('#batteryChart');
}

/**
 * get the csv data using d3.promise, then do a few bits of parsing
 * @returns {Promise.<T>}
 */
function getData() {
  return d3.promise.csv('JCMB_2015.csv').then(data => {
    data.forEach(d => {
      d.dateTime = dateFormatter.parse(d.dateTime);
      Object.keys(d).forEach((key) => {
        if (d.hasOwnProperty(key) && key !== "dateTime") {
          d[key] = +d[key];
        }
      });
      if(d.windDir >= 360) {
        d.windDir = d.windDir % 360;
      }
      d.day = d3.time.day(d.dateTime);
      d.week = d3.time.week(d.dateTime);
      d.windDirType = Math.floor(d.windDir / 45);//classify the wind direction into 1 of 8 quadrants
    });
    return data
  }, (err) => {
    alert("problem fetching data, please reload page");
  });
}

function setXfilter(data) {
  xFilter = crossfilter(data);
  dayDimension = xFilter.dimension(d => d.day);
  weekDimension = xFilter.dimension(d => d.week);
  solarFluxDimension = xFilter.dimension(d => d.solarFlux);
  windDirDimension = xFilter.dimension(d => d.windDirType);

  dayTempGroup = dayDimension.group().reduce((p, v) => {
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

  rainFallGroup = weekDimension.group().reduceSum(d => d.rainfall);
  windDirGroup = windDirDimension.group().reduceCount();
}

function chartRender(data){
  let minDate = d3.min(data, d => d.dateTime),
      maxDate = d3.max(data, d => d.dateTime);
  tempChart
      .dimension(dayDimension)
      .group(dayTempGroup)
      .brushOn(true)
      .valueAccessor(d => d.value.avgTemp)
      .x(d3.time.scale().domain([minDate, maxDate]))
      .yAxisLabel('degrees Celcius')
      .renderTitle(true)
      .title(d => `${d.key}\n ${d.value}degrees`)
      .on('filtered', () => {
        console.log('filtered', rainFallGroup.all(), windDirGroup.reduceCount().all())
        d3.select('#windDirChart').datum(windDirGroup.reduceCount().all()).call(radarChart());
      });

  tempChart.brush().on('brushend', () => {console.log('brushend')})

  rainfallChart
      .dimension(weekDimension)
      .group(rainFallGroup)
      .valueAccessor(d => d.value)
      .yAxisLabel('mm')
      .brushOn(false)
      .x(d3.time.scale().domain([minDate, maxDate]))
      .xUnits(d3.time.weeks)
      .elasticY(true)
      .elasticX(true);
      //.on("zoomed", function(chart, filter){console.log('zoomed')})
      //.on("postRender", function(chart){console.log('postRender')})
      //.rangeChart(tempChart);

  windChart = d3.select('#windDirChart').datum(windDirGroup.all())
      .call(radarChart().width(document.getElementById('windDirChart').offsetWidth)
          .height(document.getElementById('windDirChart').offsetWidth));
  dc.renderAll();
}

//radarChart for windDirection data
function radarChart(){
  let width = 400,
      height = 400,
      margin = 40,
      angleScale = d3.scale.linear().range([0, 2* Math.PI]),
      radiusScale = d3.scale.linear().range([0, d3.min([height, width]) /2 - margin]),
      colorScale = d3.scale.category20(); //temp colors-- don't look super great tbh,

  let stackFunc = d3.layout.stack().values(d => d.values);

  function chart(selection) {
    let svg;
    //assuming that data is in the format of array with [{key: .., value:...}, ...]
    selection.each((data) => {
      //select the svg if it exists
      svg = this.selectAll("svg.radarchart").data([data]);
      console.log(data, svg, d3.max(data, d => d.value))
      //or add a new one if not
      let newSVG = svg.enter().append('svg').attr('class', 'radarchart');

      svg.attr("width" , width)
        .attr("height", height);

      angleScale.domain([0, data.length]);
      radiusScale.domain([0, d3.max(data, d => d.value)]);
console.log(radiusScale.domain())
      newSVG.append('g').attr('class', 'radial-bars')
          .attr('transform', 'translate(' +  width /2 + ',' + height/2 + ')');

      let radialG = d3.selectAll('.radial-bars');

      drawRadialBars(data);
      drawRadialAxis();

      function drawRadialBars(data) {
        let arc = d3.svg.arc().startAngle((d, i) => angleScale(i))
            .endAngle((d, i) => angleScale(i + 1))
            .innerRadius(0)
            .outerRadius(d => radiusScale(d.value));
        let radarSectors = radialG.selectAll('path').data(data)

        radarSectors.enter().append('path');

        radarSectors.attr('d', arc).attr('class', 'radial-sector')
                .attr('fill', (d, i) => colorScale(i));
      }

      function drawRadialAxis() {
        let rAxisVals = d3.range(3).map(function(d){return (d + 1)* radiusScale.domain()[1]/3});

        let radialAxis = radialG.selectAll('circle.raxis').data(rAxisVals);
        radialAxis.enter().append('circle')
        radialAxis.attr('r', d =>  radiusScale(d))
            .attr('cx', 0).attr('cy', 0)
            .attr('class', 'raxis');

        let radialLabels = radialG.selectAll('text').data(rAxisVals);
        radialLabels.enter().append('text');
        radialLabels.attr('x', 0).attr('y', d =>radiusScale(d))
            .text(d => Math.round(radiusScale(d)))
      }

    })
  }

  //getters and setters
  chart.width = function(val) {
    if (!arguments.length) {
      return width;
    }
    width = val;
    return chart;
  };

  chart.height = function(val) {
    if (!arguments.length) {
      return height;
    }
    height = val;
    return chart;
  };

  chart.margin = function(val) {
    if (!arguments.length) {
      return margin;
    }
    margin = val;
    return chart;
  };

  return chart
}
//todo dcjs don't seem to like the resizing very much...
function windowResizeHandler() {
  //debounce function, basically redraw the chart on resize but only after you've
  //finished resizing
  let resizeTimer;
  window.onresize = ((e) => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      //dashboardInit();
      dc.redrawAll();
    }, 250);
  });

}

dashboardInit();

getData().then(data => {
  setXfilter(data);
  return data}, err => {console.log(err)})
  .then((data) => {chartRender(data)});