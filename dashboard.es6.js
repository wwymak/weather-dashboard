/**
 * Main file for the charting js
 *
 * idea: main chart to have temp as time series, grouped by day of year
 * possibly to be zoomable into minute detail, with rainfall superimposed as an extra series above
 * -- would be really cool to do something along the lines of http://bl.ocks.org/emeeks/b57f4cc89dacd38fcdcd
 * secondary charts:
 * wind direction distrubution average for the date range selected with brush (radar chart)
 *
 * battery level vs solar flux
 */

let dateFormatter = d3.time.format('%y/%m/%d %H:%M');
let xFilter; //crossfilter

function dashboardInit(){
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
    console.log(data[0]);
    xFilter = crossfilter(data)

  })
}

dashboardInit();